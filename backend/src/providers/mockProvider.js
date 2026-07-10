/**
 * mockProvider.js
 *
 * MOCK-ONLY MODULE: This file is only reachable when process.env.MOCK_LLM === 'true'.
 * It is imported conditionally by providerInterface.js and must never be executed
 * in a production environment.
 *
 * Contains scenario-specific mock response handlers matched by query content.
 * Each handler is designed for a specific test scenario (labelled with the test name).
 * Handlers are checked in order; the first match wins — ordering is significant.
 *
 * Handler-collision awareness:
 *  - Handlers with two q.includes() conditions are more specific and placed first.
 *  - Broad single-include handlers (e.g. q.includes('login'), q.includes('jwt'))
 *    are placed AFTER all two-condition handlers for the same topic to prevent shadowing.
 *  - The default response at the bottom catches all unmatched queries.
 */

/**
 * Returns a mock LLM response for the given generateResponse arguments.
 * Called only when MOCK_LLM === 'true'.
 *
 * @param {{ messages: Array }} options
 * @returns {{ provider: string, text?: string, toolCalls?: Array }}
 */
export function getMockResponse({ messages }) {
  const lastUserIndex = messages.findLastIndex(m => m.role === 'user');
  const currentTurnMessages = lastUserIndex >= 0 ? messages.slice(lastUserIndex) : messages;
  const turnLength = currentTurnMessages.length;

  console.log(`[Mock LLM] Intercepted generateResponse. Messages count: ${messages.length}, turnLength: ${turnLength}`);
  const lastUserMessage = messages[lastUserIndex]?.content || '';
  const q = lastUserMessage.toLowerCase();

  // 4b Test: Remote PR search via stub external MCP
  if (q.includes("remote pr") && q.includes("database")) {
    if (turnLength === 1) {
      return { provider: 'mock', toolCalls: [{ id: 'mock-ext-pr', name: 'searchPullRequests', args: { query: 'database' } }] };
    }
    return {
      provider: 'mock',
      text: "Hypothesis\n\nRemote PR modified database config.\n\nEvidence\n\n- Remote/External: PR #101 ('Fix issue matching database') was merged recently.\n\nAssessment\n\nVerified via remote PR search.\n\nConfidence\n\nHigh"
    };
  }

  // 4b Test: Mixed budget check (internal + stub external until 6 cap is hit)
  if (q.includes("mixed budget check") && q.includes("external")) {
    if (turnLength === 1) {
      return {
        provider: 'mock',
        toolCalls: [
          { id: 'mock-int-read-1', name: 'readFile', args: { path: 'README.md' } },
          { id: 'mock-ext-pr-2', name: 'searchPullRequests', args: { query: 'step-2' } }
        ]
      };
    }
    if (turnLength === 4) {
      return {
        provider: 'mock',
        toolCalls: [
          { id: 'mock-int-read-3', name: 'readFile', args: { path: 'README.md' } },
          { id: 'mock-ext-pr-4', name: 'searchPullRequests', args: { query: 'step-4' } }
        ]
      };
    }
    if (turnLength === 7) {
      return {
        provider: 'mock',
        toolCalls: [
          { id: 'mock-int-read-5', name: 'readFile', args: { path: 'README.md' } },
          { id: 'mock-ext-pr-6', name: 'searchPullRequests', args: { query: 'step-6' } }
        ]
      };
    }
    if (turnLength === 10) {
      return {
        provider: 'mock',
        toolCalls: [
          { id: 'mock-mix-blocked-7', name: 'searchPullRequests', args: { query: 'blocked-7' } }
        ]
      };
    }
    return {
      provider: 'mock',
      text: "Hypothesis\n\nInvestigation reached cap.\n\nEvidence\n\n- Remote/External: Checked PRs.\n\nAssessment\n\nCap reached.\n\nConfidence\n\nMedium"
    };
  }

  // 3b Test A: Full combined incident
  // turnLength per step: 1 (start) -> 3 (after 1 tool) -> 5 (after 2) -> 7 (after 3) -> 9 (after 4) -> text
  if (q.includes("lost after last commit") && q.includes("server.js:15:8")) {
    if (turnLength === 1) {
      return { provider: 'mock', toolCalls: [{ id: 'mock-3b-parse-log', name: 'parseErrorLog', args: { logText: lastUserMessage } }] };
    }
    if (turnLength === 3) {
      return { provider: 'mock', toolCalls: [{ id: 'mock-3b-git-log', name: 'getRecentCommits', args: { limit: 5 } }] };
    }
    if (turnLength === 5) {
      return { provider: 'mock', toolCalls: [{ id: 'mock-3b-git-show', name: 'inspectCommit', args: { commitHash: 'a1b2c3d' } }] };
    }
    if (turnLength === 7) {
      return { provider: 'mock', toolCalls: [{ id: 'mock-3b-read-file', name: 'readFile', args: { path: 'backend/server.js' } }] };
    }
    return {
      provider: 'mock',
      text: "Hypothesis\n\nDatabase connection credentials are missing or incorrect after the last commit.\n\nEvidence\n\n- Log: Error: Database connection lost\n- Code: backend/server.js - connectDB is mounted at line 15.\n- Recent changes: commit a1b2c3d: Alice updated authentication configs.\n\nAssessment\n\nThe stack trace points to backend/server.js line 15. Recent commit a1b2c3d modified auth configs but the inspected diff content does not prove that it broke the database connection.\n\nConfidence\n\nMedium\n\nSuggested next check\n\nInspect environment variables and target database host availability."
    };
  }

  // 3b Test B: Insufficient evidence
  if (q.includes("reading 'config'") && q.includes("server.js:10:12")) {
    if (turnLength === 1) {
      return { provider: 'mock', toolCalls: [{ id: 'mock-3b-b-parse', name: 'parseErrorLog', args: { logText: lastUserMessage } }] };
    }
    if (turnLength === 3) {
      return { provider: 'mock', toolCalls: [{ id: 'mock-3b-b-read', name: 'readFile', args: { path: 'backend/server.js' } }] };
    }
    return {
      provider: 'mock',
      text: "Hypothesis\n\nProperty access on undefined 'config' object.\n\nEvidence\n\n- Log: TypeError: Cannot read properties of undefined (reading 'config')\n- Code: backend/server.js\n\nAssessment\n\nThe log references server.js, but our code verification was inconclusive because we could not inspect the environment values.\n\nConfidence\n\nLow\n\nSuggested next check\n\nInspect local environment variable configuration and verify if process.env.PORT is defined."
    };
  }

  // 3b Test C: Global tool cap (requires more than 6 calls)
  // turnLength per step:
  //   1  -> parseErrorLog (1 call, toolCallCount=1)
  //   3  -> getRecentCommits+inspectCommit (2 calls, toolCallCount=3)
  //         [user, asst(1), tool(1)] = 3
  //   6  -> searchCode+readFile+listRepositoryFiles (3 calls, toolCallCount=6)
  //         [user, asst(1), tool(1), asst(2), tool(2a), tool(2b)] = 6
  //   10 -> attempt readFile (1 call, BLOCKED, toolCallCount stays 6)
  //         [user, asst(1), tool(1), asst(2), t, t, asst(3), t, t, t] = 10
  //   12 -> after blocked result pushed, model gets final text call
  //         [... , asst(4blocked), tool(blocked)] = 12
  if (q.includes("trigger tool cap") && q.includes("server.js:5:5")) {
    if (turnLength === 1) {
      return { provider: 'mock', toolCalls: [{ id: 'mock-cap-1', name: 'parseErrorLog', args: { logText: lastUserMessage } }] };
    }
    if (turnLength === 3) {
      return {
        provider: 'mock',
        toolCalls: [
          { id: 'mock-cap-2', name: 'getRecentCommits', args: { limit: 5 } },
          { id: 'mock-cap-3', name: 'inspectCommit', args: { commitHash: 'a1b2c3d' } }
        ]
      };
    }
    if (turnLength === 6) {
      return {
        provider: 'mock',
        toolCalls: [
          { id: 'mock-cap-4', name: 'searchCode', args: { query: 'connect' } },
          { id: 'mock-cap-5', name: 'readFile', args: { path: 'backend/server.js' } },
          { id: 'mock-cap-6', name: 'listRepositoryFiles', args: { subPath: 'backend/src' } }
        ]
      };
    }
    // At turnLength 10+, the cap is reached (toolCallCount=6), attempt a 7th call that will be BLOCKED
    if (turnLength === 10) {
      return { provider: 'mock', toolCalls: [{ id: 'mock-cap-7', name: 'readFile', args: { path: 'backend/src/routes/chatRouter.js' } }] };
    }
    // Fallthrough: after blocked call result, model returns final answer
    return {
      provider: 'mock',
      text: "Hypothesis\n\nApplication crash due to multiple config conflicts.\n\nEvidence\n\n- Log: Error: Trigger tool cap incident\n- Code: backend/server.js\n- Recent changes: commit a1b2c3d: refactored auth\n\nAssessment\n\nThe investigation was stopped due to reaching the tool call limit. The gathered evidence shows conflicts in server.js but is not yet fully conclusive.\n\nConfidence\n\nLow\n\nSuggested next check\n\nReview server.js startup dependencies step-by-step."
    };
  }

  // 3a Test A: Node.js stack trace referencing backend/server.js:25:20
  // NOTE: Two-condition check — placed before 3a Test B (broader lines>=5 check) to prevent shadowing.
  if (q.includes("typeerror") && q.includes("server.js:25:20")) {
    if (turnLength === 1) {
      return { provider: 'mock', toolCalls: [{ id: 'mock-parse-log-a', name: 'parseErrorLog', args: { logText: lastUserMessage } }] };
    }
    if (turnLength === 3) {
      return { provider: 'mock', toolCalls: [{ id: 'mock-read-server-trace', name: 'readFile', args: { path: 'backend/server.js' } }] };
    }
    return {
      provider: 'mock',
      text: "Hypothesis\n\nDatabase connection issue or Server port access failure in server.js.\n\nEvidence\n\n- Log: TypeError: Cannot read properties of undefined (reading 'foo')\n- Code: backend/server.js - startServer initialization is on lines 25-30.\n\nAssessment\n\nThe stack trace points to backend/server.js line 25. Inspected code shows startServer fails due to a missing configuration check.\n\nConfidence\n\nHigh"
    };
  }

  // 3a Test B: Repeated error logs (broad check — must come after 3a Test A)
  if (q.includes("typeerror") && (lastUserMessage.split('\n').length >= 5)) {
    if (turnLength === 1) {
      return { provider: 'mock', toolCalls: [{ id: 'mock-parse-log-b', name: 'parseErrorLog', args: { logText: lastUserMessage } }] };
    }
    return {
      provider: 'mock',
      text: "Hypothesis\n\nRepeated TypeError in application run loop.\n\nEvidence\n\n- Log: TypeError: Cannot read properties of undefined (reading 'foo') (occurred 5 times)\n\nAssessment\n\nThe pasted logs show 5 occurrences of the same TypeError. No codebase verification was performed.\n\nConfidence\n\nHigh"
    };
  }

  // 3a Test D: nonexistent.js stack trace
  if (q.includes("something went wrong") && q.includes("nonexistent.js")) {
    if (turnLength === 1) {
      return { provider: 'mock', toolCalls: [{ id: 'mock-parse-log-d', name: 'parseErrorLog', args: { logText: lastUserMessage } }] };
    }
    if (turnLength === 3) {
      return { provider: 'mock', toolCalls: [{ id: 'mock-read-nonexistent', name: 'readFile', args: { path: 'backend/nonexistent.js' } }] };
    }
    return {
      provider: 'mock',
      text: "Hypothesis\n\nExecution error in nonexistent.js module.\n\nEvidence\n\n- Log: Error: Something went wrong\n\nAssessment\n\nThe stack trace references nonexistent.js, but this file was not found in the repository.\n\nConfidence\n\nMedium"
    };
  }

  // 3a Test C: Connection timeouts (conceptual — no tools)
  if (q.includes("why do i keep getting connection timeouts")) {
    return {
      provider: 'mock',
      text: "Hypothesis\n\ndatabase-connection issue: database service is not running on target host, wrong database port configured, firewall blocking database port access\n\nEvidence\n\nAssessment\n\nPotential issue identified from local debugging knowledge base.\n\nConfidence\n\nLow"
    };
  }

  // 2b Test A / Focus Test D: "What changed recently?" (excludes 'auth' to avoid shadowing auth+failing handler)
  if ((q.includes('what changed') || q.includes('changed recently')) && !q.includes('auth')) {
    if (turnLength === 1) {
      return { provider: 'mock', toolCalls: [{ id: 'mock-get-recent-commits-a', name: 'getRecentCommits', args: { limit: 5 } }] };
    }
    return {
      provider: 'mock',
      text: "Recent commits:\n- f5e4d3c (Author: Alice, Date: 2026-07-09): update config files\n- a1b2c3d (Author: Bob, Date: 2026-07-08): refactor auth middleware"
    };
  }

  // 2b Test B / Focus Test G: Auth started failing / after last commit
  if ((q.includes('auth') || q.includes('authentication')) && (q.includes('failing') || q.includes('change') || q.includes('commit'))) {
    if (turnLength === 1) {
      return { provider: 'mock', toolCalls: [{ id: 'mock-get-recent-commits-b', name: 'getRecentCommits', args: { limit: 5 } }] };
    }
    if (turnLength === 3) {
      return { provider: 'mock', toolCalls: [{ id: 'mock-inspect-commit-b', name: 'inspectCommit', args: { commitHash: 'a1b2c3d' } }] };
    }
    if (turnLength === 5) {
      return { provider: 'mock', toolCalls: [{ id: 'mock-search-auth-b', name: 'searchCode', args: { query: 'jwt.verify' } }] };
    }
    return {
      provider: 'mock',
      text: "Hypothesis\nThe authentication failure is caused by a recent change in token signing or verification config.\n\nEvidence\n- Code: Checked 'jwt.verify' occurrences in codebase.\n- Recent changes: Inspecting commit a1b2c3d (\"refactor auth middleware\") shows that the verification algorithm was changed.\n\nAssessment\nThe recent commit changed the verification algorithm which caused verification to fail.\n\nConfidence\nHigh"
    };
  }

  // 2b Test D: Database connection broke after last commit
  if (q.includes("database connection broke") && q.includes("last commit")) {
    if (turnLength === 1) {
      return { provider: 'mock', toolCalls: [{ id: 'mock-get-recent-commits-d', name: 'getRecentCommits', args: { limit: 5 } }] };
    }
    if (turnLength === 3) {
      return { provider: 'mock', toolCalls: [{ id: 'mock-inspect-commit-d', name: 'inspectCommit', args: { commitHash: 'f5e4d3c' } }] };
    }
    if (turnLength === 5) {
      return { provider: 'mock', toolCalls: [{ id: 'mock-search-db-d', name: 'searchCode', args: { query: 'mongoose.connect' } }] };
    }
    return {
      provider: 'mock',
      text: "Hypothesis\nThe database connection failure was caused by incorrect connection string format introduced in the last commit.\n\nEvidence\n- Code: Found mongoose.connect calls in backend/src/providers/localRepoProvider.js.\n- Recent changes: Inspecting commit f5e4d3c (\"update config files\") shows it changed database port configuration.\n\nAssessment\nThe latest commit changed the DB port to an incorrect value, causing ECONNREFUSED on startup.\n\nConfidence\nHigh"
    };
  }

  // 2b Test C: "What is a git commit?" (conceptual)
  if (q.includes('what is a git commit')) {
    return { provider: 'mock', text: "A git commit is a snapshot of changes saved to the repository history." };
  }

  // 2a Test A: Login keeps failing with ECONNREFUSED
  // NOTE: Two-condition check — placed BEFORE broad q.includes('login') to prevent shadowing.
  if (q.includes('login keeps failing') && q.includes('econnrefused')) {
    return {
      provider: 'mock',
      text: "Hypothesis\nThe backend database or target service port is unavailable or not running.\n\nEvidence\nNo repository evidence was gathered for this answer.\n\nAssessment\nThe database or authentication server might be down. Codebase verification was not requested for this query.\n\nConfidence\nMedium"
    };
  }

  // 2a Test B: Database connection failing with ECONNREFUSED on startup
  // NOTE: Two-condition check — placed BEFORE broad q.includes('database') below.
  if (q.includes("database connection is failing") || (q.includes("database connection") && q.includes("econnrefused") && q.includes("startup"))) {
    if (turnLength === 1) {
      return { provider: 'mock', toolCalls: [{ id: 'mock-search-db', name: 'searchCode', args: { query: 'mongoose.connect' } }] };
    }
    if (turnLength === 3) {
      return { provider: 'mock', toolCalls: [{ id: 'mock-read-server-db', name: 'readFile', args: { path: 'backend/server.js' } }] };
    }
    return {
      provider: 'mock',
      text: "Hypothesis\nThe database URL, host, or port configuration is incorrect, or the DB service is down.\n\nEvidence\n- backend/server.js: searched for 'mongoose.connect' but found no database initialization code.\n\nAssessment\nThe connection fails because there is no database connection code or client initialized in server.js in this repository.\n\nConfidence\nHigh"
    };
  }

  // 2a Test D: Environment variable undefined during startup
  if (q.includes('environment variable is undefined') || (q.includes('variable is undefined') && q.includes('investigate'))) {
    if (turnLength === 1) {
      return { provider: 'mock', toolCalls: [{ id: 'mock-search-dotenv', name: 'searchCode', args: { query: 'dotenv.config' } }] };
    }
    if (turnLength === 3) {
      return { provider: 'mock', toolCalls: [{ id: 'mock-read-server-env', name: 'readFile', args: { path: 'backend/server.js' } }] };
    }
    return {
      provider: 'mock',
      text: "Hypothesis\nThe environment variable configuration .env file is missing or loaded after modules are initialized.\n\nEvidence\n- backend/server.js: lines 15-16 - dotenv.config is configured and loaded relative to backend Dir and root directory.\n\nAssessment\nEnvironment variables are loaded correctly at server startup. Typos in specific env names might cause them to be undefined.\n\nConfidence\nHigh"
    };
  }

  // 2a Test C: "What is CORS?" (conceptual)
  if (q.includes('what is cors')) {
    return {
      provider: 'mock',
      text: "CORS (Cross-Origin Resource Sharing) is a browser security mechanism that restricts web applications from making requests to a different domain than the one that served the application."
    };
  }

  // Query C (1c): JWT secret — two-condition check, placed BEFORE broad q.includes('jwt') below
  if (q.includes('jwt secret') || q.includes('jwt_secret') || (q.includes('what is') && q.includes('jwt') && q.includes('secret'))) {
    if (turnLength === 1) {
      return { provider: 'mock', toolCalls: [{ id: 'mock-search-jwt', name: 'searchCode', args: { query: 'JWT_SECRET' } }] };
    }
    if (turnLength === 3) {
      return { provider: 'mock', toolCalls: [{ id: 'mock-read-server-jwt', name: 'readFile', args: { path: 'backend/server.js' } }] };
    }
    return {
      provider: 'mock',
      text: "Likely Answer / Likely Cause\nThe JWT secret is configured in the environment variables.\n\nEvidence\n- backend/server.js\n\nConfidence\nHigh"
    };
  }

  // Query A (1c): Login route — broad single-condition check
  // COLLISION SAFETY: Placed AFTER two-condition 'login keeps failing' + 'econnrefused' handler above.
  if (q.includes('login route') || q.includes('login')) {
    if (turnLength === 1) {
      return { provider: 'mock', toolCalls: [{ id: 'mock-search-login', name: 'searchCode', args: { query: 'login' } }] };
    }
    if (turnLength === 3) {
      return { provider: 'mock', toolCalls: [{ id: 'mock-read-server', name: 'readFile', args: { path: 'backend/server.js' } }] };
    }
    return {
      provider: 'mock',
      text: "Likely Answer / Likely Cause\nNo login route exists in server.js.\n\nEvidence\n- backend/server.js: line 63\n\nConfidence\nHigh"
    };
  }

  // Query B (1c): "What is JWT?" — broad single-condition check
  // COLLISION SAFETY: Placed AFTER two-condition jwt+secret handler above.
  if (q.includes('jwt')) {
    return {
      provider: 'mock',
      text: "JWT stands for JSON Web Token. It is a compact, URL-safe means of representing claims to be transferred between two parties."
    };
  }

  // Focus Test A: "What is JavaScript?"
  if (q.includes('what is javascript')) {
    return { provider: 'mock', text: "JavaScript is a programming language commonly used for web development." };
  }

  // Focus Test B: "What is RAG?"
  if (q.includes('what is rag')) {
    return { provider: 'mock', text: "RAG stands for Retrieval-Augmented Generation, combining external search with LLM response generation." };
  }

  // Focus Test E: Calculator (multiply / times)
  if (q.includes('multiplied') || q.includes('times')) {
    const numbers = q.match(/\b\d+\b/g);
    if (numbers && numbers.length >= 2) {
      const op1 = parseInt(numbers[0], 10);
      const op2 = parseInt(numbers[1], 10);
      const product = op1 * op2;
      if (turnLength === 1) {
        return {
          provider: 'mock',
          toolCalls: [{ id: 'mock-calc-tool', name: 'calculator', args: { operator: 'multiply', operand1: op1, operand2: op2 } }]
        };
      }
      return { provider: 'mock', text: `${op1} multiplied by ${op2} is ${product}.` };
    }
  }

  // Focus Test F: "What time is it right now?"
  if (q.includes('what time is it')) {
    if (turnLength === 1) {
      return { provider: 'mock', toolCalls: [{ id: 'mock-time-tool', name: 'getCurrentDateTime', args: {} }] };
    }
    return { provider: 'mock', text: "The current server date and time is 2026-07-09 19:40:00 UTC." };
  }

  // Default: catch-all for any unmatched mock query
  return {
    provider: 'mock',
    text: "Mock response for query: " + lastUserMessage
  };
}