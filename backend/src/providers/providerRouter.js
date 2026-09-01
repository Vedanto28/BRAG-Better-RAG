import { isProviderNearLimit } from '../utils/providerLimits.js';
import * as geminiProvider from './geminiProvider.js';
import * as openaiProvider from './openaiProvider.js';
import * as deepseekProvider from './deepseekProvider.js';

export const PROVIDER_SPECS = {
  groq: {
    module: openaiProvider,
    envKey: () => process.env.GROQ_API_KEY,
    baseUrl: 'https://api.groq.com/openai/v1',
    model: process.env.GROQ_MODEL || 'groq/compound-mini'
  },
  gemini: {
    module: geminiProvider,
    envKey: () => process.env.GEMINI_API_KEY
  },
  openai: {
    module: openaiProvider,
    envKey: () => process.env.OPENAI_API_KEY,
    baseUrl: 'https://api.openai.com/v1',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
  },
  openrouter: {
    module: openaiProvider,
    envKey: () => process.env.OPENROUTER_API_KEY,
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini'
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
 * Resolves credential and configuration for a specified provider.
 * @param {string} providerName 
 * @param {Record<string, string>} [userCredentials] 
 * @returns {{ apiKey: string|null, source: 'user'|'server'|'none', spec: object }}
 */
export function resolveProviderCredentials(providerName, userCredentials = {}) {
  const spec = PROVIDER_SPECS[providerName];
  if (!spec) {
    return { apiKey: null, source: 'none', spec: null };
  }

  const userKey = userCredentials[providerName];
  if (userKey && typeof userKey === 'string' && userKey.trim().length >= 10) {
    return { apiKey: userKey.trim(), source: 'user', spec };
  }

  const serverKey = spec.envKey();
  if (serverKey && typeof serverKey === 'string' && serverKey.trim().length >= 10) {
    return { apiKey: serverKey.trim(), source: 'server', spec };
  }

  return { apiKey: null, source: 'none', spec };
}

/**
 * Builds an intelligent, rate-limit aware provider execution chain.
 *
 * Target Routing Hierarchy:
 * 1. User BYOK Key (if provided by user for priority routing)
 * 2. Groq (checks usage_metadata for near-limit condition)
 * 3. Gemini (checks usage_metadata for near-limit condition)
 * 4. OpenAI / Fallback server providers
 * 5. General BYOK (if server providers are exhausted/near-limit)
 *
 * @param {object} params
 * @param {Record<string, string>} [params.userCredentials] Session BYOK keys
 * @param {string} [params.requestedProvider] Specific provider requested
 * @param {object} [params.mockUsage] Usage telemetry override (for deterministic testing)
 * @returns {Promise<{ executionChain: Array<{ name: string, source: string, apiKey: string, spec: object }>, diagnostics: Array<object> }>}
 */
export async function buildProviderExecutionChain({
  userCredentials = {},
  requestedProvider = null,
  mockUsage = null
} = {}) {
  const executionChain = [];
  const addedProviders = new Set();
  const diagnostics = [];

  // A. Priority User BYOK Credentials
  for (const [providerName, keyVal] of Object.entries(userCredentials)) {
    if (keyVal && typeof keyVal === 'string' && keyVal.trim().length >= 10) {
      const spec = PROVIDER_SPECS[providerName];
      if (spec) {
        executionChain.push({
          name: providerName,
          source: 'user',
          apiKey: keyVal.trim(),
          spec
        });
        addedProviders.add(providerName);
        diagnostics.push({
          provider: providerName,
          action: 'selected',
          source: 'user_byok',
          reason: 'User session credential prioritized'
        });
      }
    }
  }

  // B. Server Provider Priority Chain: Groq -> Gemini -> OpenAI -> DeepSeek
  const defaultServerPriority = ['groq', 'gemini', 'openai', 'deepseek'];

  for (const providerName of defaultServerPriority) {
    if (addedProviders.has(providerName)) continue;

    const spec = PROVIDER_SPECS[providerName];
    if (!spec) continue;

    const serverKey = spec.envKey();
    if (!serverKey || typeof serverKey !== 'string' || serverKey.trim().length < 10) {
      diagnostics.push({
        provider: providerName,
        action: 'skipped',
        reason: 'Server environment key not configured'
      });
      continue;
    }

    // Check rate limit threshold using usage_metadata from Phase 1
    const customUsageForProv = mockUsage?.[providerName] || null;
    const limitCheck = await isProviderNearLimit(providerName, customUsageForProv);

    if (limitCheck.isNearLimit) {
      console.warn(`[ProviderRouter] Rate limit near capacity for ${providerName}: ${limitCheck.reason}. Bypassing to next candidate.`);
      diagnostics.push({
        provider: providerName,
        action: 'bypassed',
        source: 'server',
        reason: limitCheck.reason,
        usage: limitCheck.usage
      });
      continue;
    }

    executionChain.push({
      name: providerName,
      source: 'server',
      apiKey: serverKey.trim(),
      spec
    });
    addedProviders.add(providerName);
    diagnostics.push({
      provider: providerName,
      action: 'selected',
      source: 'server',
      usage: limitCheck.usage
    });
  }

  return { executionChain, diagnostics };
}
