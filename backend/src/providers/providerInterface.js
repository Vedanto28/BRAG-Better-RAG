import * as geminiProvider from './geminiProvider.js';
import * as openaiProvider from './openaiProvider.js';
import { AI_CONFIG } from '../utils/config.js';

function withTimeout(promise, ms, errorMessage = 'Request timed out.') {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const err = new Error(errorMessage);
      err.category = 'Timeout';
      reject(err);
    }, ms);
  });
  return Promise.race([
    promise.then((res) => {
      clearTimeout(timeoutId);
      return res;
    }),
    timeoutPromise
  ]);
}

export async function generateResponse({ messages, systemPrompt, tools }) {
  // MOCK MODE: When MOCK_LLM=true, delegate to the isolated mock handler module.
  // This path must NEVER be reached in production. Set MOCK_LLM=true only in test contexts.
  if (process.env.MOCK_LLM === 'true') {
    const { getMockResponse } = await import('./mockProvider.js');
    return getMockResponse({ messages, systemPrompt, tools });
  }

  const primaryProvider = process.env.LLM_PROVIDER || 'gemini';
  const secondaryProvider = primaryProvider === 'gemini' ? 'openai' : 'gemini';

  const providerMap = {
    gemini: geminiProvider,
    openai: openaiProvider
  };

  const hasApiKey = (prov) => {
    if (prov === 'gemini') return !!process.env.GEMINI_API_KEY;
    if (prov === 'openai') return !!process.env.OPENAI_API_KEY;
    return false;
  };

  const callProvider = async (providerName) => {
    const provModule = providerMap[providerName];
    if (!provModule) {
      throw new Error(`Unsupported provider: ${providerName}`);
    }
    console.log(`[Orchestrator] Attempting generation with provider: ${providerName}`);
    
    const controller = new AbortController();
    const signal = controller.signal;

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, AI_CONFIG.REQUEST_TIMEOUT_MS);

    try {
      const result = await provModule.generateResponse({
        messages,
        systemPrompt,
        tools,
        maxTokens: AI_CONFIG.MAX_OUTPUT_TOKENS,
        signal
      });
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      if (signal.aborted || error.category === 'Timeout' || error.message?.includes('timed out')) {
        const err = new Error(`${providerName} request timed out.`);
        err.category = 'Timeout';
        throw err;
      }
      throw error;
    }
  };

  try {
    if (!hasApiKey(primaryProvider)) {
      const err = new Error(`Primary provider ${primaryProvider} is missing its API key.`);
      err.category = 'Authentication';
      throw err;
    }
    const result = await callProvider(primaryProvider);
    return { ...result, provider: primaryProvider };
  } catch (primaryError) {
    const category = primaryError.category || 'Other Upstream Error';
    console.warn(`[Orchestrator] Primary provider (${primaryProvider}) failed. Category: ${category}. Error: ${primaryError.message}`);

    const canTrySecondary = hasApiKey(secondaryProvider);
    if (canTrySecondary) {
      try {
        console.warn(`[Orchestrator] Attempting fallback to secondary provider: ${secondaryProvider}`);
        const result = await callProvider(secondaryProvider);
        return { ...result, provider: secondaryProvider };
      } catch (secondaryError) {
        const secCategory = secondaryError.category || 'Other Upstream Error';
        console.error(`[Orchestrator] Secondary provider (${secondaryProvider}) also failed. Category: ${secCategory}. Error: ${secondaryError.message}`);
        throw new Error(`Both primary and secondary LLM providers failed. Primary: ${primaryError.message}. Secondary: ${secondaryError.message}`);
      }
    } else {
      throw primaryError;
    }
  }
}
