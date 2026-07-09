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

process.env.MOCK_LLM = 'true';
process.env.REPO_ROOT_PATH = projectRoot;

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
    name: 'Test A: "What is JavaScript?"',
    query: 'What is JavaScript?',
    expectedModes: ['normal_chat'],
    expectToolsUsed: []
  },
  {
    name: 'Test B: "What is RAG?"',
    query: 'What is RAG?',
    expectedModes: ['normal_chat'],
    expectToolsUsed: []
  },
  {
    name: 'Test C: "Where is the login route defined, and what does it call?"',
    query: 'Where is the login route defined, and what does it call?',
    expectedModes: ['repository_investigation'],
    expectToolsUsed: ['searchCode', 'readFile']
  },
  {
    name: 'Test D: "What changed recently?"',
    query: 'What changed recently?',
    expectedModes: ['change_investigation'],
    expectToolsUsed: ['getRecentCommits']
  },
  {
    name: 'Test E: "Calculate 15 multiplied by 4"',
    query: 'Calculate 15 multiplied by 4',
    expectedModes: ['utility_tool', 'normal_chat'],
    expectToolsUsed: ['calculator']
  },
  {
    name: 'Test F: "What time is it right now?"',
    query: 'What time is it right now?',
    expectedModes: ['utility_tool', 'normal_chat'],
    expectToolsUsed: ['getCurrentDateTime']
  },
  {
    name: 'Test G: "Why did authentication start failing after the last commit?"',
    query: 'Why did authentication start failing after the last commit?',
    expectedModes: ['knowledge_debugging', 'change_investigation'],
    expectToolsUsed: ['getRecentCommits', 'inspectCommit', 'searchCode']
  }
];

async function runTest(testObj) {
  const baseUrl = `http://localhost:${TEST_PORT}`;
  console.log(`\n==================================================`);
  console.log(`RUNNING: ${testObj.name}`);
  console.log(`Query: "${testObj.query}"`);
  console.log(`==================================================`);

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: testObj.query })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`API returned status ${res.status}: ${JSON.stringify(data)}`);
  }

  console.log('Answer:', data.answer);
  console.log('Metadata:', JSON.stringify(data.metadata, null, 2));

  // Check mode
  if (!testObj.expectedModes.includes(data.metadata.mode)) {
    throw new Error(`Expected mode to be one of [${testObj.expectedModes.join(', ')}], got '${data.metadata.mode}'`);
  }

  // Check tools used
  const actualTools = data.metadata.toolsUsed || [];
  if (testObj.expectToolsUsed.length === 0) {
    if (actualTools.length > 0) {
      throw new Error(`Expected zero tools used for ${data.metadata.mode}, got: ${JSON.stringify(actualTools)}`);
    }
  } else {
    for (const expectedTool of testObj.expectToolsUsed) {
      if (!actualTools.includes(expectedTool)) {
        throw new Error(`Expected tool '${expectedTool}' to be used, got toolsUsed: ${JSON.stringify(actualTools)}`);
      }
    }
  }

  console.log(`STATUS: PASS (${testObj.name})`);
}

async function main() {
  await startServer();
  try {
    for (const t of tests) {
      await runTest(t);
    }
    console.log(`\n==================================================`);
    console.log(`ALL 7 FOCUS TESTS (A - G) PASSED SUCCESSFULLY!`);
    console.log(`==================================================`);
    await stopServer();
    process.exit(0);
  } catch (error) {
    console.error(`\nTEST FAILED:`, error.message || error);
    await stopServer();
    process.exit(1);
  }
}

main();
