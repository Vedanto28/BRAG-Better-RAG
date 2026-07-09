import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const currentFilePath = fileURLToPath(import.meta.url);
const scratchDir = path.dirname(currentFilePath);
const projectRoot = path.resolve(scratchDir, '..', '..');

// Configure environment
const rootEnvPath = path.resolve(projectRoot, '.env');
const backendEnvPath = path.resolve(projectRoot, 'backend', '.env');
dotenv.config({ path: backendEnvPath });
dotenv.config({ path: rootEnvPath });

// Ensure we don't run in real mock LLM mode for these integration hooks
process.env.MOCK_LLM = 'false';
process.env.REPO_ROOT_PATH = projectRoot;

// Import app
import app from '../server.js';

const TEST_PORT = 5010;
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
}

const baseUrl = `http://localhost:${TEST_PORT}`;

async function runTestA() {
  console.log("\n==================================================");
  console.log("RUNNING Test A: General RAG context fallback when both fail");
  console.log("==================================================");
  clearHooks();
  process.env.TEST_GEMINI_FAIL_ALL = 'true';
  process.env.TEST_OPENAI_FAIL_ALL = 'true';

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: "What is JavaScript?" })
  });

  const data = await res.json();
  console.log("Answer:", data.answer);
  console.log("Metadata:", data.metadata);

  if (data.metadata.provider !== 'fallback') {
    throw new Error(`Expected provider 'fallback', got '${data.metadata.provider}'`);
  }
  if (!data.answer.includes("General BRAG Knowledge") && !data.answer.toLowerCase().includes("javascript")) {
    throw new Error("Expected answer to contain general RAG knowledge about JavaScript.");
  }
  console.log("Test A: PASS");
}

async function runTestB() {
  console.log("\n==================================================");
  console.log("RUNNING Test B: Debugging RAG matches fallback hypothesis");
  console.log("==================================================");
  clearHooks();
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

  if (data.metadata.provider !== 'fallback') {
    throw new Error(`Expected provider 'fallback', got '${data.metadata.provider}'`);
  }
  if (!data.answer.startsWith("Hypothesis")) {
    throw new Error("Expected fallback answer to start with structured Hypothesis format.");
  }
  if (!data.answer.includes("No repository evidence was gathered for this answer.")) {
    throw new Error("Expected answer to clearly state no repository evidence was gathered.");
  }
  console.log("Test B: PASS");
}

async function runTestC() {
  console.log("\n==================================================");
  console.log("RUNNING Test C: No RAG match fallback message");
  console.log("==================================================");
  clearHooks();
  process.env.TEST_GEMINI_FAIL_ALL = 'true';
  process.env.TEST_OPENAI_FAIL_ALL = 'true';

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: "What is the population of Paris?" })
  });

  const data = await res.json();
  console.log("Answer:", data.answer);
  console.log("Metadata:", data.metadata);

  if (data.metadata.provider !== 'fallback') {
    throw new Error(`Expected provider 'fallback', got '${data.metadata.provider}'`);
  }
  if (data.answer !== "The AI provider is temporarily unavailable. Please try again later.") {
    throw new Error(`Expected provider-unavailable message, got '${data.answer}'`);
  }
  console.log("Test C: PASS");
}

async function runTestD() {
  console.log("\n==================================================");
  console.log("RUNNING Test D: Gemini transient 503 retry sequence");
  console.log("==================================================");
  clearHooks();
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

  if (data.answer !== "Success response after retries!") {
    throw new Error(`Expected success message, got '${data.answer}'`);
  }
  if (data.metadata.provider !== 'gemini') {
    throw new Error(`Expected provider 'gemini', got '${data.metadata.provider}'`);
  }
  // Attempts: 1st (succeeds/fails after 1s delay), 2nd (delay 2s), 3rd (succeeds)
  // Total delay should be at least 3000ms
  if (duration < 3000) {
    throw new Error(`Expected retry backoff delay of at least 3000ms, but request took ${duration}ms`);
  }
  console.log("Test D: PASS");
}

async function runTestE() {
  console.log("\n==================================================");
  console.log("RUNNING Test E: Verify permanent Gemini errors are not retried");
  console.log("==================================================");
  clearHooks();
  process.env.TEST_GEMINI_PERMANENT_ERROR = 'true';
  process.env.TEST_OPENAI_FAIL_ALL = 'true';

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

  if (data.metadata.provider !== 'fallback') {
    throw new Error(`Expected provider 'fallback', got '${data.metadata.provider}'`);
  }
  // Permanent errors should fail instantly without sleeping/retrying (duration should be very short, e.g. < 1500ms)
  if (duration > 1500) {
    throw new Error(`Expected no retries and quick exit, but request took ${duration}ms`);
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
    console.log("ALL TESTS A-E PASSED SUCCESSFULLY!");
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
