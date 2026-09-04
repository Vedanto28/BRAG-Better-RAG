/**
 * Lightweight rule-based query and investigation complexity classifier.
 * Evaluates query signals, error log depth, and gathered MCP evidence
 * to assign complexity level (low, medium, high) and adaptive maxTokens budget.
 */

export const COMPLEXITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high'
};

export const ADAPTIVE_TOKEN_LIMITS = {
  low: 250,      // ~100-150 words
  medium: 500,   // ~200-350 words
  high: 900      // ~400-700 words (full investigation)
};

/**
 * Checks if the user explicitly requested a fix or solution.
 * @param {string} query
 * @returns {boolean}
 */
export function isFixRequested(query) {
  if (typeof query !== 'string') return false;
  const q = query.toLowerCase();
  const fixPatterns = [
    /\b(how to fix|how do i fix|how can i fix|fix this|fix it|provide a fix|give me a fix|show me the fix)\b/,
    /\b(resolve this|resolve it|solve this|solve it|how to solve|how to resolve|patch this|provide a patch)\b/,
    /\b(write the code to fix|code fix|give me the solution|provide the solution|how do i correct)\b/
  ];
  return fixPatterns.some(pattern => pattern.test(q));
}

/**
 * Classifies the investigation complexity level.
 *
 * @param {object} params
 * @param {string} params.query User input query
 * @param {string} [params.mode] Orchestrator routing mode
 * @param {number} [params.evidenceCount=0] Number of MCP evidence items collected
 * @param {boolean} [params.hasLog=false] Whether structured log was detected/parsed
 * @param {Array<string>} [params.toolsUsed=[]] Tools actually invoked
 * @returns {{ level: 'low'|'medium'|'high', maxTokens: number, targetWords: string, fixAllowed: boolean, reason: string }}
 */
export function classifyComplexity({
  query = '',
  mode = 'normal_chat',
  evidenceCount = 0,
  hasLog = false,
  toolsUsed = []
} = {}) {
  const cleanQuery = typeof query === 'string' ? query.trim() : '';
  const queryLen = cleanQuery.length;
  const qLower = cleanQuery.toLowerCase();
  const fixAllowed = isFixRequested(cleanQuery);

  // 1. High Complexity: Live MCP tools executed with evidence, or deep multi-line stack trace
  const gatheredMcpEvidence = evidenceCount > 0 || toolsUsed.length > 0;
  const isDeepLog = hasLog || (cleanQuery.includes('\n') && (cleanQuery.includes('at ') || cleanQuery.includes('Error:')) && queryLen > 250);

  if (gatheredMcpEvidence || isDeepLog || mode === 'log_investigation') {
    return {
      level: COMPLEXITY_LEVELS.HIGH,
      maxTokens: ADAPTIVE_TOKEN_LIMITS.high,
      targetWords: '~400-700 words (full investigation format)',
      fixAllowed,
      reason: gatheredMcpEvidence ? 'Active MCP tool evidence gathered' : 'Multi-line error trace / log investigation'
    };
  }

  // 2. Check for Low Complexity (concise conceptual definitions, greetings, arithmetic)
  const isSimpleConceptual = /^what is (a |an )?[a-z0-9_\-\. ]+(\?)?$/i.test(cleanQuery) ||
                             /^explain [a-z0-9_\-\. ]+(\?)?$/i.test(cleanQuery) ||
                             /^(hi|hello|hey|good morning|who are you)(\?)?$/i.test(cleanQuery) ||
                             mode === 'utility_tool';

  if (isSimpleConceptual && queryLen < 60 && !cleanQuery.includes('\n')) {
    return {
      level: COMPLEXITY_LEVELS.LOW,
      maxTokens: ADAPTIVE_TOKEN_LIMITS.low,
      targetWords: '~100-150 words (concise findings and root cause)',
      fixAllowed,
      reason: 'Concise conceptual inquiry or direct question'
    };
  }

  // 3. Medium Complexity: Technical diagnostic query with RAG context, error codes, or general backend debugging
  const debuggingKeywords = [
    'error', 'fail', 'crash', 'timeout', 'econnrefused', 'deadlock', '40p01', 'payloadtoolarge',
    'jwt', 'cors', 'oom', 'heap', '137', 'unhandledrejection', 'socket hang up', 'eaddrinuse',
    'why does', 'why is', 'what caused', 'root cause', 'investigate'
  ];
  const hasDebuggingKeyword = debuggingKeywords.some(kw => qLower.includes(kw));

  if (mode === 'knowledge_debugging' || mode === 'repository_investigation' || hasDebuggingKeyword || queryLen > 60) {
    return {
      level: COMPLEXITY_LEVELS.MEDIUM,
      maxTokens: ADAPTIVE_TOKEN_LIMITS.medium,
      targetWords: '~200-350 words (core diagnostic format with impact)',
      fixAllowed,
      reason: 'Technical diagnostic query with knowledge context'
    };
  }

  // Default fallback: Low Complexity
  return {
    level: COMPLEXITY_LEVELS.LOW,
    maxTokens: ADAPTIVE_TOKEN_LIMITS.low,
    targetWords: '~100-150 words (concise findings and root cause)',
    fixAllowed,
    reason: 'Short query without error telemetry'
  };
}
