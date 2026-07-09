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
  if (process.env.MOCK_LLM === 'true') {
    const lastUserIndex = messages.findLastIndex(m => m.role === 'user');
    const currentTurnMessages = lastUserIndex >= 0 ? messages.slice(lastUserIndex) : messages;
    const turnLength = currentTurnMessages.length;

    console.log(`[Mock LLM] Intercepted generateResponse. Messages count: ${messages.length}, turnLength: ${turnLength}`);
    const lastUserMessage = messages[lastUserIndex]?.content || '';
    const q = lastUserMessage.toLowerCase();

    // 2b Test A: "What changed in the last few commits?"
    if (q.includes('what changed') && q.includes('commits')) {
      if (turnLength === 1) {
        return {
          provider: 'mock',
          toolCalls: [{
            id: 'mock-get-recent-commits-a',
            name: 'getRecentCommits',
            args: { limit: 5 }
          }]
        };
      }
      return {
        provider: 'mock',
        text: "Recent commits:\n- f5e4d3c (Author: Alice, Date: 2026-07-09): update config files\n- a1b2c3d (Author: Bob, Date: 2026-07-08): refactor auth middleware"
      };
    }

    // 2b Test B: "Auth started failing today, did anything change recently?"
    if (q.includes('auth started failing') && q.includes('change')) {
      if (turnLength === 1) {
        return {
          provider: 'mock',
          toolCalls: [{
            id: 'mock-get-recent-commits-b',
            name: 'getRecentCommits',
            args: { limit: 5 }
          }]
        };
      }
      if (turnLength === 3) {
        return {
          provider: 'mock',
          toolCalls: [{
            id: 'mock-inspect-commit-b',
            name: 'inspectCommit',
            args: { commitHash: 'a1b2c3d' }
          }]
        };
      }
      if (turnLength === 5) {
        return {
          provider: 'mock',
          toolCalls: [{
            id: 'mock-search-auth-b',
            name: 'searchCode',
            args: { query: 'jwt.verify' }
          }]
        };
      }
      return {
        provider: 'mock',
        text: "Hypothesis\nThe authentication failure is caused by a recent change in token signing or verification config.\n\nEvidence\n- Code: Checked 'jwt.verify' occurrences in codebase.\n- Recent changes: Inspecting commit a1b2c3d (\"refactor auth middleware\") shows that the verification algorithm was changed.\n\nAssessment\nThe recent commit changed the verification algorithm which caused verification to fail.\n\nConfidence\nHigh"
      };
    }

    // 2b Test D: "This project's database connection broke after the last commit, why?"
    if (q.includes("database connection broke") && q.includes("last commit")) {
      if (turnLength === 1) {
        return {
          provider: 'mock',
          toolCalls: [{
            id: 'mock-get-recent-commits-d',
            name: 'getRecentCommits',
            args: { limit: 5 }
          }]
        };
      }
      if (turnLength === 3) {
        return {
          provider: 'mock',
          toolCalls: [{
            id: 'mock-inspect-commit-d',
            name: 'inspectCommit',
            args: { commitHash: 'f5e4d3c' }
          }]
        };
      }
      if (turnLength === 5) {
        return {
          provider: 'mock',
          toolCalls: [{
            id: 'mock-search-db-d',
            name: 'searchCode',
            args: { query: 'mongoose.connect' }
          }]
        };
      }
      return {
        provider: 'mock',
        text: "Hypothesis\nThe database connection failure was caused by incorrect connection string format introduced in the last commit.\n\nEvidence\n- Code: Found mongoose.connect calls in backend/src/providers/localRepoProvider.js.\n- Recent changes: Inspecting commit f5e4d3c (\"update config files\") shows it changed database port configuration.\n\nAssessment\nThe latest commit changed the DB port to an incorrect value, causing ECONNREFUSED on startup.\n\nConfidence\nHigh"
      };
    }

    // 2b Test C: "What is a git commit?"
    if (q.includes('what is a git commit')) {
      return {
        provider: 'mock',
        text: "A git commit is a snapshot of changes saved to the repository history."
      };
    }

    // 2a Test A: "My login keeps failing with ECONNREFUSED. What could be going on?"
    if (q.includes('login keeps failing') && q.includes('econnrefused')) {
      return {
        provider: 'mock',
        text: "Hypothesis\nThe backend database or target service port is unavailable or not running.\n\nEvidence\nNo repository evidence was gathered for this answer.\n\nAssessment\nThe database or authentication server might be down. Codebase verification was not requested for this query.\n\nConfidence\nMedium"
      };
    }

    // 2a Test B: "This project's database connection is failing with ECONNREFUSED on startup. Investigate why."
    if (q.includes("database connection is failing") || (q.includes("database connection") && q.includes("econnrefused") && q.includes("startup"))) {
      if (turnLength === 1) {
        return {
          provider: 'mock',
          toolCalls: [{
            id: 'mock-search-db',
            name: 'searchCode',
            args: { query: 'mongoose.connect' }
          }]
        };
      }
      if (turnLength === 3) {
        return {
          provider: 'mock',
          toolCalls: [{
            id: 'mock-read-server-db',
            name: 'readFile',
            args: { path: 'backend/server.js' }
          }]
        };
      }
      return {
        provider: 'mock',
        text: "Hypothesis\nThe database URL, host, or port configuration is incorrect, or the DB service is down.\n\nEvidence\n- backend/server.js: searched for 'mongoose.connect' but found no database initialization code.\n\nAssessment\nThe connection fails because there is no database connection code or client initialized in server.js in this repository.\n\nConfidence\nHigh"
      };
    }

    // 2a Test D: "This backend says an environment variable is undefined during startup. Investigate."
    if (q.includes('environment variable is undefined') || (q.includes('variable is undefined') && q.includes('investigate'))) {
      if (turnLength === 1) {
        return {
          provider: 'mock',
          toolCalls: [{
            id: 'mock-search-dotenv',
            name: 'searchCode',
            args: { query: 'dotenv.config' }
          }]
        };
      }
      if (turnLength === 3) {
        return {
          provider: 'mock',
          toolCalls: [{
            id: 'mock-read-server-env',
            name: 'readFile',
            args: { path: 'backend/server.js' }
          }]
        };
      }
      return {
        provider: 'mock',
        text: "Hypothesis\nThe environment variable configuration .env file is missing or loaded after modules are initialized.\n\nEvidence\n- backend/server.js: lines 15-16 - dotenv.config is configured and loaded relative to backend Dir and root directory.\n\nAssessment\nEnvironment variables are loaded correctly at server startup. Typos in specific env names might cause them to be undefined.\n\nConfidence\nHigh"
      };
    }

    // 2a Test C: "What is CORS?"
    if (q.includes('what is cors')) {
      return {
        provider: 'mock',
        text: "CORS (Cross-Origin Resource Sharing) is a browser security mechanism that restricts web applications from making requests to a different domain than the one that served the application."
      };
    }

    // Query A (1c): "Where is the login route defined, and what does it call?"
    if (q.includes('login route') || q.includes('login')) {
      if (turnLength === 1) {
        return {
          provider: 'mock',
          toolCalls: [{
            id: 'mock-search-login',
            name: 'searchCode',
            args: { query: 'login' }
          }]
        };
      }
      if (turnLength === 3) {
        return {
          provider: 'mock',
          toolCalls: [{
            id: 'mock-read-server',
            name: 'readFile',
            args: { path: 'backend/server.js' }
          }]
        };
      }
      return {
        provider: 'mock',
        text: "Likely Answer / Likely Cause\nNo login route exists in server.js.\n\nEvidence\n- backend/server.js: line 63\n\nConfidence\nHigh"
      };
    }

    // Query C (1c): "What is the JWT secret used by this backend?"
    if (q.includes('jwt secret') || q.includes('jwt_secret') || (q.includes('what is') && q.includes('jwt') && q.includes('secret'))) {
      if (turnLength === 1) {
        return {
          provider: 'mock',
          toolCalls: [{
            id: 'mock-search-jwt',
            name: 'searchCode',
            args: { query: 'JWT_SECRET' }
          }]
        };
      }
      if (turnLength === 3) {
        return {
          provider: 'mock',
          toolCalls: [{
            id: 'mock-read-server-jwt',
            name: 'readFile',
            args: { path: 'backend/server.js' }
          }]
        };
      }
      return {
        provider: 'mock',
        text: "Likely Answer / Likely Cause\nThe JWT secret is configured in the environment variables.\n\nEvidence\n- backend/server.js\n\nConfidence\nHigh"
      };
    }

    // Query B (1c): "What is JWT?" (must NOT call any repo tool)
    if (q.includes('jwt')) {
      return {
        provider: 'mock',
        text: "JWT stands for JSON Web Token. It is a compact, URL-safe means of representing claims to be transferred between two parties."
      };
    }

    // Default mock response
    return {
      provider: 'mock',
      text: "Mock response for query: " + lastUserMessage
    };
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
    return await withTimeout(
      provModule.generateResponse({
        messages,
        systemPrompt,
        tools,
        maxTokens: AI_CONFIG.MAX_OUTPUT_TOKENS
      }),
      AI_CONFIG.REQUEST_TIMEOUT_MS,
      `${providerName} request timed out.`
    );
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
