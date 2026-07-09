import { retrieveContext } from './rag.js';
import { generateResponse } from '../providers/providerInterface.js';
import { getMcpClient, resetMcpClient } from './mcpClient.js';
import { AI_CONFIG } from '../utils/config.js';
import { buildDeterministicFallback } from '../providers/geminiProvider.js';

const MECHAMARU_SYSTEM_INSTRUCTION =
  "You are Mechamaru, the AI assistant for BRAG, a read-only backend debugging investigator.\n" +
  "You have access to repository-investigation tools (listRepositoryFiles, readFile, searchCode) and local Git history tools (getRecentCommits, inspectCommit).\n\n" +
  "STRICT RULES FOR TOOL USE:\n" +
  "1. Only use codebase/Git tools when the question is about THIS connected codebase's actual implementation or changes (e.g. 'where is X configured', 'how does Y work', 'what changed recently', 'auth started failing today').\n" +
  "2. For general conceptual questions with no reference to this project's implementation (e.g. 'what is a git commit', 'what is JWT', 'explain REST'), answer directly from your own knowledge without calling any tool.\n" +
  "3. Every claim you make about the connected codebase must be grounded in actual tool results. Do not guess.\n" +
  "4. Do not claim that a route, controller, service, configuration, dependency, or implementation exists unless supported by inspected evidence.\n" +
  "5. If you have unused tool calls remaining and have not yet found direct evidence for your claim, you must continue investigating rather than presenting a guess as an answer.\n" +
  "6. If you exhaust your tool-call budget without finding evidence, your final answer must clearly state 'No evidence of X was found in the inspected files' rather than a hedged guess.\n" +
  "7. You are read-only. Diagnose and explain, but do not write, modify, or execute files.\n\n" +
  "FINAL RESPONSE FORMATS:\n" +
  "1. For debugging investigations (when debugging context was found or you are investigating a bug/failure symptom): your final answer MUST be structured exactly as:\n\n" +
  "Hypothesis\n" +
  "<hypothesis based on retrieved RAG common causes or potential codebase issues>\n\n" +
  "Evidence\n" +
  "- Code: <actual code evidence if inspected, or 'No repository evidence was gathered for this answer' if none>\n" +
  "- Recent changes: <actual commit evidence if inspected, or 'No relevant recent changes found'>\n\n" +
  "Assessment\n" +
  "<whether combined evidence confirms, rejects, weakens, or does not yet prove the hypothesis>\n\n" +
  "Confidence\n" +
  "High / Medium / Low\n\n" +
  "Note: If no Git tools were used during the turn, omit the '- Recent changes:' line entirely from the Evidence section.\n\n" +
  "2. For other repository codebase investigations (where is X configured etc.): your final answer MUST be concise and structured exactly as:\n\n" +
  "Likely Answer / Likely Cause\n" +
  "<direct answer based only on inspected evidence>\n\n" +
  "Evidence\n" +
  "- <repository-relative file path and relevant function/line evidence>\n\n" +
  "Confidence\n" +
  "High / Medium / Low\n\n" +
  "3. General conceptual questions (e.g. 'what is a git commit') should be answered directly and concisely without any of these structured formats.";


let globalHistory = [];

function isRepositoryInvestigation(query) {
  const q = query.toLowerCase().trim();

  // Explicitly ignore simple general definitions to keep general chat lightweight
  const generalExclusions = [
    /^what is (javascript|js|express|expressjs|node|nodejs|rest|rag|embeddings|jwt|git|html|css)(\?)?$/,
    /^explain (jwt|rest|javascript|js|express|expressjs|node|nodejs|rag|embeddings|git|html|css)$/,
    /^who developed (node|nodejs|javascript|python)(\?)?$/
  ];
  
  if (generalExclusions.some(regex => regex.test(q))) {
    return false;
  }

  // Exclude math/time queries from being classified as repository queries
  const hasMathKeywords = /\b(calculate|multiply|divided|minus|plus|times|add|subtract|sum|arithmetic)\b/.test(q);
  const hasMathSymbols = /[\d\s]+[\+\-\*\/\x\=]+[\d\s]+/.test(q) || /[\+\-\*\/]/.test(q);
  const hasTimeKeywords = /\b(time|date|clock|today|timezone|now)\b/.test(q);
  if (hasMathKeywords || hasMathSymbols || hasTimeKeywords) {
    return false;
  }

  // Broad indicators of codebase / project / file structure / implementation
  const indicators = [
    /\b(this|the|my|current)\b.*\b(repo|repository|codebase|backend|project|app|server|workspace|directory|files|src|folders)\b/,
    /\b(login|chat|auth|api|db|database|route|endpoint|controller|service|middleware|config|configuration|provider|handler|orchestrator|server\.js|package\.json|env|port|express)\b/,
    /\b(startup|start|fail|crash|error|listen|port)\b/,
    /\b(enforced|defined|configured|implemented|called|runs|enforces|handles)\b/,
    /\b(where|how|why)\b.*\b(defined|configured|implemented|stored|written|saved|set|called|used|structured|organized|enforced)\b/,
    /\b(travel|flow|reach|path|journey|message|history)\b/
  ];

  // Specific project-specific terms/files
  const keywords = [
    'app.listen', 'max_user_message_chars', 'max_context_chars', 'agentorchestrator',
    'mcpclient', 'mcpserver', 'providerinterface', 'geminiprovider', 'openaiprovider',
    'localrepoprovider', 'repoprovider'
  ];

  const matchIndicator = indicators.some(regex => regex.test(q));
  const matchKeyword = keywords.some(kw => q.includes(kw));

  return matchIndicator || matchKeyword;
}

function requiresTool(query) {
  return true;
}


export async function runAgentOrchestrator(message) {
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
  const needsTool = requiresTool(trimmedMessage);

  let finalAnswer = null;
  let responseProvider = null;
  let toolUsed = null;

  const repositoryToolsUsed = [];
  const inspectedPaths = new Set();
  const commitsInspected = new Set();


  if (!needsTool) {
    console.log(`[Orchestrator] Question classified as normal. Bypassing MCP tools.`);
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
      finalAnswer = buildDeterministicFallback(trimmedMessage, contextText);
      responseProvider = "fallback";
    }
  } else {
    console.log(`[Orchestrator] Question requires tool. Initializing MCP connection.`);
    let mcpTools = [];
    let mcpClient = null;

    try {
      mcpClient = await getMcpClient();
      const toolsResponse = await mcpClient.listTools();
      mcpTools = toolsResponse.tools || [];
    } catch (mcpError) {
      console.warn("[Orchestrator] MCP Server connection failed or unavailable. Resetting client.", mcpError.message || mcpError);
      resetMcpClient();
    }

    let stepCount = 0;
    let toolCallCount = 0;

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
            toolCallCount++;
            if (toolCallCount > AI_CONFIG.MAX_TOOL_CALLS_PER_REQUEST) {
              console.warn(`[Orchestrator] Tool call limit exceeded (${AI_CONFIG.MAX_TOOL_CALLS_PER_REQUEST}). Stopping tool execution.`);
              sessionMessages.push({
                role: 'tool',
                toolCallId: toolCall.id,
                name: toolCall.name,
                content: JSON.stringify({ error: "Tool call limit per request reached." })
              });
              continue;
            }

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
              if (!mcpClient) {
                throw new Error("MCP client is not connected.");
              }
              const toolResult = await mcpClient.callTool({
                name: toolCall.name,
                arguments: toolCall.args
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

              sessionMessages.push({
                role: 'tool',
                toolCallId: toolCall.id,
                name: toolCall.name,
                content: contentText
              });
            } catch (execError) {
              console.error(`[Orchestrator] Tool execution error for ${toolCall.name}:`, execError.message || execError);
              resetMcpClient();
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
      finalAnswer = buildDeterministicFallback(trimmedMessage, contextText);
      responseProvider = "fallback";
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

  let mode = "normal";
  if (debuggingMatches.length > 0) {
    mode = "debugging_investigation";
  } else if (repositoryToolsUsed.length > 0 || isRepositoryInvestigation(trimmedMessage)) {
    mode = "repository_investigation";
  }

  return {
    success: true,
    answer: finalAnswer.trim(),
    metadata: {
      provider: responseProvider || "unknown",
      contextFound,
      toolUsed,
      mode,
      toolsUsed: repositoryToolsUsed,
      inspectedPaths: Array.from(inspectedPaths),
      debuggingMatches: debuggingMatches.map(m => m.id),
      commitsInspected: Array.from(commitsInspected)
    }
  };
}
