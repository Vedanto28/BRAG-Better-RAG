import { retrieveContext } from './rag.js';
import { generateResponse } from '../providers/providerInterface.js';
import mcpRegistry from './mcpRegistry.js';
import { AI_CONFIG } from '../utils/config.js';
import { buildDeterministicFallback } from '../providers/geminiProvider.js';
import { isLogStructured } from '../utils/logParser.js';

const MECHAMARU_SYSTEM_INSTRUCTION =
  "You are Mechamaru, the AI assistant for BRAG, a read-only backend debugging investigator.\n" +
  "You have access to repository-investigation tools (listRepositoryFiles, readFile, searchCode), local Git history tools (getRecentCommits, inspectCommit), and a log-parsing tool (parseErrorLog).\n\n" +
  "STRICT RULES FOR TOOL USE:\n" +
  "1. Only use codebase/Git/log-parsing tools when the question is about THIS connected codebase's actual implementation, errors, or changes (e.g. 'where is X configured', 'how does Y work', 'what changed recently', 'auth started failing today', or when a stack trace/error log is pasted).\n" +
  "2. For general conceptual questions with no reference to this project's implementation (e.g. 'what is a git commit', 'what is JWT', 'explain REST'), answer directly from your own knowledge without calling any tool.\n" +
  "3. If the user's message contains a pasted error log or stack trace, you MUST call parseErrorLog on that exact text before speculating about the cause.\n" +
  "4. After parsing, if stackFrames reference files, you must decide whether to use readFile/searchCode to confirm whether those files exist in the repository and what they currently contain. Do not assume stack trace file paths are accurate without checking. If a stack frame references a file that does not exist in the repository, you must state that explicitly rather than fabricating an explanation.\n" +
  "5. Every claim you make about the connected codebase must be grounded in actual tool results. Do not guess.\n" +
  "6. Do not claim that a route, controller, service, configuration, dependency, or implementation exists unless supported by inspected evidence.\n" +
  "7. You are read-only. Diagnose and explain, but do not write, modify, or execute files.\n\n" +
  "FINAL RESPONSE FORMATS:\n" +
  "1. For debugging and log investigations (when debugging context was found, you are investigating a bug/failure symptom, or a log/stack trace is pasted): your final answer MUST be structured exactly as:\n\n" +
  "Hypothesis\n\n" +
  "<hypothesis based on retrieved RAG common causes, parsed log details, or potential codebase issues>\n\n" +
  "Evidence\n\n" +
  "<evidence lines, exactly formatted as follows. Omit the line entirely if that type of evidence was not gathered. NEVER write 'not checked' or 'No repository evidence...'>\n" +
  "- Log: <parsed error type/message, grouped occurrence counts if repeated>\n" +
  "- Code: <actual code evidence if inspected>\n" +
  "- Recent changes: <actual commit evidence if inspected>\n" +
  "- Remote/External: <actual remote/external evidence if inspected via remote tools e.g. DevTools/Context7>\n" +
  "- Remote (GitHub): <actual GitHub remote evidence if inspected e.g. PRs, issues, workflow status>\n\n" +
  "Assessment\n\n" +
  "<whether combined evidence confirms, rejects, weakens, or does not yet prove the hypothesis. If a stack frame references a file that does not exist in this repository, explicitly mention that here>\n\n" +
  "Confidence\n\n" +
  "High / Medium / Low\n\n" +
  "2. For other repository codebase investigations (where is X configured etc.): your final answer MUST be concise and structured exactly as:\n\n" +
  "Likely Answer / Likely Cause\n\n" +
  "<direct answer based only on inspected evidence>\n\n" +
  "Evidence\n\n" +
  "- <repository-relative file path and relevant function/line evidence>\n\n" +
  "Confidence\n\n" +
  "High / Medium / Low\n\n" +
  "3. General conceptual questions (e.g. 'what is a git commit') should be answered directly and concisely without any of these structured formats.";


let globalHistory = [];

function routeRequest(query, debuggingMatches = []) {
  if (isLogStructured(query)) {
    return "log_investigation";
  }
  const q = query.toLowerCase().trim();

  // 1. Check for change_investigation first (questions about what changed, commits, recent edits, git history)
  const changePatterns = [
    /\b(changed|change|commit|commits|git history|recent edits|last commit|recently)\b/,
    /\bwhy did .* start failing after.*\b/
  ];
  if (changePatterns.some(regex => regex.test(q))) {
    // Make sure conceptual questions like "what is a git commit?" are NOT routed to change_investigation
    const conceptualExclusions = [
      /^what is (a )?git commit(\?)?$/,
      /^explain git commit(s)?(\?)?$/
    ];
    if (!conceptualExclusions.some(regex => regex.test(q))) {
      return "change_investigation";
    }
  }

  const debuggingPatterns = [
    /\b(startup|fail|fails|failing|failed|crash|crashes|crashed|error|errors|exception|econnrefused|undefined during startup|broke|broken|bug|issue|not working|timeout|timeouts)\b/
  ];
  if (debuggingPatterns.some(regex => regex.test(q))) {
    const requestsCodebaseCheck = /\b(investigate|check|search|find|where|show|code|implementation|files|repository|repo|github)\b/i.test(q);
    if (!requestsCodebaseCheck) {
      if (debuggingMatches && debuggingMatches.length > 0) {
        return "knowledge_debugging";
      }
      if (/\b(this|my|project|backend|app|server|codebase|login|db|database|auth|connection|env)\b/.test(q)) {
        return "knowledge_debugging";
      }
    }
  }

  // 3. Check for utility_tool (calculator arithmetic, date/time)
  const timePatterns = [
    /\b(what time is it|current time|current date|what is today('s)? date|time right now)\b/
  ];
  if (timePatterns.some(regex => regex.test(q))) {
    return "utility_tool";
  }
  const calcPatterns = [
    /\b(calculate|add|subtract|multiply|multiplied by|divided by|plus|minus|times)\b/
  ];
  if (calcPatterns.some(regex => regex.test(q)) && /\d+/.test(q)) {
    return "utility_tool";
  }

  // 4. Check for normal_chat exclusions (general conceptual definitions, greetings, simple non-code queries)
  const generalExclusions = [
    /^what is (javascript|js|express|expressjs|node|nodejs|rest|rag|embeddings|jwt|git|html|css|cors)(\?)?$/,
    /^explain (jwt|rest|javascript|js|express|expressjs|node|nodejs|rag|embeddings|git|html|css|cors)$/,
    /^who developed (node|nodejs|javascript|python)(\?)?$/,
    /^(hi|hello|hey|good morning|good afternoon|good evening|who are you)(\?)?$/
  ];
  if (generalExclusions.some(regex => regex.test(q))) {
    return "normal_chat";
  }

  // 5. Check for repository_investigation (specific codebase/architecture queries)
  const repoIndicators = [
    /\b(this|the|my|current)\b.*\b(repo|repository|codebase|backend|project|app|server|workspace|directory|files|src|folders)\b/,
    /\b(login|chat|auth|api|db|database|route|endpoint|controller|service|middleware|config|configuration|provider|handler|orchestrator|server\.js|package\.json|env|port|express)\b/,
    /\b(where|how|why|what)\b.*\b(defined|configured|implemented|stored|written|saved|set|called|used|structured|organized|enforced|travel|flow|reach|path|journey)\b/
  ];
  const repoKeywords = [
    'app.listen', 'max_user_message_chars', 'max_context_chars', 'agentorchestrator',
    'mcpclient', 'mcpserver', 'providerinterface', 'geminiprovider', 'openaiprovider',
    'localrepoprovider', 'repoprovider', 'login route', 'jwt secret', 'database connection'
  ];
  if (repoIndicators.some(regex => regex.test(q)) || repoKeywords.some(kw => q.includes(kw))) {
    return "repository_investigation";
  }

  // Default fallback: normal_chat (zero tools, no MCP init for general questions without codebase context)
  return "normal_chat";
}


export async function runAgentOrchestrator(message, signal) {
  if (!message || typeof message !== 'string' || !message.trim()) {
    const err = new Error('Message is required.');
    err.status = 400;
    throw err;
  }

  const trimmedMessage = message.trim();
  if (trimmedMessage.length > AI_CONFIG.MAX_USER_MESSAGE_CHARS) {
    const err = new Error(`Message is too long. Maximum length is ${AI_CONFIG.MAX_USER_MESSAGE_CHARS} characters.`);
    err.status = 400;
    throw err;
  }

  console.log(`[Orchestrator] Retrieving static RAG context for query: "${trimmedMessage}"`);
  const context = await retrieveContext(trimmedMessage);
  
  const generalMatches = context;
  const debuggingMatches = context.debuggingMatches || [];
  const contextFound = generalMatches.length > 0 || debuggingMatches.length > 0;

  let contextText = '';
  if (generalMatches.length > 0) {
    contextText += `General BRAG Knowledge:\n` + generalMatches.map((entry) => `${entry.topic}: ${entry.content}`).join('\n');
  }
  if (debuggingMatches.length > 0) {
    if (contextText) contextText += '\n\n';
    contextText += `General Debugging Hypotheses & Search Hints (guidance only, not confirmed for this repo):\n` +
      debuggingMatches.map((entry) => {
        return `ID: ${entry.id}\n` +
               `Category: ${entry.category}\n` +
               `Symptoms: ${entry.symptoms.join(', ')}\n` +
               `Common Causes: ${entry.commonCauses.join(', ')}\n` +
               `Investigation Steps: ${entry.investigationSteps.join(', ')}\n` +
               `Code Search Hints: ${entry.codeSearchHints.join(', ')}`;
      }).join('\n\n');
  }

  if (contextFound && contextText.length > AI_CONFIG.MAX_CONTEXT_CHARS) {
    console.warn(`[Orchestrator] Context length (${contextText.length}) exceeded limit. Truncating to ${AI_CONFIG.MAX_CONTEXT_CHARS}`);
    contextText = contextText.slice(0, AI_CONFIG.MAX_CONTEXT_CHARS) + '\n... [truncated due to size limits]';
  }

  const fullSystemPrompt = contextFound
    ? `${MECHAMARU_SYSTEM_INSTRUCTION}\n\nRetrieved Context:\n${contextText}`
    : MECHAMARU_SYSTEM_INSTRUCTION;


  if (globalHistory.length > AI_CONFIG.MAX_HISTORY_MESSAGES) {
    globalHistory = globalHistory.slice(-AI_CONFIG.MAX_HISTORY_MESSAGES);
  }

  const sessionMessages = [...globalHistory, { role: 'user', content: trimmedMessage }];
  // Route determines which evidence mode to use. normal_chat and knowledge_debugging bypass MCP
  // entirely (no tool init, no connection cost). All other modes open the MCP connection.
  const mode = routeRequest(trimmedMessage, debuggingMatches);
  const needsTool = mode !== "normal_chat" && mode !== "knowledge_debugging";

  let finalAnswer = null;
  let responseProvider = null;
  let toolUsed = null;

  const repositoryToolsUsed = [];
  const allToolsUsed = [];
  const inspectedPaths = new Set();
  const commitsInspected = new Set();
  let logEvidence = { errorType: "", groupedOccurrences: 0, framesReferenced: [] };
  const externalEvidence = [];
  let toolCallCount = 0;
  let toolCallLimitReached = false;


  if (!needsTool) {
    console.log(`[Orchestrator] Question classified as ${mode}. Bypassing MCP tools.`);
    try {
      const result = await generateResponse({
        messages: sessionMessages,
        systemPrompt: fullSystemPrompt,
        tools: []
      });
      finalAnswer = result.text;
      responseProvider = result.provider;
    } catch (error) {
      console.error("[Orchestrator] Normal chat LLM error, triggering deterministic fallback:", error.message || error);
      finalAnswer = buildDeterministicFallback(trimmedMessage, contextText, mode === "normal_chat" ? [] : debuggingMatches, generalMatches);
      responseProvider = "fallback";
    }
  } else {
    console.log(`[Orchestrator] Question requires tool (${mode}). Initializing MCP connection.`);
    let mcpTools = [];

    try {
      mcpTools = await mcpRegistry.getToolsForMode(mode);
    } catch (registryError) {
      console.warn("[Orchestrator] MCP Registry tool discovery failed or unavailable. Resetting capability providers.", registryError.message || registryError);
      await mcpRegistry.resetAll();
    }

    let stepCount = 0;

    try {
      while (stepCount < AI_CONFIG.MAX_AGENT_STEPS) {
        stepCount++;
        console.log(`[Orchestrator] Agent Step ${stepCount}/${AI_CONFIG.MAX_AGENT_STEPS}`);

        const result = await generateResponse({
          messages: sessionMessages,
          systemPrompt: fullSystemPrompt,
          tools: mcpTools
        });

        responseProvider = result.provider;

        if (result.toolCalls && result.toolCalls.length > 0) {
          console.log(`[Orchestrator] Model requested ${result.toolCalls.length} tool calls:`, JSON.stringify(result.toolCalls));

          sessionMessages.push({
            role: 'assistant',
            toolCalls: result.toolCalls
          });

          for (const toolCall of result.toolCalls) {
            // Global tool budget: enforced across ALL tool types for ALL modes.
            // This is the single gate that prevents unbounded investigation loops.
            if (toolCallCount >= AI_CONFIG.MAX_TOOL_CALLS_PER_REQUEST) {
              toolCallLimitReached = true;
              console.warn(`[Orchestrator] Tool call limit exceeded (${AI_CONFIG.MAX_TOOL_CALLS_PER_REQUEST}). Blocking tool execution.`);
              sessionMessages.push({
                role: 'tool',
                toolCallId: toolCall.id,
                name: toolCall.name,
                content: JSON.stringify({ error: "Tool call limit per request reached." })
              });
              continue;
            }
            toolCallCount++;

            const toolExists = mcpTools.some(t => t.name === toolCall.name);
            if (!toolExists) {
              console.warn(`[Orchestrator] Model attempted to call unknown tool: ${toolCall.name}`);
              sessionMessages.push({
                role: 'tool',
                toolCallId: toolCall.id,
                name: toolCall.name,
                content: JSON.stringify({ error: `Tool ${toolCall.name} does not exist.` })
              });
              continue;
            }

            console.log(`[Orchestrator] Executing tool: ${toolCall.name} with args:`, JSON.stringify(toolCall.args));
            toolUsed = toolCall.name;
            if (!allToolsUsed.includes(toolCall.name)) {
              allToolsUsed.push(toolCall.name);
            }

            if (["listRepositoryFiles", "searchCode", "readFile", "getRecentCommits", "inspectCommit"].includes(toolCall.name)) {
              if (!repositoryToolsUsed.includes(toolCall.name)) {
                repositoryToolsUsed.push(toolCall.name);
              }
              if (toolCall.name === "readFile" && toolCall.args?.path) {
                inspectedPaths.add(toolCall.args.path);
              }
              if (toolCall.name === "listRepositoryFiles" && toolCall.args?.subPath) {
                inspectedPaths.add(toolCall.args.subPath);
              }
              if (toolCall.name === "inspectCommit" && toolCall.args?.commitHash) {
                const shortHash = toolCall.args.commitHash.slice(0, 7).toLowerCase();
                commitsInspected.add(shortHash);
              }
            }

            try {
              const { toolResult, provider: owningProvider } = await mcpRegistry.callTool({
                name: toolCall.name,
                arguments: toolCall.args,
                signal
              });

              const contentText = (toolResult.content || []).map(c => c.text).join('\n');
              console.log(`[Orchestrator] Tool result:`, contentText);

              if (toolCall.name === "searchCode") {
                try {
                  const data = JSON.parse(contentText);
                  if (data && Array.isArray(data.matches)) {
                    for (const match of data.matches) {
                      if (match.path) {
                        inspectedPaths.add(match.path);
                      }
                    }
                  }
                } catch (e) {
                  // Ignore parsing error
                }
              }

              if (toolCall.name === "parseErrorLog") {
                try {
                  const parsed = JSON.parse(contentText);
                  logEvidence.errorType = parsed.errorType || "";
                  logEvidence.groupedOccurrences = parsed.groupedOccurrences || 0;
                  if (Array.isArray(parsed.stackFrames)) {
                    logEvidence.framesReferenced = parsed.stackFrames.map(f => ({
                      file: f.file,
                      line: f.line,
                      functionName: f.functionName
                    }));
                  }
                } catch (err) {
                  console.error("[Orchestrator] Failed to parse logEvidence from parseErrorLog content:", err);
                }
              }

              if (owningProvider && owningProvider.isExternal) {
                let parsedResult = contentText;
                try {
                  parsedResult = JSON.parse(contentText);
                } catch (e) {}
                if (typeof owningProvider.formatEvidence === 'function') {
                  externalEvidence.push(owningProvider.formatEvidence(toolCall.name, toolCall.args || {}, parsedResult));
                } else {
                  externalEvidence.push({
                    provider: owningProvider.name || "unknown",
                    toolName: toolCall.name,
                    evidenceType: "unknown",
                    summary: `Tool ${toolCall.name} executed`,
                    payload: parsedResult
                  });
                }
              }

              sessionMessages.push({
                role: 'tool',
                toolCallId: toolCall.id,
                name: toolCall.name,
                content: contentText
              });
            } catch (execError) {
              console.error(`[Orchestrator] Tool execution error for ${toolCall.name}:`, execError.message || execError);
              await mcpRegistry.resetAll();
              sessionMessages.push({
                role: 'tool',
                toolCallId: toolCall.id,
                name: toolCall.name,
                content: JSON.stringify({ error: `Failed to execute tool: ${execError.message || String(execError)}` })
              });
            }
          }
        } else {
          finalAnswer = result.text;
          break;
        }
      }

      if (!finalAnswer) {
        if (stepCount >= AI_CONFIG.MAX_AGENT_STEPS) {
          console.warn(`[Orchestrator] Agent step limit reached (${AI_CONFIG.MAX_AGENT_STEPS}) without final answer.`);
          finalAnswer = "Agent step limit reached. I'm unable to complete this request.";
        } else {
          finalAnswer = "I was unable to complete the request.";
        }
      }
    } catch (error) {
      console.error("[Orchestrator] Agent loop error, triggering deterministic fallback:", error.message || error);
      finalAnswer = buildDeterministicFallback(trimmedMessage, contextText, mode === "normal_chat" ? [] : debuggingMatches, generalMatches);
      responseProvider = "fallback";
    }
  }

  // Limit-reached annotation: prepended before the Evidence section (if present)
  // so the user understands why the investigation was cut short.
  if (toolCallLimitReached && finalAnswer) {
    const limitMsg = "Investigation stopped after reaching the tool-call limit; evidence gathered so far is below.";
    if (!finalAnswer.includes("Investigation stopped after reaching the tool-call limit")) {
      const evidenceIndex = finalAnswer.indexOf("Evidence");
      if (evidenceIndex !== -1) {
        finalAnswer = finalAnswer.slice(0, evidenceIndex).trim() + "\n\n" + limitMsg + "\n\n" + finalAnswer.slice(evidenceIndex);
      } else {
        finalAnswer = finalAnswer + "\n\n" + limitMsg;
      }
    }
  }

  globalHistory.push({ role: 'user', content: trimmedMessage });
  globalHistory.push({ role: 'assistant', content: finalAnswer });

  if (globalHistory.length > AI_CONFIG.MAX_HISTORY_MESSAGES) {
    globalHistory = globalHistory.slice(-AI_CONFIG.MAX_HISTORY_MESSAGES);
  }

  if (typeof finalAnswer !== 'string' || finalAnswer.trim().length === 0) {
    throw new Error('Failed to generate a valid non-empty response.');
  }

  // Metadata: single construction point shared by all modes.
  // All fields are always present; unused fields are empty arrays/strings.
  return {
    success: true,
    answer: finalAnswer.trim(),
    metadata: {
      provider: responseProvider || "unknown",
      contextFound,
      toolUsed,
      mode,
      toolsUsed: allToolsUsed,
      inspectedPaths: Array.from(inspectedPaths),
      debuggingMatches: debuggingMatches.map(m => m.id),
      commitsInspected: Array.from(commitsInspected),
      logEvidence,
      externalEvidence,
      toolCallsUsed: Math.min(toolCallCount, AI_CONFIG.MAX_TOOL_CALLS_PER_REQUEST),
      toolCallLimitReached
    }
  };
}
