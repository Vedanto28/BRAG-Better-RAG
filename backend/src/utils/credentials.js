/**
 * Credential Architecture & Security Sanitization Layer.
 * Formally separates LLM generation credentials from External Tool/MCP credentials.
 */

export const LLM_PROVIDERS = ['groq', 'gemini', 'openai', 'openrouter', 'cerebras', 'deepseek'];
export const TOOL_PROVIDERS = ['github_mcp', 'context7_mcp', 'deepseek_mcp', 'chrome_devtools_mcp'];

export const LLM_ENV_MAPPINGS = {
  groq: 'GROQ_API_KEY',
  gemini: 'GEMINI_API_KEY',
  openai: 'OPENAI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  cerebras: 'CEREBRAS_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY'
};

export const TOOL_ENV_MAPPINGS = {
  github_mcp: 'GITHUB_MCP',
  context7_mcp: 'CONTEXT7_MCP',
  deepseek_mcp: 'DEEPSEEK_MCP'
};

/**
 * Validates whether an API key format is acceptable without logging or leaking it.
 * @param {string} key Raw API key string
 * @returns {boolean} True if format is valid
 */
export function validateKeyFormat(key) {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (trimmed.length < 10) return false;
  if (/\s/.test(trimmed)) return false;
  if (/[\x00-\x1F\x7F]/.test(trimmed)) return false;
  return true;
}

/**
 * Masks an API key for safe UI inspection (e.g. sk-•••••••1234).
 * @param {string} key
 * @returns {string} Masked string
 */
export function maskKey(key) {
  if (!key || typeof key !== 'string') return '';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '••••••••';
  const prefix = trimmed.slice(0, 3);
  const suffix = trimmed.slice(-4);
  return `${prefix}••••••••${suffix}`;
}

/**
 * Sanitizes any raw string or error message by stripping user-provided BYOK keys and server secrets.
 * @param {string} text Input text
 * @param {Record<string, string>} [userCredentials] Ephemeral session keys
 * @returns {string} Redacted safe text
 */
export function sanitizeOutput(text, userCredentials = {}) {
  if (typeof text !== 'string') return text;
  let sanitized = text;

  // 1. Redact User BYOK Keys
  if (userCredentials && typeof userCredentials === 'object') {
    for (const keyVal of Object.values(userCredentials)) {
      if (typeof keyVal === 'string' && keyVal.trim().length >= 6) {
        sanitized = sanitized.split(keyVal.trim()).join('[REDACTED_USER_KEY]');
      }
    }
  }

  // 2. Redact Server LLM Keys
  for (const envVar of Object.values(LLM_ENV_MAPPINGS)) {
    const val = process.env[envVar];
    if (val && typeof val === 'string' && val.trim().length >= 8) {
      sanitized = sanitized.split(val.trim()).join('[REDACTED_SERVER_KEY]');
    }
  }

  // 3. Redact Server Tool Keys
  for (const envVar of Object.values(TOOL_ENV_MAPPINGS)) {
    const val = process.env[envVar];
    if (val && typeof val === 'string' && val.trim().length >= 8) {
      sanitized = sanitized.split(val.trim()).join('[REDACTED_TOOL_KEY]');
    }
  }

  // 4. Pattern-based catch-all for key assignments
  const tokenRegex = /\b([a-zA-Z0-9_\-]*?(?:key|secret|password|token)[a-zA-Z0-9_\-]*?\s*[:=]\s*)(["']?)([^\r\n"'\s]{10,})\2/gi;
  sanitized = sanitized.replace(tokenRegex, (match, prefix, quote, secret) => {
    if (secret.includes('REDACTED')) return match;
    return `${prefix}${quote}[REDACTED]${quote}`;
  });

  return sanitized;
}
