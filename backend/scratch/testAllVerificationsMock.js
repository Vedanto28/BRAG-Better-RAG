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

// Force mock mode for LLM and External MCP to ensure predictable execution
process.env.MOCK_LLM = 'true';
process.env.MOCK_EXTERNAL_MCP = 'true';
process.env.PORT = '5020';

import { EXTERNAL_MCP_CONFIG } from '../src/utils/config.js';
import mcpRegistry from '../src/services/mcpRegistry.js';

EXTERNAL_MCP_CONFIG.MOCK_EXTERNAL_MCP = true;
EXTERNAL_MCP_CONFIG.GITHUB_MCP_ENABLED = false;
EXTERNAL_MCP_CONFIG.CHROME_MCP_ENABLED = false;
EXTERNAL_MCP_CONFIG.CONTEXT7_MCP_ENABLED = false;

import app from '../server.js';

let serverInstance;

async function startServer() {
  await mcpRegistry.resetAll();
  return new Promise((resolve) => {
    serverInstance = app.listen(5020, () => {
      console.log(`[Mock Test Server] Listening on port 5020`);
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (serverInstance) {
      if (typeof serverInstance.closeAllConnections === 'function') {
        serverInstance.closeAllConnections();
      }
      serverInstance.close(() => {
        console.log('[Mock Test Server] Closed.');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

async function chatRequest(message) {
  const res = await fetch(`http://localhost:5020/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
  return res.json();
}

async function run() {
  await startServer();
  try {
    // ============================================================
    // 7.1 GitHub verification in mock mode
    // ============================================================
    console.log("\n--- Task 7.1: GitHub Mock Verification ---");
    const res1 = await chatRequest("search database config in remote prs");
    console.log("GitHub response:", JSON.stringify(res1.metadata, null, 2));
    assert.ok(res1.success);
    assert.ok(res1.metadata.toolsUsed.includes("searchPullRequests"));
    console.log("✅ PASS: GitHub mock verification tool usage recorded");

    // ============================================================
    // 7.2 Chrome DevTools verification in mock mode
    // ============================================================
    console.log("\n--- Task 7.2: Chrome DevTools Mock Verification ---");
    const res2 = await chatRequest("check the console logs and search GitHub PRs for database timeout");
    console.log("Chrome DevTools response:", JSON.stringify(res2.metadata, null, 2));
    assert.ok(res2.success);
    assert.ok(res2.metadata.toolsUsed.includes("list_console_messages"));
    assert.ok(res2.metadata.toolsUsed.includes("list_network_requests"));
    assert.ok(res2.metadata.toolsUsed.includes("take_screenshot"));
    console.log("✅ PASS: Chrome DevTools mock verification tool usage recorded");

    // ============================================================
    // 7.3 Context7 verification in mock mode (Suspected gap check)
    // ============================================================
    console.log("\n--- Task 7.3: Context7 Mock Verification (Next.js layout query) ---");
    // Let's verify that we get the proper mock output or toolcalls when mocked
    const res3 = await chatRequest("How does Next.js App Router handle nested layouts? Use official documentation.");
    console.log("Context7 response:", JSON.stringify(res3.metadata, null, 2));
    assert.ok(res3.success);
    // Since Next.js Layout query doesn't have a specific mock handler yet in mockProvider, 
    // it falls through to default, but the routing is verified as documentation_lookup.
    assert.strictEqual(res3.metadata.mode, "documentation_lookup");
    console.log("✅ PASS: Context7 query correctly routed to documentation_lookup");

    // ============================================================
    // 7.4 Compound query verification (GitHub + Context7)
    // ============================================================
    console.log("\n--- Task 7.4: Compound Query Mock Verification ---");
    const res4 = await chatRequest("My auth logic broke after the last commit — check what changed recently on GitHub and confirm we are using the current recommended JWT verification pattern from official documentation.");
    console.log("Compound query response:", JSON.stringify(res4.metadata, null, 2));
    assert.ok(res4.success);
    assert.ok(res4.metadata.toolsUsed.includes("list_commits"));
    assert.ok(res4.metadata.toolsUsed.includes("resolve-library-id"));
    assert.ok(res4.metadata.toolsUsed.includes("inspectCommit"));
    assert.ok(res4.metadata.toolsUsed.includes("query-docs"));
    console.log("✅ PASS: Compound query correctly invoked multiple providers inside the same loop");

    console.log("\n==================================================");
    console.log("ALL MOCK VERIFICATIONS PASSED SUCCESSFULLY!");
    console.log("==================================================");
    await stopServer();
    process.exit(0);
  } catch (err) {
    console.error("Verification failed:", err);
    await stopServer();
    process.exit(1);
  }
}

run();
