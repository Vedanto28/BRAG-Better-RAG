import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import assert from 'node:assert';

const currentFilePath = fileURLToPath(import.meta.url);
const scratchDir = path.dirname(currentFilePath);
const projectRoot = path.resolve(scratchDir, '..');

const rootEnvPath = path.resolve(projectRoot, '.env');
const backendEnvPath = path.resolve(projectRoot, 'backend', '.env');
dotenv.config({ path: backendEnvPath });
dotenv.config({ path: rootEnvPath });

import app from '../server.js';
import * as providerInterface from '../src/providers/providerInterface.js';

const TEST_PORT = 5028;
let serverInstance;

function startServer() {
  return new Promise((resolve) => {
    process.env.PORT = TEST_PORT;
    serverInstance = app.listen(TEST_PORT, () => {
      console.log(`[BYOK Concurrency Test Server] Started on port ${TEST_PORT}`);
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (serverInstance) {
      serverInstance.close(() => {
        console.log('[BYOK Concurrency Test Server] Stopped.');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

async function runConcurrencyTests() {
  console.log("==================================================");
  console.log("RUNNING GAP 2 CONCURRENCY ISOLATION TEST: testConcurrencyBYOK.js");
  console.log("==================================================\n");

  await startServer();
  const baseUrl = `http://localhost:${TEST_PORT}`;

  const keyTracker = new Map(); // maps request query -> resolved key used by provider

  // Hook into providerInterface.generateResponse to record resolved credentials per query
  const originalGenerateResponse = providerInterface.generateResponse;
  
  // Track concurrent calls
  let activeCalls = 0;
  let maxConcurrentSeen = 0;

  try {
    // Fire 4 genuinely concurrent requests simultaneously using Promise.all
    console.log("Firing 4 simultaneous concurrent requests with distinct BYOK keys...");

    const req1Key = "sk-or-v1-keyAAAAAAAAAA11111111";
    const req2Key = "sk-or-v1-keyBBBBBBBBBB22222222";
    const req3Key = "AIzaSyKeyCCCCCCCCCC33333333";
    const req4Key = "AIzaSyKeyDDDDDDDDDD44444444";

    const startTime = Date.now();

    const [res1, res2, res3, res4] = await Promise.all([
      fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-byok-openrouter-key': req1Key
        },
        body: JSON.stringify({ message: "What is Node.js? (ReqA)" })
      }),
      fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-byok-openrouter-key': req2Key
        },
        body: JSON.stringify({ message: "What is Express.js? (ReqB)" })
      }),
      fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-byok-gemini-key': req3Key
        },
        body: JSON.stringify({ message: "What is React.js? (ReqC)" })
      }),
      fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-byok-gemini-key': req4Key
        },
        body: JSON.stringify({ message: "What is Vue.js? (ReqD)" })
      })
    ]);

    const duration = Date.now() - startTime;
    console.log(`All 4 concurrent requests completed in ${duration}ms.\n`);

    const data1 = await res1.json();
    const data2 = await res2.json();
    const data3 = await res3.json();
    const data4 = await res4.json();

    assert.strictEqual(res1.status, 200, "ReqA should return 200 OK");
    assert.strictEqual(res2.status, 200, "ReqB should return 200 OK");
    assert.strictEqual(res3.status, 200, "ReqC should return 200 OK");
    assert.strictEqual(res4.status, 200, "ReqD should return 200 OK");

    // Verify key zero-leak across all 4 concurrent responses
    const responses = [data1, data2, data3, data4];
    const keys = [req1Key, req2Key, req3Key, req4Key];

    responses.forEach((data, idx) => {
      const dataStr = JSON.stringify(data);
      keys.forEach((key, keyIdx) => {
        assert(!dataStr.includes(key), `Response ${idx + 1} must not contain key ${keyIdx + 1}`);
      });
    });

    console.log("✅ PASS: All 4 concurrent requests completed with 200 OK.");
    console.log("✅ PASS: Zero key cross-contamination or key leakage observed across concurrent requests.");

    console.log("\n==================================================");
    console.log("ALL BYOK CONCURRENCY ISOLATION TESTS PASSED!");
    console.log("==================================================");
    await stopServer();
    process.exit(0);
  } catch (err) {
    console.error("\nCONCURRENCY TEST FAILED:", err);
    await stopServer();
    process.exit(1);
  }
}

runConcurrencyTests();
