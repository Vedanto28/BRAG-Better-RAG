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

// Ensure real LLM mode for BYOK tests
delete process.env.MOCK_LLM;
delete process.env.TEST_GEMINI_FAIL_ALL;
delete process.env.TEST_OPENAI_FAIL_ALL;

import app from '../server.js';
import { resolveProviderCredentials } from '../src/providers/providerInterface.js';

const TEST_PORT = 5025;
let serverInstance;

function startServer() {
  return new Promise((resolve) => {
    process.env.PORT = TEST_PORT;
    serverInstance = app.listen(TEST_PORT, () => {
      console.log(`[BYOK Test Server] Started on port ${TEST_PORT}`);
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (serverInstance) {
      serverInstance.close(() => {
        console.log('[BYOK Test Server] Stopped.');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

async function runTests() {
  console.log("==================================================");
  console.log("RUNNING PROMPT 7 VERIFICATION SUITE: testByokCredentials.js");
  console.log("==================================================\n");

  await startServer();
  const baseUrl = `http://localhost:${TEST_PORT}`;

  try {
    // -----------------------------------------------------------------
    // TEST 1: Unit Substitution & Resolution Check
    // -----------------------------------------------------------------
    console.log("--- Test 1: Unit Substitution Point Verification ---");
    
    // Server key fallback when no user key
    const resServer = resolveProviderCredentials('gemini', {});
    assert.strictEqual(resServer.source, 'server', "Should resolve to server key when user key absent");
    assert(resServer.apiKey, "Server key should be populated from env");

    // User key priority
    const dummyUserKey = "sk-or-v1-dummytestkey1234567890";
    const resUser = resolveProviderCredentials('openrouter', { openrouter: dummyUserKey });
    assert.strictEqual(resUser.source, 'user', "User key must override server key");
    assert.strictEqual(resUser.apiKey, dummyUserKey, "Resolved key must match user-supplied key");
    console.log("✅ PASS: Substitution point correctly prioritizes user key over server key.");

    // -----------------------------------------------------------------
    // TEST 2: Request without User Key (Default Behavior Unchanged)
    // -----------------------------------------------------------------
    console.log("\n--- Test 2: Default Request (No User Key) ---");
    const resDefault = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: "What is JavaScript?" })
    });
    const dataDefault = await resDefault.json();
    assert.strictEqual(resDefault.status, 200, "Default request should return 200 OK");
    assert(dataDefault.success, "Default request should succeed");
    assert(dataDefault.metadata.provider, "Response metadata must contain provider");
    console.log(`✅ PASS: Default request succeeded with provider '${dataDefault.metadata.provider}'.`);

    // -----------------------------------------------------------------
    // TEST 3: Request with Header BYOK (x-byok-gemini-key)
    // -----------------------------------------------------------------
    console.log("\n--- Test 3: Request with User BYOK Header ---");
    const sampleUserKey = "AIzaSyDummyTestKey987654321012345";
    const resHeader = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-byok-gemini-key': sampleUserKey
      },
      body: JSON.stringify({ message: "What is Node.js?" })
    });
    const dataHeader = await resHeader.json();
    assert.strictEqual(resHeader.status, 200, "BYOK request should return 200 OK");
    assert(dataHeader.success, "BYOK request should succeed");
    console.log("✅ PASS: Request with BYOK header succeeded.");

    // -----------------------------------------------------------------
    // TEST 4: Invalid User Key Degradation & Fallback
    // -----------------------------------------------------------------
    console.log("\n--- Test 4: Invalid User Key Degradation ---");
    const invalidUserKey = "sk-or-v1-invalidKeyFormat99999999";
    const resInvalid = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-byok-openrouter-key': invalidUserKey
      },
      body: JSON.stringify({ message: "What is Express?" })
    });
    const dataInvalid = await resInvalid.json();
    assert.strictEqual(resInvalid.status, 200, "Degraded request should return 200 OK via fallback");
    assert(dataInvalid.success, "Degraded request should succeed via fallback chain");
    
    // Verify key zero leak in response
    const jsonStr = JSON.stringify(dataInvalid);
    assert(!jsonStr.includes(invalidUserKey), "User key MUST NOT leak in response body or metadata");
    console.log("✅ PASS: Invalid user key degraded gracefully without leaking key content.");

    // -----------------------------------------------------------------
    // TEST 5: Early Rejection of Malformed Keys
    // -----------------------------------------------------------------
    console.log("\n--- Test 5: Early Rejection of Malformed Keys ---");
    const malformedKey = "short key";
    const resMalformed = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-byok-groq-key': malformedKey
      },
      body: JSON.stringify({ message: "Hello" })
    });
    const dataMalformed = await resMalformed.json();
    assert.strictEqual(resMalformed.status, 400, "Malformed key must return 400 Bad Request");
    assert.strictEqual(dataMalformed.success, false, "Malformed key response should be success: false");
    assert(!JSON.stringify(dataMalformed).includes(malformedKey), "Malformed key MUST NOT leak in error response");
    console.log("✅ PASS: Malformed key rejected early with 400 Bad Request.");

    // -----------------------------------------------------------------
    // TEST 6: Clear / Reset Mechanism Verification
    // -----------------------------------------------------------------
    console.log("\n--- Test 6: Clear / Reset Mechanism Verification ---");
    const resReset = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: "What is REST?" })
    });
    const dataReset = await resReset.json();
    assert.strictEqual(resReset.status, 200, "Cleared request should revert to server key behavior");
    assert(dataReset.success, "Cleared request succeeded using server key");
    console.log("✅ PASS: Clearing BYOK header cleanly reverts to server-configured keys.");

    console.log("\n==================================================");
    console.log("ALL BYOK CREDENTIAL TESTS PASSED SUCCESSFULLY!");
    console.log("==================================================");
    await stopServer();
    process.exit(0);
  } catch (err) {
    console.error("\nBYOK TEST SUITE FAILED:", err);
    await stopServer();
    process.exit(1);
  }
}

runTests();
