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

// Ensure MOCK_LLM is false for real testing
process.env.MOCK_LLM = 'false';
process.env.REPO_ROOT_PATH = projectRoot;

// Import app after env is configured
import app from '../server.js';

const TEST_PORT = 5006;
let serverInstance;

function startServer() {
  return new Promise((resolve) => {
    process.env.PORT = TEST_PORT;
    serverInstance = app.listen(TEST_PORT, () => {
      console.log(`[Real Test Server] Started on port ${TEST_PORT}`);
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (serverInstance) {
      serverInstance.close(() => {
        console.log('[Real Test Server] Stopped.');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

const tests = [
  {
    name: "Query A: Login Route (Real)",
    query: "Where is the login route defined, and what does it call?"
  },
  {
    name: "Query B: What is JWT? (Real)",
    query: "What is JWT?"
  },
  {
    name: "Query C: JWT Secret (Real)",
    query: "What is the JWT secret used by this backend?"
  }
];

async function runTest(testObj) {
  const baseUrl = `http://localhost:${TEST_PORT}`;
  console.log(`\n==================================================`);
  console.log(`RUNNING: ${testObj.name}`);
  console.log(`Query: "${testObj.query}"`);
  console.log(`==================================================`);

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
    // Generous delay to prevent free tier rate limits (5 requests per minute)
    console.log("Waiting 35 seconds for API limits cooling...");
    await new Promise(r => setTimeout(r, 35000));
  }

  console.log(`\n==================================================`);
  console.log(`REAL TEST RUN SUMMARY`);
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
