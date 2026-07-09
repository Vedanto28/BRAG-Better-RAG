import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const currentFilePath = fileURLToPath(import.meta.url);
const scratchDir = path.dirname(currentFilePath);
const projectRoot = path.resolve(scratchDir, '..', '..');

const rootEnvPath = path.resolve(projectRoot, '.env');
const backendEnvPath = path.resolve(projectRoot, 'backend', '.env');
dotenv.config({ path: backendEnvPath });
dotenv.config({ path: rootEnvPath });

// Ensure non-mocked provider layer (but we control mock hooks via env variables)
process.env.MOCK_LLM = 'false';
process.env.REPO_ROOT_PATH = projectRoot;

// Set up global trackers
global.__geminiTestTracker = { attempts: 0 };
global.__mcpTestTracker = { invocations: 0 };

import app from '../server.js';
import { AI_CONFIG } from '../src/utils/config.js';

const TEST_PORT = 5013;
let serverInstance;

function startServer() {
  return new Promise((resolve) => {
    process.env.PORT = TEST_PORT;
    serverInstance = app.listen(TEST_PORT, () => {
      console.log(`[Test Server] Started on port ${TEST_PORT}`);
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (serverInstance) {
      serverInstance.close(() => {
        console.log('[Test Server] Stopped.');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

function clearHooks() {
  delete process.env.TEST_GEMINI_FAIL_ALL;
  delete process.env.TEST_OPENAI_FAIL_ALL;
  delete process.env.TEST_GEMINI_RETRY_SEQUENCE;
  delete process.env.TEST_GEMINI_PERMANENT_ERROR;
  delete process.env.TEST_GEMINI_429_ERROR;
  global.__geminiTestTracker.attempts = 0;
  global.__mcpTestTracker.invocations = 0;
}

const baseUrl = `http://localhost:${TEST_PORT}`;

// Helper to sleep
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runTestA() {
  console.log("\n==================================================");
  console.log("RUNNING Test A: A timed-out Gemini request performs zero additional API attempts after timeout");
  console.log("==================================================");
  clearHooks();

  // Save config
  const originalTimeout = AI_CONFIG.REQUEST_TIMEOUT_MS;
  // Set low timeout (e.g. 300ms)
  AI_CONFIG.REQUEST_TIMEOUT_MS = 300;

  // Let OpenAI fail immediately so we force fallback
  process.env.TEST_OPENAI_FAIL_ALL = 'true';

  // We want Gemini to hang/delay so it times out. We can simulate a long 503 retry sequence or similar.
  // Let's make Gemini retry sequence run, which sleeps for 1000ms between attempts, causing it to exceed 300ms timeout
  process.env.TEST_GEMINI_RETRY_SEQUENCE = 'true';

  const startTime = Date.now();
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: "What is JavaScript?" })
  });
  const duration = Date.now() - startTime;

  const data = await res.json();
  console.log("Answer:", data.answer);
  console.log("Metadata:", data.metadata);
  console.log(`Duration: ${duration}ms`);
  console.log(`Gemini Attempts recorded during request: ${global.__geminiTestTracker.attempts}`);

  // Restore config
  AI_CONFIG.REQUEST_TIMEOUT_MS = originalTimeout;

  // Wait 1.5 seconds to see if any background attempts occur
  console.log("Sleeping 1500ms to verify no additional attempts run in the background...");
  await sleep(1500);
  console.log(`Total Gemini Attempts after waiting: ${global.__geminiTestTracker.attempts}`);

  // Test A Assertions:
  // 1. Should fall back to OpenAI (which fails) -> then fallback answer
  if (data.metadata.provider !== 'fallback') {
    throw new Error(`Expected provider 'fallback', got '${data.metadata.provider}'`);
  }
  // 2. Attempts should be exactly 1, because the first attempt timed out and the rest were aborted!
  if (global.__geminiTestTracker.attempts !== 1) {
    throw new Error(`Expected exactly 1 Gemini attempt, but got ${global.__geminiTestTracker.attempts}`);
  }

  console.log("Test A: PASS");
}

async function runTestB() {
  console.log("\n==================================================");
  console.log("RUNNING Test B: HTTP 429 performs exactly one Gemini attempt");
  console.log("==================================================");
  clearHooks();

  process.env.TEST_GEMINI_429_ERROR = 'true';
  process.env.TEST_OPENAI_FAIL_ALL = 'true';

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: "What is JavaScript?" })
  });

  const data = await res.json();
  console.log("Answer:", data.answer);
  console.log("Metadata:", data.metadata);
  console.log(`Gemini Attempts: ${global.__geminiTestTracker.attempts}`);

  // Test B Assertions:
  // 1. Should have exactly 1 attempt
  if (global.__geminiTestTracker.attempts !== 1) {
    throw new Error(`Expected exactly 1 Gemini attempt for 429, got ${global.__geminiTestTracker.attempts}`);
  }
  // 2. Should fall back
  if (data.metadata.provider !== 'fallback') {
    throw new Error(`Expected provider 'fallback', got '${data.metadata.provider}'`);
  }

  console.log("Test B: PASS");
}

async function runTestC() {
  console.log("\n==================================================");
  console.log("RUNNING Test C: HTTP 503 may perform at most three total attempts");
  console.log("==================================================");
  clearHooks();

  process.env.TEST_GEMINI_RETRY_SEQUENCE = 'true';

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: "What is JavaScript?" })
  });

  const data = await res.json();
  console.log("Answer:", data.answer);
  console.log("Metadata:", data.metadata);
  console.log(`Gemini Attempts: ${global.__geminiTestTracker.attempts}`);

  // Test C Assertions:
  // 1. Attempts should be exactly 3
  if (global.__geminiTestTracker.attempts !== 3) {
    throw new Error(`Expected exactly 3 Gemini attempts for 503 sequence, got ${global.__geminiTestTracker.attempts}`);
  }
  // 2. Should succeed on attempt 3
  if (data.metadata.provider !== 'gemini') {
    throw new Error(`Expected provider 'gemini', got '${data.metadata.provider}'`);
  }
  if (data.answer !== "Success response after retries!") {
    throw new Error(`Expected 'Success response after retries!', got '${data.answer}'`);
  }

  console.log("Test C: PASS");
}

async function runTestD() {
  console.log("\n==================================================");
  console.log("RUNNING Test D: knowledge_debugging does not initialize MCP");
  console.log("==================================================");
  clearHooks();

  // Route as knowledge_debugging: "My database connection fails with ECONNREFUSED on startup."
  // Set both LLMs to fail so we check fallback, but the mode is knowledge_debugging
  process.env.TEST_GEMINI_FAIL_ALL = 'true';
  process.env.TEST_OPENAI_FAIL_ALL = 'true';

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: "My database connection fails with ECONNREFUSED on startup." })
  });

  const data = await res.json();
  console.log("Answer:", data.answer);
  console.log("Metadata:", data.metadata);
  console.log(`MCP Invocations: ${global.__mcpTestTracker.invocations}`);

  // Test D Assertions:
  if (data.metadata.mode !== 'knowledge_debugging') {
    throw new Error(`Expected mode 'knowledge_debugging', got '${data.metadata.mode}'`);
  }
  if (global.__mcpTestTracker.invocations !== 0) {
    throw new Error(`Expected 0 MCP client invocations, got ${global.__mcpTestTracker.invocations}`);
  }

  console.log("Test D: PASS");
}

async function runTestE() {
  console.log("\n==================================================");
  console.log("RUNNING Test E: repository_investigation and change_investigation still initialize MCP");
  console.log("==================================================");
  clearHooks();

  // Test repository_investigation
  const resRepo = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: "Where is the login route defined, and what does it call?" })
  });
  const dataRepo = await resRepo.json();
  const mcpInvocationsAfterRepo = global.__mcpTestTracker.invocations;
  console.log("Repo Query Mode:", dataRepo.metadata.mode);
  console.log("MCP Invocations after Repo Query:", mcpInvocationsAfterRepo);

  if (dataRepo.metadata.mode !== 'repository_investigation') {
    throw new Error(`Expected mode 'repository_investigation', got '${dataRepo.metadata.mode}'`);
  }
  if (mcpInvocationsAfterRepo === 0) {
    throw new Error(`Expected MCP client invocations to be > 0, got ${mcpInvocationsAfterRepo}`);
  }

  // Clear and test change_investigation
  clearHooks();
  const resChange = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: "Why did authentication start failing after the last commit?" })
  });
  const dataChange = await resChange.json();
  const mcpInvocationsAfterChange = global.__mcpTestTracker.invocations;
  console.log("Change Query Mode:", dataChange.metadata.mode);
  console.log("MCP Invocations after Change Query:", mcpInvocationsAfterChange);

  if (dataChange.metadata.mode !== 'change_investigation') {
    throw new Error(`Expected mode 'change_investigation', got '${dataChange.metadata.mode}'`);
  }
  if (mcpInvocationsAfterChange === 0) {
    throw new Error(`Expected MCP client invocations to be > 0, got ${mcpInvocationsAfterChange}`);
  }

  console.log("Test E: PASS");
}

async function main() {
  await startServer();
  try {
    await runTestA();
    await runTestB();
    await runTestC();
    await runTestD();
    await runTestE();
    console.log("\n==================================================");
    console.log("ALL FOCUS TESTS A-E PASSED SUCCESSFULLY!");
    console.log("==================================================");
    clearHooks();
    await stopServer();
    process.exit(0);
  } catch (error) {
    console.error("\nTEST RUN FAILED:", error.message || error);
    clearHooks();
    await stopServer();
    process.exit(1);
  }
}

main();
