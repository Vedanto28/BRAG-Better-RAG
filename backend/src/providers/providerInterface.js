import * as geminiProvider from './geminiProvider.js';
import * as openaiProvider from './openaiProvider.js';
import * as deepseekProvider from './deepseekProvider.js';
import { AI_CONFIG } from '../utils/config.js';

/**
 * Specs for all 6 supported LLM providers.
 * OpenRouter, Groq, and Cerebras reuse the shared OpenAI-compatible adapter (`openaiProvider`).
 */
const PROVIDER_SPECS = {
  gemini: {
    module: geminiProvider,
    envKey: () => process.env.GEMINI_API_KEY
  },
  openai: {
    module: openaiProvider,
    envKey: () => process.env.OPENAI_API_KEY,
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini'
  },
  openrouter: {
    module: openaiProvider,
    envKey: () => process.env.OPENROUTER_API_KEY,
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini'
  },
  groq: {
    module: openaiProvider,
    envKey: () => process.env.GROQ_API_KEY,
    baseUrl: 'https://api.groq.com/openai/v1',
    model: process.env.GROQ_MODEL || 'groq/compound-mini'
  },
  cerebras: {
    module: openaiProvider,
    envKey: () => process.env.CEREBRAS_API_KEY,
    baseUrl: 'https://api.cerebras.ai/v1',
    model: 'llama3.1-8b'
  },
  deepseek: {
    module: deepseekProvider,
    envKey: () => process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_MCP,
    model: 'deepseek-chat'
  }
};

/**
 * SINGLE AUDITABLE SUBSTITUTION POINT
 * Resolves credential and configuration for a specified provider.
 * Prefers user-supplied session credentials over server .env keys.
 * 
 * @param {string} providerName 
 * @param {object} [userCredentials] 
 * @returns {{ apiKey: string|null, source: 'user'|'server'|'none', spec: object }}
 */
export function resolveProviderCredentials(providerName, userCredentials = {}) {
  const spec = PROVIDER_SPECS[providerName];
  if (!spec) {
    return { apiKey: null, source: 'none', spec: null };
  }

  const userKey = userCredentials[providerName];
  if (userKey && typeof userKey === 'string' && userKey.trim().length > 0) {
    return { apiKey: userKey.trim(), source: 'user', spec };
  }

  const serverKey = spec.envKey();
  if (serverKey && typeof serverKey === 'string' && serverKey.trim().length > 0) {
    return { apiKey: serverKey.trim(), source: 'server', spec };
  }

  return { apiKey: null, source: 'none', spec };
}

function isQuotaError(error) {
  if (error.category === 'Quota') return true;
  if (error.status === 429 || error.status === 402) return true;
  const msg = (error.message || '').toLowerCase();
  return msg.includes('quota') || msg.includes('rate limit') || msg.includes('insufficient_quota') || msg.includes('resource exhausted');
}

export async function generateResponse({ messages, systemPrompt, tools, userCredentials = {} }) {
  // MOCK MODE: When MOCK_LLM=true, delegate to the isolated mock handler module.
  // This path must NEVER be reached in production. Set MOCK_LLM=true only in test contexts.
  if (process.env.MOCK_LLM === 'true') {
    const { getMockResponse } = await import('./mockProvider.js');
    return getMockResponse({ messages, systemPrompt, tools });
  }

  const primaryEnvProvider = process.env.LLM_PROVIDER || 'gemini';
  const defaultServerChain = [
    primaryEnvProvider,
    primaryEnvProvider === 'gemini' ? 'openai' : 'gemini',
    'deepseek'
  ];

  // 1. Build list of provider execution candidates.
  // Providers with user-supplied keys take priority over server-configured providers.
  const executionChain = [];
  const addedProviders = new Set();

  // A. User-supplied key providers first
  for (const providerName of Object.keys(PROVIDER_SPECS)) {
    const cred = resolveProviderCredentials(providerName, userCredentials);
    if (cred.source === 'user') {
      executionChain.push({ name: providerName, ...cred });
      addedProviders.add(providerName);
    }
  }

  // B. Server-configured providers next (in default fallback order)
  for (const providerName of defaultServerChain) {
    if (addedProviders.has(providerName)) continue;
    const cred = resolveProviderCredentials(providerName, userCredentials);
    if (cred.source === 'server') {
      executionChain.push({ name: providerName, ...cred });
      addedProviders.add(providerName);
    }
  }

  if (executionChain.length === 0) {
    const err = new Error('No available LLM providers. Neither user-supplied keys nor server-configured keys were found.');
    err.category = 'Authentication';
    throw err;
  }

  const errors = [];

  for (const candidate of executionChain) {
    const { name: providerName, source, apiKey, spec } = candidate;
    console.log(`[Orchestrator] Attempting generation with provider: ${providerName} (source: ${source})`);

    const controller = new AbortController();
    const signal = controller.signal;

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, AI_CONFIG.REQUEST_TIMEOUT_MS);

    try {
      const result = await spec.module.generateResponse({
        messages,
        systemPrompt,
        tools,
        maxTokens: AI_CONFIG.MAX_OUTPUT_TOKENS,
        signal,
        apiKey,
        baseUrl: spec.baseUrl,
        model: spec.model
      });
      clearTimeout(timeoutId);
      return { ...result, provider: providerName, credentialSource: source };
    } catch (error) {
      clearTimeout(timeoutId);
      let errMessage = error.message || String(error);
      // Ensure raw key string is never in logged error text
      if (apiKey && errMessage.includes(apiKey)) {
        errMessage = errMessage.replaceAll(apiKey, '[REDACTED_USER_KEY]');
      }
      const category = error.category || (signal.aborted ? 'Timeout' : 'Other Upstream Error');
      console.warn(`[Orchestrator] Provider ${providerName} (${source}) failed. Category: ${category}. Error: ${errMessage}`);
      
      const safeError = new Error(errMessage);
      safeError.category = category;
      safeError.status = error.status;
      errors.push({ provider: providerName, source, error: safeError });
    }
  }

  // All providers in execution chain failed
  const errorSummary = errors.map(e => `${e.provider} (${e.source}): ${e.error.message}`).join('; ');
  throw new Error(`All LLM providers failed. ${errorSummary}`);
}
