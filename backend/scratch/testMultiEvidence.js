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

// Force Mock LLM mode for plumbing/correctness checks
process.env.MOCK_LLM = 'true';
process.env.REPO_ROOT_PATH = projectRoot;

// Import server/app after env configuration
import app from '../server.js';

const TEST_PORT = 5015;
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
      const timer = setTimeout(() => {
        console.log('[Test Server] Force stopped due to active connections.');
        resolve();
      }, 1000);
      serverInstance.close(() => {
        clearTimeout(timer);
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
    name: "Test A: Full combined incident",
    query: `Error: Database connection lost after last commit
    at connectDB (backend/server.js:15:8)`,
    expectedMode: "log_investigation",
    expectedToolsUsed: ["parseErrorLog", "getRecentCommits", "inspectCommit", "readFile"],
    expectedToolCallsUsed: 4,
    expectedLimitReached: false,
    expectedConfidence: "Medium",
    requiredEvidenceLines: ["- Log:", "- Code:", "- Recent changes:"],
    forbiddenEvidenceLines: []
  },
  {
    name: "Test B: Insufficient evidence incident",
    query: `TypeError: Cannot read properties of undefined (reading 'config')
    at Object.<anonymous> (backend/server.js:10:12)`,
    expectedMode: "log_investigation",
    expectedToolsUsed: ["parseErrorLog", "readFile"],
    expectedToolCallsUsed: 2,
    expectedLimitReached: false,
    expectedConfidence: "Low",
    requiredEvidenceLines: ["- Log:", "- Code:"],
    forbiddenEvidenceLines: ["- Recent changes:"]
  },
  {
    name: "Test C: Global tool cap check (6 calls maximum)",
    query: `Trigger tool cap incident
    at run (backend/server.js:5:5)`,
    expectedMode: "log_investigation",
    expectedToolsUsed: ["parseErrorLog", "getRecentCommits", "inspectCommit", "searchCode", "readFile", "listRepositoryFiles"],
    expectedToolCallsUsed: 6,
    expectedLimitReached: true,
    expectedConfidence: "Low",
    requiredEvidenceLines: ["- Log:", "- Code:", "- Recent changes:"],
    forbiddenEvidenceLines: []
  }
];

const routingTests = [
  { query: "Hi, who developed Node.js?", expectedMode: "normal_chat" },
  { query: "My server keeps crashing on startup with a timeout error.", expectedMode: "knowledge_debugging" },
  { query: "Where is the login route defined, and what does it call?", expectedMode: "repository_investigation" },
  { query: "What changed recently in the repository?", expectedMode: "change_investigation" },
  { query: "TypeError: Cannot read properties of undefined (reading 'foo')\n    at run (backend/server.js:5:5)", expectedMode: "log_investigation" },
  { query: "What time is it right now?", expectedMode: "utility_tool" }
];

async function runTest(testObj) {
  console.log(`\n==================================================`);
  console.log(`RUNNING: ${testObj.name}`);
  console.log(`==================================================`);

  try {
    const res = await fetch(`http://localhost:${TEST_PORT}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: testObj.query })
    });

    if (!res.ok) {
      console.error(`FAIL: API returned status ${res.status}`);
      return false;
    }

    const data = await res.json();

    console.log(`\n--- Answer ---`);
    console.log(data.answer);
    console.log(`\n--- Metadata ---`);
    console.log(JSON.stringify(data.metadata, null, 2));

    // Validations:
    // 1. Validate Mode
    if (data.metadata.mode !== testObj.expectedMode) {
      console.error(`FAIL: Expected mode "${testObj.expectedMode}", got "${data.metadata.mode}"`);
      return false;
    }

    // 2. Validate toolCallsUsed & toolCallLimitReached
    if (data.metadata.toolCallsUsed !== testObj.expectedToolCallsUsed) {
      console.error(`FAIL: Expected toolCallsUsed ${testObj.expectedToolCallsUsed}, got ${data.metadata.toolCallsUsed}`);
      return false;
    }
    if (data.metadata.toolCallLimitReached !== testObj.expectedLimitReached) {
      console.error(`FAIL: Expected toolCallLimitReached ${testObj.expectedLimitReached}, got ${data.metadata.toolCallLimitReached}`);
      return false;
    }

    // 3. Validate toolsUsed contents
    for (const tool of testObj.expectedToolsUsed) {
      if (!data.metadata.toolsUsed.includes(tool)) {
        console.error(`FAIL: Expected toolsUsed to include "${tool}"`);
        return false;
      }
    }

    // 4. Validate output format section presence
    if (testObj.expectedLimitReached) {
      if (!data.answer.includes("Investigation stopped after reaching the tool-call limit; evidence gathered so far is below.")) {
        console.error(`FAIL: Expected tool-call limit reached message inside final answer.`);
        return false;
      }
    }

    // 5. Evidence lines validation
    for (const reqLine of testObj.requiredEvidenceLines) {
      if (!data.answer.includes(reqLine)) {
        console.error(`FAIL: Expected Evidence section to contain "${reqLine}"`);
        return false;
      }
    }
    for (const forbiddenLine of testObj.forbiddenEvidenceLines) {
      if (data.answer.includes(forbiddenLine)) {
        console.error(`FAIL: Expected Evidence section to NOT contain "${forbiddenLine}"`);
        return false;
      }
    }

    // 6. Confidence validation
    if (!data.answer.includes(`Confidence\n\n${testObj.expectedConfidence}`) && !data.answer.includes(`Confidence\n${testObj.expectedConfidence}`)) {
      console.error(`FAIL: Expected Confidence "${testObj.expectedConfidence}" inside final answer.`);
      return false;
    }

    console.log("STATUS: PASS");
    return true;
  } catch (err) {
    console.error(`ERROR running test ${testObj.name}:`, err);
    return false;
  }
}

async function runRoutingTests() {
  console.log(`\n==================================================`);
  console.log(`RUNNING ROUTING REGRESSION TESTS`);
  console.log(`==================================================`);

  let allPassed = true;
  for (const t of routingTests) {
    try {
      const res = await fetch(`http://localhost:${TEST_PORT}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: t.query })
      });
      const data = await res.json();
      if (data.metadata.mode === t.expectedMode) {
        console.log(`PASS: query "${t.query}" -> routed to "${data.metadata.mode}"`);
      } else {
        console.error(`FAIL: query "${t.query}" -> expected "${t.expectedMode}", got "${data.metadata.mode}"`);
        allPassed = false;
      }
    } catch (e) {
      console.error(`ERROR routing test:`, e);
      allPassed = false;
    }
  }
  return allPassed;
}

async function main() {
  await startServer();
  let allPassed = true;

  for (const test of tests) {
    const passed = await runTest(test);
    if (!passed) {
      allPassed = false;
    }
  }

  const routingPassed = await runRoutingTests();
  if (!routingPassed) {
    allPassed = false;
  }

  await stopServer();

  console.log(`\n==================================================`);
  console.log(`PROMPT 3B MULTI-EVIDENCE LOOP RUN SUMMARY`);
  console.log(`Passed: ${allPassed ? "ALL" : "SOME FAILED"}`);
  console.log(`==================================================`);

  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error("Unhandled test execution error:", err);
  process.exit(1);
});
