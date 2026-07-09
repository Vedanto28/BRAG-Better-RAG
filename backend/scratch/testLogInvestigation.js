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

const TEST_PORT = 5012;
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
    name: "Test A: Pasted stack trace referencing backend/server.js",
    query: `TypeError: Cannot read properties of undefined (reading 'foo') PASSWORD=secretToken
    at startServer (backend/server.js:25:20)
    at runTest (backend/scratch/testResiliency.js:97:15)`,
    expectedMode: "log_investigation",
    expectParseCall: true,
    expectReadFileCall: true,
    expectedErrorType: "TypeError",
    expectedGroupedCount: 1,
    expectRedaction: true
  },
  {
    name: "Test B: Pasted repeated error logs",
    query: `2026-07-10 01:23:45 UTC - TypeError: Cannot read properties of undefined (reading 'foo')
2026-07-10 01:23:46 UTC - TypeError: Cannot read properties of undefined (reading 'foo')
2026-07-10 01:23:47 UTC - TypeError: Cannot read properties of undefined (reading 'foo')
2026-07-10 01:23:48 UTC - TypeError: Cannot read properties of undefined (reading 'foo')
2026-07-10 01:23:49 UTC - TypeError: Cannot read properties of undefined (reading 'foo')`,
    expectedMode: "log_investigation",
    expectParseCall: true,
    expectReadFileCall: false,
    expectedErrorType: "TypeError",
    expectedGroupedCount: 5,
    expectRedaction: false
  },
  {
    name: "Test C: General Timeout Question (No pasted log)",
    query: "Why do I keep getting connection timeouts?",
    expectedMode: "knowledge_debugging", // Should route to normal debugging-RAG flow, no log investigation
    expectParseCall: false,
    expectReadFileCall: false,
    expectedErrorType: "",
    expectedGroupedCount: 0,
    expectRedaction: false
  },
  {
    name: "Test D: Pasted stack trace referencing nonexistent file",
    query: `Error: Something went wrong KEY=secretKey
    at executeTask (backend/nonexistent.js:10:5)`,
    expectedMode: "log_investigation",
    expectParseCall: true,
    expectReadFileCall: true,
    expectedErrorType: "Error",
    expectedGroupedCount: 1,
    expectRedaction: true
  }
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

    // 2. Validate parseErrorLog tool invocation
    const hasParseCall = data.metadata.toolsUsed.includes("parseErrorLog");
    if (hasParseCall !== testObj.expectParseCall) {
      console.error(`FAIL: parseErrorLog call state mismatch. Expected ${testObj.expectParseCall}, got ${hasParseCall}`);
      return false;
    }

    // 3. Validate readFile tool invocation
    const hasReadFileCall = data.metadata.toolsUsed.includes("readFile");
    if (hasReadFileCall !== testObj.expectReadFileCall) {
      console.error(`FAIL: readFile call state mismatch. Expected ${testObj.expectReadFileCall}, got ${hasReadFileCall}`);
      return false;
    }

    // 4. Validate logEvidence metadata
    if (testObj.expectParseCall) {
      const evidence = data.metadata.logEvidence;
      if (!evidence) {
        console.error(`FAIL: Missing logEvidence in metadata.`);
        return false;
      }
      if (evidence.errorType !== testObj.expectedErrorType) {
        console.error(`FAIL: Expected errorType "${testObj.expectedErrorType}", got "${evidence.errorType}"`);
        return false;
      }
      if (evidence.groupedOccurrences !== testObj.expectedGroupedCount) {
        console.error(`FAIL: Expected groupedOccurrences ${testObj.expectedGroupedCount}, got ${evidence.groupedOccurrences}`);
        return false;
      }
      if (testObj.expectReadFileCall && evidence.framesReferenced.length === 0) {
        console.error(`FAIL: Expected stack frames extracted in framesReferenced.`);
        return false;
      }

      // Check that all framesReferenced have relative path names and do not leak absolute paths
      for (const frame of evidence.framesReferenced) {
        if (path.isAbsolute(frame.file) || frame.file.includes(":") || frame.file.includes("///")) {
          console.error(`FAIL: Absolute or raw URI path leaked in frame:`, frame);
          return false;
        }
      }
      console.log(`PASS: relative path verification passed for frames.`);
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
  let allPassed = true;

  for (const test of tests) {
    const passed = await runTest(test);
    if (!passed) {
      allPassed = false;
    }
  }

  await stopServer();

  console.log(`\n==================================================`);
  console.log(`LOG EVIDENCE TEST RUN SUMMARY`);
  console.log(`Passed: ${allPassed ? "ALL" : "SOME FAILED"}`);
  console.log(`==================================================`);

  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error("Unhandle test execution error:", err);
  process.exit(1);
});
