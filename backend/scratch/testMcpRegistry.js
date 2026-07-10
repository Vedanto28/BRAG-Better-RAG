import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Set required defaults for testing
process.env.REPO_ROOT_PATH = path.resolve(__dirname, '../../..');
process.env.MOCK_LLM = 'true';

import mcpRegistry from '../src/services/mcpRegistry.js';
import stubExternalMcpProvider from '../src/services/stubExternalMcpProvider.js';
import { runAgentOrchestrator } from '../src/services/agentOrchestrator.js';
import app from '../server.js';

const TEST_PORT = 5007;
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

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`✅ PASS: ${message}`);
    passedTests++;
  }
}

async function runTests() {
  console.log("==================================================");
  console.log("RUNNING PROMPT 4B VERIFICATION SUITE: testMcpRegistry.js");
  console.log("==================================================\n");

  await startServer();
  try {
    // TEST A: Scoping and Gating
    console.log("--- Test A: Scoping and Gating ---");
    process.env.MOCK_EXTERNAL_MCP = 'false';
    await mcpRegistry.resetAll();
    let toolsRepoDisabled = await mcpRegistry.getToolsForMode("repository_investigation");
    assert(!toolsRepoDisabled.some(t => t.name === "searchPullRequests"), "When MOCK_EXTERNAL_MCP=false, searchPullRequests is not exposed");

    process.env.MOCK_EXTERNAL_MCP = 'true';
    let toolsRepoEnabled = await mcpRegistry.getToolsForMode("repository_investigation");
    assert(toolsRepoEnabled.some(t => t.name === "searchPullRequests"), "When MOCK_EXTERNAL_MCP=true, searchPullRequests is exposed in repository_investigation");
    assert(toolsRepoEnabled.some(t => t.name === "getPullRequestDetails"), "When MOCK_EXTERNAL_MCP=true, getPullRequestDetails is exposed in repository_investigation");

    let toolsChangeEnabled = await mcpRegistry.getToolsForMode("change_investigation");
    assert(toolsChangeEnabled.some(t => t.name === "searchPullRequests"), "When MOCK_EXTERNAL_MCP=true, searchPullRequests is exposed in change_investigation");

    let toolsUtilityEnabled = await mcpRegistry.getToolsForMode("utility_tool");
    assert(toolsUtilityEnabled.some(t => t.name === "getCurrentDateTime"), "utility_tool mode exposes datetime");
    assert(toolsUtilityEnabled.some(t => t.name === "calculator"), "utility_tool mode exposes calculator");
    assert(!toolsUtilityEnabled.some(t => t.name === "searchPullRequests"), "utility_tool mode never exposes external tools");
    assert(!toolsUtilityEnabled.some(t => t.name === "readFile"), "utility_tool mode never exposes code reading tools");
    assert(!toolsUtilityEnabled.some(t => t.name === "searchCode"), "utility_tool mode never exposes code searching tools");

    // TEST B: Lazy Connection Preservation
    console.log("\n--- Test B: Lazy Connection Preservation ---");
    await mcpRegistry.resetAll();
    assert(stubExternalMcpProvider.connected === false, "stubExternalMcpProvider is disconnected after reset");

    await runAgentOrchestrator("What is JavaScript?");
    assert(stubExternalMcpProvider.connected === false, "normal_chat request does not trigger connection on stubExternalMcpProvider");

    await runAgentOrchestrator("why do i keep getting connection timeouts");
    assert(stubExternalMcpProvider.connected === false, "knowledge_debugging request does not trigger connection on stubExternalMcpProvider");

    // TEST C: Graceful Degradation / Fail Closed
    console.log("\n--- Test C: Graceful Degradation / Fail Closed ---");
    const brokenProvider = {
      name: "broken_provider",
      isExternal: true,
      isAvailable: async () => { throw new Error("Simulated auth check failure"); },
      isRelevantForMode: async () => true,
      lazyConnect: async () => {},
      listTools: async () => [{ name: "brokenTool", description: "broken", inputSchema: {} }]
    };
    mcpRegistry.registerProvider(brokenProvider);

    let toolsWithBroken = await mcpRegistry.getToolsForMode("repository_investigation");
    assert(!toolsWithBroken.some(t => t.name === "brokenTool"), "Broken provider throwing during isAvailable() is ignored cleanly (fail closed)");
    assert(toolsWithBroken.some(t => t.name === "readFile"), "Internal tools still load normally when another provider fails");

    // Clean out broken provider from providers array
    mcpRegistry.providers = mcpRegistry.providers.filter(p => p.name !== "broken_provider");

    // TEST D: Shared Budget & Metadata Correctness via Orchestrator
    console.log("\n--- Test D: Shared Budget & Metadata Correctness via Orchestrator ---");
    process.env.MOCK_LLM = 'true';
    process.env.MOCK_EXTERNAL_MCP = 'true';
    await mcpRegistry.resetAll();

    const prResult = await runAgentOrchestrator("Remote PR checking database configuration change?");
    assert(prResult.success === true, "Orchestrator turn with stub external tool call completed successfully");
    assert(prResult.metadata.toolsUsed.includes("searchPullRequests"), "metadata.toolsUsed records searchPullRequests");
    assert(Array.isArray(prResult.metadata.externalEvidence), "metadata.externalEvidence is an array");
    assert(prResult.metadata.externalEvidence.length === 1, "metadata.externalEvidence captured exactly 1 external evidence item");
    assert(prResult.metadata.externalEvidence[0].toolName === "searchPullRequests", "metadata.externalEvidence recorded correct toolName");
    assert(prResult.metadata.externalEvidence[0].args.query === "database", "metadata.externalEvidence recorded correct args");
    assert(prResult.metadata.externalEvidence[0].result.pullRequests[0].prNumber === 101, "metadata.externalEvidence captured actual stub output without fabrication");

    // Test mixed budget check hitting cap at 6 total across both internal and stub external tools
    const mixResult = await runAgentOrchestrator("Perform mixed budget check with external and internal tools across configuration files in this repository");
    assert(mixResult.metadata.toolCallLimitReached === true, "Mixed internal+external tool calls triggered toolCallLimitReached at the cap");
    assert(mixResult.metadata.toolCallsUsed === 6, "metadata.toolCallsUsed is exactly 6 (shared counter)");
    assert(mixResult.metadata.toolsUsed.includes("readFile") && mixResult.metadata.toolsUsed.includes("searchPullRequests"), "Both internal and stub external tools shared the exact same global budget of 6");

    console.log("\n==================================================");
    console.log(`ALL ${passedTests}/${totalTests} MCP REGISTRY & ARCHITECTURE TESTS PASSED SUCCESSFULLY!`);
    console.log("==================================================");
  } finally {
    await stopServer();
  }
}

runTests().catch(async err => {
  console.error("Test execution failed:", err);
  await stopServer();
  process.exit(1);
});
