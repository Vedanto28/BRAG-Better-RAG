/**
 * promptBuilder.js — LEGACY / UNUSED
 *
 * This module is not imported or called by any production code.
 * All prompt construction is performed inline in agentOrchestrator.js
 * using the MECHAMARU_SYSTEM_INSTRUCTION constant.
 *
 * Preserved here to avoid breaking any future references.
 * Do not add new callers without first reviewing agentOrchestrator.js.
 */
export function buildPrompt(context, userQuery) {
  const contextText = Array.isArray(context) && context.length > 0
    ? context.map((entry) => `${entry.topic}: ${entry.content}`).join('\n')
    : 'No relevant context found.';

  return `You are a helpful AI assistant.\n\nUse the provided context whenever relevant.\n\nContext: ${contextText}\n\nUser Question: ${userQuery}\n\nAnswer:`;
}
