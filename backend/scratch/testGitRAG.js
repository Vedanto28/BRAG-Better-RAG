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

const mockMode = process.env.MOCK_LLM === 'true';
process.env.REPO_ROOT_PATH = projectRoot;

console.log(`[Test Script] Git & Debugging RAG. Mock LLM Mode: ${mockMode}`);

// Import app after env is configured
import app from '../server.js';

const TEST_PORT = 5008;
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
    name: "Test A: What changed in the last few commits?",
    query: "What changed in the last few commits?",
    expectToolsUsed: ["getRecentCommits"]
  },
  {
    name: "Test B: Auth started failing today, did anything change recently?",
    query: "Auth started failing today, did anything change recently?",
    expectToolsUsed: ["getRecentCommits", "inspectCommit", "searchCode"],
    expectCommitsInspected: ["a1b2c3d"]
  },
  {
    name: "Test C: What is a git commit? (Conceptual)",
    query: "What is a git commit?",
    expectToolsUsed: []
  },
  {
    name: "Test D: Database connection broke after the last commit, why?",
    query: "This project's database connection broke after the last commit, why?",
    expectToolsUsed: ["getRecentCommits", "inspectCommit", "searchCode"],
    expectCommitsInspected: ["f5e4d3c"]
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

    // Assert tools used
    const actualTools = data.metadata.toolsUsed || [];
    for (const expectedTool of testObj.expectToolsUsed) {
      if (!actualTools.includes(expectedTool)) {
        console.error(`FAIL: Expected tool "${expectedTool}" was not in toolsUsed:`, actualTools);
        return false;
      }
    }

    // Assert commits inspected
    const actualCommits = data.metadata.commitsInspected || [];
    const expectedCommits = testObj.expectCommitsInspected || [];
    for (const expectedCommit of expectedCommits) {
      if (!actualCommits.includes(expectedCommit)) {
        console.error(`FAIL: Expected inspected commit "${expectedCommit}" was not in commitsInspected:`, actualCommits);
        return false;
      }
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
    
    if (!mockMode) {
      console.log("Waiting 35 seconds to cool down API quota...");
      await new Promise(resolve => setTimeout(resolve, 35000));
    }
  }

  console.log(`\n==================================================`);
  console.log(`GIT RAG TEST RUN SUMMARY`);
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
