import { AI_CONFIG } from '../utils/config.js';
import { buildProviderExecutionChain, resolveProviderCredentials, PROVIDER_SPECS } from './providerRouter.js';
import { sanitizeOutput } from '../utils/credentials.js';

export { resolveProviderCredentials, PROVIDER_SPECS };

/**
 * Executes response generation across candidate providers.
 * Evaluates the rate-limit aware provider execution chain (Groq -> Gemini -> BYOK).
 *
 * @param {object} params
 * @param {any[]} params.messages
 * @param {string} params.systemPrompt
 * @param {any[]} params.tools
 * @param {Record<string, string>} [params.userCredentials]
 * @param {object} [params.mockUsage] Usage telemetry override for rate-limit simulation
 * @returns {Promise<object>} Generated response object with provider metadata
 */
export async function generateResponse({
  messages,
  systemPrompt,
  tools,
  userCredentials = {},
  mockUsage = null,
  maxTokens = AI_CONFIG.MAX_OUTPUT_TOKENS
}) {
  // MOCK MODE: When MOCK_LLM=true, delegate to the isolated mock handler module.
  if (process.env.MOCK_LLM === 'true') {
    const { getMockResponse } = await import('./mockProvider.js');
    return getMockResponse({ messages, systemPrompt, tools });
  }

  // Build the intelligent, rate-limit aware execution chain
  const { executionChain, diagnostics } = await buildProviderExecutionChain({
    userCredentials,
    mockUsage
  });

  if (executionChain.length === 0) {
    const err = new Error('No available LLM providers. All providers are either unconfigured or have exceeded rate limits.');
    err.category = 'RateLimitOrAuth';
    throw err;
  }

  const errors = [];

  for (const candidate of executionChain) {
    const { name: providerName, source, apiKey, spec } = candidate;
    console.log(`[ProviderRouter] Generating with provider: ${providerName} (source: ${source})`);

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
        maxTokens,
        signal,
        apiKey,
        baseUrl: spec.baseUrl,
        model: spec.model
      });
      clearTimeout(timeoutId);
      return {
        ...result,
        provider: providerName,
        credentialSource: source,
        routerDiagnostics: diagnostics
      };
    } catch (error) {
      clearTimeout(timeoutId);
      let errMessage = error.message || String(error);

      // Security hardening: ensure raw key string is NEVER in logged error text
      errMessage = sanitizeOutput(errMessage, userCredentials);

      const category = error.category || (signal.aborted ? 'Timeout' : 'Upstream Error');
      console.warn(`[ProviderRouter] Provider ${providerName} (${source}) failed. Category: ${category}. Error: ${errMessage}`);

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
