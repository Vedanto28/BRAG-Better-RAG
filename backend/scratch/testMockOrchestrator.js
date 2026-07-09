import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const currentFilePath = fileURLToPath(import.meta.url);
const scratchDir = path.dirname(currentFilePath);
const projectRoot = path.resolve(scratchDir, '..', '..');

// Configure environments
const rootEnvPath = path.resolve(projectRoot, '.env');
const backendEnvPath = path.resolve(projectRoot, 'backend', '.env');
dotenv.config({ path: backendEnvPath });
dotenv.config({ path: rootEnvPath });

// Enable Mock LLM mode
process.env.MOCK_LLM = 'true';
process.env.REPO_ROOT_PATH = projectRoot;

// Import app after env is configured
import app from '../server.js';

const TEST_PORT = 5005;
let serverInstance;

function startServer() {
  return new Promise((resolve) => {
    process.env.PORT = TEST_PORT;
    serverInstance = app.listen(TEST_PORT, () => {
      console.log(`[Mock Test Server] Started on port ${TEST_PORT}`);
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (serverInstance) {
      serverInstance.close(() => {
        console.log('[Mock Test Server] Stopped.');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

const tests = [
  {
    name: "Query A: Login Route",
    query: "Where is the login route defined, and what does it call?",
    expectedMode: "debugging_investigation",
    expectTools: true
  },
  {
    name: "Query B: What is JWT?",
    query: "What is JWT?",
    expectedMode: "debugging_investigation",
    expectTools: false
  },
  {
    name: "Query C: JWT Secret",
    query: "What is the JWT secret used by this backend?",
    expectedMode: "debugging_investigation",
    expectTools: true
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

    console.log(`Answer:\n${data.answer}`);
    console.log(`Metadata:`, JSON.stringify(data.metadata, null, 2));

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
  }

  console.log(`\n==================================================`);
  console.log(`MOCK TEST RUN SUMMARY`);
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
