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

// Enable Mock LLM mode and Mock External MCP for deterministic multi-MCP testing
process.env.MOCK_LLM = 'true';
process.env.MOCK_EXTERNAL_MCP = 'true';

import { EXTERNAL_MCP_CONFIG } from '../src/utils/config.js';
EXTERNAL_MCP_CONFIG.MOCK_EXTERNAL_MCP = true;

import app from '../server.js';
import mcpRegistry from '../src/services/mcpRegistry.js';
import { runAgentOrchestrator, redactSensitiveData } from '../src/services/agentOrchestrator.js';

const TEST_PORT = 5035;
let serverInstance;

function startServer() {
  return new Promise((resolve) => {
    process.env.PORT = TEST_PORT;
    serverInstance = app.listen(TEST_PORT, () => {
      console.log(`[Full-System BYOK Integration Test Server] Started on port ${TEST_PORT}`);
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (serverInstance) {
      serverInstance.close(() => {
        console.log('[Full-System BYOK Integration Test Server] Stopped.');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

async function runFullSystemBYOKTests() {
  console.log("==================================================");
  console.log("RUNNING GAP 3 FULL-SYSTEM BYOK AGENTIC INTEGRATION SUITE");
  console.log("==================================================\n");

  await startServer();
  const baseUrl = `http://localhost:${TEST_PORT}`;
  await mcpRegistry.resetAll();

  try {
    // -----------------------------------------------------------------
    // SCENARIO 1: BYOK + Capability Planner + Single-Provider Investigation
    // -----------------------------------------------------------------
    console.log("--- Scenario 1: BYOK + Capability Planner + Single-Provider Investigation ---");
    const userKey1 = "sk-or-v1-userSingleKey1234567890";
    
    const res1 = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-byok-openrouter-key': userKey1
      },
      body: JSON.stringify({ message: "What changed recently in this repository?" })
    });

    const data1 = await res1.json();
    assert.strictEqual(res1.status, 200, "Scenario 1 should return 200 OK");
    assert(data1.success, "Scenario 1 request should succeed");
    
    const meta1 = data1.metadata;
    assert(meta1.capabilityPlan.requiresGit, "Planner must identify requiresGit: true");
    assert.strictEqual(meta1.observabilityTrace.plannerSnapshot.mode, "change_investigation");
    assert(meta1.toolsUsed.includes("getRecentCommits"), "Tool loop must execute getRecentCommits");
    
    // Ensure key string was not leaked
    assert(!JSON.stringify(data1).includes(userKey1), "User key must not leak in Scenario 1 response");
    console.log("✅ PASS: Scenario 1 (BYOK + Capability Planner + Git Tool Investigation) succeeded.");

    // -----------------------------------------------------------------
    // SCENARIO 2: BYOK + Compound Multi-Provider Investigation
    // -----------------------------------------------------------------
    console.log("\n--- Scenario 2: BYOK + Compound Multi-Provider Investigation ---");
    const userKey2 = "sk-or-v1-userCompoundKey9876543210";
    
    const res2 = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-byok-openrouter-key': userKey2
      },
      body: JSON.stringify({ message: "Auth logic broke after merging GitHub PR for jwt authentication" })
    });

    const data2 = await res2.json();
    assert.strictEqual(res2.status, 200, "Scenario 2 should return 200 OK");
    assert(data2.success, "Scenario 2 request should succeed");

    const meta2 = data2.metadata;
    assert(meta2.capabilityPlan.requiresGit || meta2.capabilityPlan.requiresDocumentation, "Compound query must set planner flags");
    assert(meta2.executionGuidance.suggestedPriority.length > 0, "Execution guidance must be generated");
    assert(meta2.observabilityTrace.providerExposure.length >= 2, "Multiple providers must be exposed");
    assert(meta2.toolsUsed.length >= 1, "Compound investigation must invoke tools");

    // Zero key leak check
    assert(!JSON.stringify(data2).includes(userKey2), "User key must not leak in Scenario 2 response");
    console.log("✅ PASS: Scenario 2 (BYOK + Compound Multi-Provider Investigation) succeeded.");

    // -----------------------------------------------------------------
    // SCENARIO 3: BYOK Provider Failure Mid-Investigation (Graceful Fallback)
    // -----------------------------------------------------------------
    console.log("\n--- Scenario 3: BYOK Provider Failure Mid-Investigation ---");
    const userKey3 = "sk-or-v1-midFailKey111222333444";
    
    const res3 = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-byok-openrouter-key': userKey3
      },
      body: JSON.stringify({ message: "Why did authentication start failing after the last commit?" })
    });

    const data3 = await res3.json();
    assert.strictEqual(res3.status, 200, "Scenario 3 request should complete via fallback");
    assert(data3.success, "Scenario 3 response must be success: true");
    assert(data3.metadata.toolsUsed.length > 0, "MCP evidence must be collected before provider failure");
    assert(!JSON.stringify(data3).includes(userKey3), "User key must not leak in Scenario 3 response");
    console.log(`✅ PASS: Scenario 3 succeeded. Evidence gathered (${data3.metadata.toolsUsed.join(', ')}) and completed gracefully.`);

    // -----------------------------------------------------------------
    // SCENARIO 4: Holistic Redaction with BYOK Active
    // -----------------------------------------------------------------
    console.log("\n--- Scenario 4: Holistic Redaction with BYOK Active ---");
    const userKey4 = "sk-or-v1-secretUserKey555666777888";
    
    const unredactedText = `Found secret in GitHub PR: token="ghp_liveGithubToken99999". DevTools log: API_KEY: 'browser_key_12345'. Path: D:\\DESKTOP CONTENT\\Desktop\\for employment\\ai-chatBot\\backend\\server.js. User key: ${userKey4}`;
    
    const redactedOutput = redactSensitiveData(unredactedText, { openrouter: userKey4 });
    
    assert(!redactedOutput.includes("ghp_liveGithubToken99999"), "GitHub token must be redacted");
    assert(!redactedOutput.includes("browser_key_12345"), "Browser API key must be redacted");
    assert(!redactedOutput.includes("for employment\\ai-chatBot"), "Workspace absolute path must be redacted");
    assert(!redactedOutput.includes(userKey4), "User BYOK key MUST be redacted from output");
    assert(redactedOutput.includes("[REDACTED_USER_KEY]"), "User BYOK key must be replaced with [REDACTED_USER_KEY]");
    
    console.log("Redacted Output Sample:\n", redactedOutput);
    console.log("✅ PASS: Scenario 4 (Holistic Redaction with BYOK active) succeeded.");

    console.log("\n==================================================");
    console.log("ALL FULL-SYSTEM BYOK INTEGRATION TESTS PASSED!");
    console.log("==================================================");
    await stopServer();
    process.exit(0);
  } catch (err) {
    console.error("\nFULL-SYSTEM BYOK INTEGRATION SUITE FAILED:", err);
    await stopServer();
    process.exit(1);
  }
}

runFullSystemBYOKTests();
