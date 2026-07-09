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

// Ensure we are using real Gemini
delete process.env.MOCK_LLM;
delete process.env.TEST_GEMINI_RETRY_SEQUENCE;
delete process.env.TEST_GEMINI_FAIL_ALL;
delete process.env.TEST_OPENAI_FAIL_ALL;
process.env.LLM_PROVIDER = 'gemini';

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
      serverInstance.close(() => {
        console.log('[Test Server] Stopped.');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

async function main() {
  await startServer();
  try {
    const query = "What is JavaScript? Answer in two sentences.";
    console.log(`\n==================================================`);
    console.log(`RUNNING SINGLE REAL GEMINI SANITY CHECK`);
    console.log(`Query: "${query}"`);
    console.log(`==================================================\n`);

    const res = await fetch(`http://localhost:${TEST_PORT}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: query })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(`API returned status ${res.status}: ${JSON.stringify(data)}`);
    }

    console.log('Answer:', data.answer);
    console.log('Metadata:', JSON.stringify(data.metadata, null, 2));

    if (data.metadata.mode !== 'normal_chat') {
      throw new Error(`Expected mode 'normal_chat', got '${data.metadata.mode}'`);
    }

    if (data.metadata.toolsUsed.length > 0) {
      throw new Error(`Expected zero tools used, got: ${JSON.stringify(data.metadata.toolsUsed)}`);
    }

    console.log(`\n==================================================`);
    console.log(`REAL GEMINI SANITY CHECK PASSED!`);
    console.log(`==================================================`);
    await stopServer();
    process.exit(0);
  } catch (error) {
    console.error(`\nREAL GEMINI SANITY CHECK FAILED:`, error.message || error);
    await stopServer();
    process.exit(1);
  }
}

main();
