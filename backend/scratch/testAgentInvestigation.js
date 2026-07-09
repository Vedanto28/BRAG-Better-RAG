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

// Point REPO_ROOT_PATH to the project's own repository
process.env.REPO_ROOT_PATH = projectRoot;

// Import app after setting env variables
import app from '../server.js';

const TEST_PORT = 5004;
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
    name: "Test A: Login Route Investigation",
    query: "What does the login route call?"
  },
  {
    name: "Test B: Database Connection Configuration",
    query: "Where is the database connection configured?"
  },
  {
    name: "Test C: General Question (JavaScript)",
    query: "What is JavaScript?"
  },
  {
    name: "Test D: Backend Server Start & Port",
    query: "Where is the backend server started, and what port does it use?"
  },
  {
    name: "Test E: Chat Message Flow to LLM",
    query: "How does a chat message travel from the API route to the LLM provider?"
  },
  {
    name: "Test F: Max User Message Length Enforcement",
    query: "Where is the maximum user message length defined and enforced?"
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
      console.error(JSON.stringify(data, null, 2));
      return false;
    }

    console.log(`\n--- Final Response Answer ---`);
    console.log(data.answer);
    console.log(`\n--- Metadata ---`);
    console.log(JSON.stringify(data.metadata, null, 2));
    
    // Check results
    if (testObj.name.includes("Test C")) {
      // Normal query should not use repository tools
      if (data.metadata.mode !== "normal" || data.metadata.toolsUsed.length > 0) {
        console.error("FAIL: General question entered repository investigation mode or used repository tools.");
        return false;
      }
    } else {
      // Repository queries should use repository tools
      if (data.metadata.mode !== "repository_investigation") {
        console.error("FAIL: Repository query did not enter repository_investigation mode.");
        return false;
      }
    }

    console.log(`\nSTATUS: SUCCESS`);
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
    // Add delay to prevent hitting free tier API rate limits (5 RPM)
    await new Promise(r => setTimeout(r, 25000));
  }

  console.log(`\n==================================================`);
  console.log(`TEST RUN SUMMARY`);
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
