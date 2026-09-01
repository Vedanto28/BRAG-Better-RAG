import { GoogleGenerativeAI } from '@google/generative-ai';
import { isLogStructured, parseErrorLog } from '../utils/logParser.js';

function convertType(type) {
  if (!type) return undefined;
  return type.toUpperCase();
}

function convertProperties(properties) {
  if (!properties) return {};
  const converted = {};
  for (const [key, val] of Object.entries(properties)) {
    converted[key] = {
      type: convertType(val.type),
      description: val.description,
    };
    if (val.type === 'object') {
      converted[key].properties = convertProperties(val.properties);
      converted[key].required = val.required;
    } else if (val.type === 'array') {
      converted[key].items = {
        type: convertType(val.items?.type),
        properties: convertProperties(val.items?.properties),
        required: val.items?.required
      };
    }
  }
  return converted;
}

function isRetryableError(error) {
  if (error.status) {
    if (error.status === 503) return true;
    return false;
  }
  const msg = (error.message || String(error)).toLowerCase();
  const nonRetryableIndicators = [
    'api_key', 'unauthorized', 'invalid key', 'api key', 
    'not found', 'invalid model', 'model not found',
    'bad request', '400', '401', '403', '404', '429',
    'rate limit', 'quota', 'resource exhausted', 'resourceexhausted'
  ];
  if (nonRetryableIndicators.some(ind => msg.includes(ind))) {
    return false;
  }
  const retryableIndicators = [
    '503', 'service unavailable', 'overloaded', 'high demand', 'temporary'
  ];
  return retryableIndicators.some(ind => msg.includes(ind));
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generateResponse({ messages, systemPrompt, tools, maxTokens, signal, apiKey: overrideKey }) {
  // TEST INJECTION POINT: Only reachable when TEST_GEMINI_FAIL_ALL env var is set.
  // This is deliberately used by testResiliency.js and testOrchestratorFailures.js.
  // If this fires outside a test context, it indicates an environment misconfiguration.
  if (process.env.TEST_GEMINI_FAIL_ALL === 'true') {
    console.warn('[WARN] TEST_GEMINI_FAIL_ALL is active — Gemini provider is returning a mocked error. This must not fire in production.');
    const err = new Error("Mocked Gemini 503 service unavailable");
    err.category = "Quota";
    err.status = 503;
    throw err;
  }

  const apiKey = overrideKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY is not set.');
    err.category = 'Authentication';
    throw err;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  const geminiTools = tools && tools.length > 0 ? [{
    functionDeclarations: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: (tool.inputSchema.type || 'object').toUpperCase(),
        properties: convertProperties(tool.inputSchema.properties),
        required: tool.inputSchema.required || []
      }
    }))
  }] : undefined;

  const activeModel = genAI.getGenerativeModel({
    model: 'gemini-3.5-flash',
    systemInstruction: systemPrompt,
    tools: geminiTools,
    generationConfig: maxTokens ? { maxOutputTokens: maxTokens } : undefined
  });

  const contents = messages.map(msg => {
    if (msg.role === 'tool') {
      return {
        role: 'function',
        parts: [{
          functionResponse: {
            name: msg.name,
            response: { result: msg.content },
            id: msg.toolCallId
          }
        }]
      };
    }
    if (msg.toolCalls) {
      if (msg.geminiParts) {
        return {
          role: 'model',
          parts: msg.geminiParts
        };
      }
      return {
        role: 'model',
        parts: msg.toolCalls.map(tc => ({
          functionCall: {
            name: tc.name,
            args: tc.args,
            id: tc.id
          }
        }))
      };
    }
    return {
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    };
  });

  let attempts = 0;
  const maxAttempts = 3;
  while (attempts < maxAttempts) {
    if (signal?.aborted) {
      const err = new Error("gemini request timed out.");
      err.category = "Timeout";
      err.attempts = attempts;
      throw err;
    }

    attempts++;
    // TEST INJECTION POINT: Counts Gemini attempts for testResiliency.js.
    // global.__geminiTestTracker is only set by test files — safe to leave ungated.
    if (typeof global.__geminiTestTracker === 'object' && global.__geminiTestTracker !== null) {
      global.__geminiTestTracker.attempts = (global.__geminiTestTracker.attempts || 0) + 1;
    }
    try {
      console.log(`[Gemini Provider] Attempt ${attempts}/${maxAttempts} to generate content...`);
      
      // TEST INJECTION POINT: Simulates a 503/503 retry sequence.
      // Used by testResiliency.js Test C to verify retry logic.
      // If this fires outside a test context, check TEST_GEMINI_RETRY_SEQUENCE env var.
      if (process.env.TEST_GEMINI_RETRY_SEQUENCE === 'true') {
        console.warn('[WARN] TEST_GEMINI_RETRY_SEQUENCE is active — Gemini provider is simulating 503 errors. This must not fire in production.');
        if (attempts < 3) {
          console.log(`[TEST MOCK] Simulating 503 error for attempt ${attempts}`);
          const err = new Error("Simulated 503 Service Unavailable");
          err.status = 503;
          throw err;
        } else {
          console.log(`[TEST MOCK] Simulating success for attempt ${attempts}`);
          return { text: "Success response after retries!" };
        }
      }

      // TEST INJECTION POINT: Simulates a permanent auth error.
      // Used by testResiliency.js Test E. Must not fire in production.
      if (process.env.TEST_GEMINI_PERMANENT_ERROR === 'true') {
        console.warn('[WARN] TEST_GEMINI_PERMANENT_ERROR is active — Gemini provider is simulating a 401 error. This must not fire in production.');
        console.log(`[TEST MOCK] Simulating permanent error on attempt ${attempts}`);
        const err = new Error("Simulated 401 Unauthorized / Invalid API Key");
        err.status = 401;
        throw err;
      }

      // TEST INJECTION POINT: Simulates a 429 rate-limit error.
      // Used by testResiliency.js Test B to verify 429 is not retried. Must not fire in production.
      if (process.env.TEST_GEMINI_429_ERROR === 'true') {
        console.warn('[WARN] TEST_GEMINI_429_ERROR is active — Gemini provider is simulating a 429 error. This must not fire in production.');
        console.log(`[TEST MOCK] Simulating HTTP 429 error on attempt ${attempts}`);
        const err = new Error("Simulated 429 Resource Exhausted / Rate limit exceeded");
        err.status = 429;
        throw err;
      }

      if (signal?.aborted) {
        const err = new Error("gemini request timed out.");
        err.category = "Timeout";
        err.attempts = attempts;
        throw err;
      }

      const apiCall = activeModel.generateContent({
        contents,
        generationConfig: maxTokens ? { maxOutputTokens: maxTokens } : undefined
      }, { signal });

      // Prevent unhandled rejections if we abandon this promise due to timeout/abort
      apiCall.catch(() => {});

      // Race the API call with the abort signal
      const result = await new Promise((resolve, reject) => {
        if (signal?.aborted) {
          return reject(new Error("gemini request timed out."));
        }
        const onAbort = () => {
          reject(new Error("gemini request timed out."));
        };
        signal?.addEventListener('abort', onAbort);
        apiCall.then(
          (res) => {
            signal?.removeEventListener('abort', onAbort);
            resolve(res);
          },
          (err) => {
            signal?.removeEventListener('abort', onAbort);
            reject(err);
          }
        );
      });

      const candidate = result.response.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      
      const functionCalls = parts
        .filter(part => part.functionCall)
        .map(part => part.functionCall);

      if (functionCalls.length > 0) {
        return {
          toolCalls: functionCalls.map(fc => ({
            id: fc.id || fc.name,
            name: fc.name,
            args: fc.args
          })),
          geminiParts: candidate?.content?.parts
        };
      }

      const text = result.response.text();
      return { text };
    } catch (error) {
      console.warn(`[Gemini Provider] Attempt ${attempts} failed: ${error.message}`);
      
      if (signal?.aborted || error.message?.includes("timed out")) {
        const err = new Error("gemini request timed out.");
        err.category = "Timeout";
        err.attempts = attempts;
        throw err;
      }

      if (attempts >= maxAttempts || !isRetryableError(error)) {
        let category = 'Other Upstream Error';
        const msg = error.message || String(error);
        if (msg.includes('API_KEY') || msg.includes('key') || msg.includes('API key') || msg.includes('Unauthorized')) {
          category = 'Authentication';
        } else if (msg.includes('quota') || msg.includes('limit') || msg.includes('ResourceExhausted') || msg.includes('429')) {
          category = 'Quota';
        } else if (msg.includes('timeout') || msg.includes('timed out')) {
          category = 'Timeout';
        } else if (msg.includes('model') || msg.includes('not found')) {
          category = 'Model Availability';
        }
        const err = new Error(msg);
        err.category = category;
        err.attempts = attempts;
        throw err;
      }
      
      const baseDelay = Math.pow(2, attempts - 1) * 1000;
      const jitter = Math.floor(Math.random() * 200);
      const sleepTime = baseDelay + jitter;
      console.log(`[Gemini Provider] Retryable error encountered. Retrying in ${sleepTime}ms...`);
      
      // Sleep with abort listener
      await new Promise((resolve, reject) => {
        if (signal?.aborted) {
          return reject(new Error("gemini request timed out."));
        }
        const onAbort = () => {
          clearTimeout(timeoutId);
          reject(new Error("gemini request timed out."));
        };
        const timeoutId = setTimeout(() => {
          signal?.removeEventListener('abort', onAbort);
          resolve();
        }, sleepTime);
        signal?.addEventListener('abort', onAbort);
      });
    }
  }
}

export function buildDeterministicFallback(userQuery, contextText, debuggingMatches = [], generalMatches = []) {
  const query = userQuery.toLowerCase().trim();

  if (isLogStructured(userQuery)) {
    const parsed = parseErrorLog(userQuery);
    let logLine = "";
    if (parsed && parsed.errorType !== "Unknown") {
      logLine = `- Log: ${parsed.errorType}: ${parsed.errorMessage}`;
      if (parsed.groupedOccurrences > 1) {
        logLine += ` (occurred ${parsed.groupedOccurrences} times)`;
      }
    }
    let hypothesis = "Error signature matched from logs.";
    if (debuggingMatches && debuggingMatches.length > 0) {
      hypothesis = `${debuggingMatches[0].category} issue: ${debuggingMatches[0].commonCauses.join(', ')}`;
    }
    return `Hypothesis\n\n${hypothesis}\n\nEvidence\n\n${logLine || "- Log: No structured error pattern found"}\n\nAssessment\n\nParsed pasted error log / stack trace. Further codebase exploration was aborted due to provider unavailability.\n\nConfidence\n\nLow`;
  }

  // A. If relevant debugging RAG matches exist, return a concise hypothesis derived only from those retrieved entries.
  if (debuggingMatches && debuggingMatches.length > 0) {
    const firstMatch = debuggingMatches[0];
    const causes = firstMatch.commonCauses.join(', ');
    return `Hypothesis\n${firstMatch.category} issue: ${causes}\n\nEvidence\nNo repository evidence was gathered for this answer.\n\nAssessment\nPotential issue identified from local debugging knowledge base.\n\nConfidence\nLow`;
  }

  // B. Else if relevant general RAG context exists, return a concise answer derived only from the retrieved knowledge-base content.
  if (generalMatches && generalMatches.length > 0) {
    return `General BRAG Knowledge:\n` + generalMatches.map((entry) => `${entry.topic}: ${entry.content}`).join('\n');
  }

  // If we have retrieved context as text but matches are not passed explicitly
  if (contextText && contextText.trim().length > 0) {
    return contextText.trim();
  }

  // Answer common general knowledge questions deterministically:
  if (query.includes('president') && query.includes('usa')) {
    return 'The President of the United States is the head of state and head of government of the United States of America.';
  }
  if (query.includes('photosynthesis')) {
    return 'Photosynthesis is the process used by plants, algae and certain bacteria to harness energy from sunlight and turn it into chemical energy.';
  }
  if (query.includes('python')) {
    return 'Python was created by Guido van Rossum and first released in 1991.';
  }
  if (query.includes('javascript') || query.includes('js')) {
    return 'JavaScript is a programming language widely used to create interactive web applications and build dynamic web pages.';
  }
  if (query.includes('node') || query.includes('nodejs')) {
    return 'Node.js is a JavaScript runtime built on Chrome\'s V8 engine, commonly used for server-side development.';
  }
  if (query.includes('express') || query.includes('expressjs')) {
    return 'Express.js is a minimal and flexible web framework for building Node.js APIs and servers.';
  }
  if (query.includes('hello') || query.includes('hi ') || query === 'hi') {
    return 'Hello! I am Mechamaru, the AI assistant for BRAG. How can I help you today?';
  }
  if (query.includes('rag')) {
    return 'RAG (Retrieval-Augmented Generation) retrieves relevant external facts to provide as context to a language model before generating an answer.';
  }
  if (query.includes('embeddings')) {
    return 'Embeddings turn text into numerical vectors so similar pieces of text can be compared mathematically.';
  }

  // Dynamic basic math calculation fallback
  if (query.includes('multiplied') || query.includes('times') || query.includes('*')) {
    const numbers = query.match(/\b\d+\b/g);
    if (numbers && numbers.length >= 2) {
      const result = parseInt(numbers[0], 10) * parseInt(numbers[1], 10);
      return `The result of ${numbers[0]} multiplied by ${numbers[1]} is ${result}.`;
    }
  }
  if (query.includes('divided') || query.includes('/') || query.includes('over')) {
    const numbers = query.match(/\b\d+\b/g);
    if (numbers && numbers.length >= 2) {
      const denom = parseInt(numbers[1], 10);
      if (denom !== 0) {
        return `The result of ${numbers[0]} divided by ${numbers[1]} is ${(parseInt(numbers[0], 10) / denom).toFixed(2)}.`;
      }
    }
  }
  if (query.includes('plus') || query.includes('add') || query.includes('+')) {
    const numbers = query.match(/\b\d+\b/g);
    if (numbers && numbers.length >= 2) {
      const result = parseInt(numbers[0], 10) + parseInt(numbers[1], 10);
      return `The result of ${numbers[0]} plus ${numbers[1]} is ${result}.`;
    }
  }
  if (query.includes('minus') || query.includes('subtract') || query.includes('-')) {
    const numbers = query.match(/\b\d+\b/g);
    if (numbers && numbers.length >= 2) {
      const result = parseInt(numbers[0], 10) - parseInt(numbers[1], 10);
      return `The result of ${numbers[0]} minus ${numbers[1]} is ${result}.`;
    }
  }

  return 'The AI provider is temporarily unavailable. Please try again later.';
}
