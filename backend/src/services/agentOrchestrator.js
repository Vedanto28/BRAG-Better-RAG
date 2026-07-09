import { retrieveContext } from './rag.js';
import { generateResponse } from '../providers/providerInterface.js';
import { getMcpClient, resetMcpClient } from './mcpClient.js';
import { AI_CONFIG } from '../utils/config.js';
import { buildDeterministicFallback } from '../providers/geminiProvider.js';

const MECHAMARU_SYSTEM_INSTRUCTION =
  "You are Mechamaru, the AI assistant for BRAG. Answer the user's question directly and concisely. " +
  "Prefer 2 to 4 short sentences. Use provided knowledge-base context when it is relevant. " +
  "If no relevant context is provided, answer using your general knowledge. Do not invent tool results.";

let globalHistory = [];

function requiresTool(query) {
  const q = query.toLowerCase();
  
  // Check for calculator indicators
  const hasMathKeywords = /\b(calculate|multiply|divided|minus|plus|times|add|subtract|sum|arithmetic)\b/.test(q);
  const hasMathSymbols = /[\d\s]+[\+\-\*\/\x\=]+[\d\s]+/.test(q) || /[\+\-\*\/]/.test(q);
  
  // Check for date/time indicators
  const hasTimeKeywords = /\b(time|date|clock|today|timezone|now)\b/.test(q);

  // Check for explicit knowledge-base search
  const hasSearchKeywords = /\b(search|knowledge\s+base|kb|find\s+in\s+kb|retrieve\s+context)\b/.test(q);
  
  return hasMathKeywords || hasMathSymbols || hasTimeKeywords || hasSearchKeywords;
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
  const contextFound = context.length > 0;

  let contextText = contextFound
    ? context.map((entry) => `${entry.topic}: ${entry.content}`).join('\n')
    : '';

  if (contextFound && contextText.length > AI_CONFIG.MAX_CONTEXT_CHARS) {
    console.warn(`[Orchestrator] Context length (${contextText.length}) exceeded limit. Truncating to ${AI_CONFIG.MAX_CONTEXT_CHARS}`);
    contextText = contextText.slice(0, AI_CONFIG.MAX_CONTEXT_CHARS) + '\n... [truncated due to size limits]';
  }

  const fullSystemPrompt = contextFound
    ? `${MECHAMARU_SYSTEM_INSTRUCTION}\n\nRetrieved BRAG Knowledge:\n${contextText}`
    : MECHAMARU_SYSTEM_INSTRUCTION;

  if (globalHistory.length > AI_CONFIG.MAX_HISTORY_MESSAGES) {
    globalHistory = globalHistory.slice(-AI_CONFIG.MAX_HISTORY_MESSAGES);
  }

  const sessionMessages = [...globalHistory, { role: 'user', content: trimmedMessage }];
  const needsTool = requiresTool(trimmedMessage);

  let finalAnswer = null;
  let responseProvider = null;
  let toolUsed = null;

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

  return {
    success: true,
    answer: finalAnswer.trim(),
    metadata: {
      provider: responseProvider || "unknown",
      contextFound,
      toolUsed
    }
  };
}
