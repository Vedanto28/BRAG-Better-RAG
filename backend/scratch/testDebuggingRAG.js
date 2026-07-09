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

// Retrieve the MOCK_LLM environment variable (default to false if not set)
const mockMode = process.env.MOCK_LLM === 'true';
process.env.REPO_ROOT_PATH = projectRoot;

console.log(`[Test Script] Initialized. Mock LLM Mode: ${mockMode}`);

// Import app after env is configured
import app from '../server.js';

const TEST_PORT = 5007;
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

const tests = [
  {
    name: "Test A: Login ECONNREFUSED (General)",
    query: "My login keeps failing with ECONNREFUSED. What could be going on?",
    expectedMode: "debugging_investigation",
    expectTools: false,
    expectedMatchedIds: ["db-001"]
  },
  {
    name: "Test B: DB Connection Failure (Project-Specific)",
    query: "This project's database connection is failing with ECONNREFUSED on startup. Investigate why.",
    expectedMode: "debugging_investigation",
    expectTools: true,
    expectedMatchedIds: ["db-001"]
  },
  {
    name: "Test C: What is CORS? (General)",
    query: "What is CORS?",
    expectedMode: "debugging_investigation", // Matches CORS category
    expectTools: false,
    expectedMatchedIds: ["cors-001", "cors-002", "cors-003", "cors-004"]
  },
  {
    name: "Test D: Environment Variable Undefined (Project-Specific)",
    query: "This backend says an environment variable is undefined during startup. Investigate.",
    expectedMode: "debugging_investigation",
    expectTools: true,
    expectedMatchedIds: ["env-001"]
  }
];

async function runTest(testObj) {
  const baseUrl = `http://localhost:${TEST_PORT}`;
  console.log(`\n--------------------------------------------------`);
  console.log(`RUNNING: ${testObj.name}`);
  console.log(`Query: "${testObj.query}"`);
  console.log(`--------------------------------------------------`);

  try {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: testObj.query })
    });

    const data = await res.json();
    if (!res.ok) {
      console.error(`FAIL: API returned status ${res.status}`);
      return false;
    }

    console.log(`\n--- Answer ---`);
    console.log(data.answer);
    console.log(`\n--- Metadata ---`);
    console.log(JSON.stringify(data.metadata, null, 2));

    // Validations
    if (data.metadata.mode !== testObj.expectedMode) {
      console.error(`FAIL: Expected mode "${testObj.expectedMode}", got "${data.metadata.mode}"`);
      return false;
    }

    const hasTools = data.metadata.toolsUsed.length > 0;
    if (hasTools !== testObj.expectTools) {
      console.error(`FAIL: Expected tools used? ${testObj.expectTools}, got toolsUsed:`, data.metadata.toolsUsed);
      return false;
    }

    // Verify at least one of the expected IDs matched in debuggingMatches RAG
    const matchedIntersection = data.metadata.debuggingMatches.filter(id => testObj.expectedMatchedIds.includes(id));
    if (matchedIntersection.length === 0) {
      console.error(`FAIL: None of expected debugging IDs [${testObj.expectedMatchedIds.join(', ')}] were in RAG matches:`, data.metadata.debuggingMatches);
      return false;
    }

    console.log("STATUS: PASS");
    return true;
  } catch (err) {
    console.error(`ERROR running test ${testObj.name}:`, err);
    return false;
  }
}

async function main() {
  await startServer();

  let passed = 0;
  for (const t of tests) {
    const ok = await runTest(t);
    if (ok) passed++;
    
    // Spacing between requests (useful for real model runs)
    if (!mockMode) {
      console.log("Waiting 35 seconds to cool down API quota...");
      await new Promise(resolve => setTimeout(resolve, 35000));
    }
  }

  console.log(`\n==================================================`);
  console.log(`DEBUGGING RAG TEST RUN SUMMARY`);
  console.log(`Passed: ${passed}/${tests.length}`);
  console.log(`==================================================`);

  await stopServer();

  if (passed === tests.length) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main().catch(async (err) => {
  console.error("Fatal test error:", err);
  await stopServer();
  process.exit(1);
});
