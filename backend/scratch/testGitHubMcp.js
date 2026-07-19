import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set required defaults for testing
process.env.REPO_ROOT_PATH = path.resolve(__dirname, '../..');
process.env.MOCK_LLM = 'true';

import gitHubMcpProvider, { parseGitRemoteUrl } from '../src/services/gitHubMcpProvider.js';
import mcpRegistry from '../src/services/mcpRegistry.js';
import { redactSecrets } from '../src/utils/logParser.js';
import { EXTERNAL_MCP_CONFIG } from '../src/utils/config.js';
import { runAgentOrchestrator } from '../src/services/agentOrchestrator.js';
import app from '../server.js';

const TEST_PORT = 5009;
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
      serverInstance.close();
      console.log('[Test Server] Stopped.');
      resolve();
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
  console.log("RUNNING GITHUB MCP VERIFICATION SUITE: testGitHubMcp.js");
  console.log("==================================================\n");

  // TEST 1: Git Remote URL Parsing helper
  console.log("--- Test 1: Git Remote URL Parsing Helper ---");
  const sshUrl = "git@github.com:Vedanto28/BRAG---Better-RAG-.git";
  const httpsUrl = "https://github.com/Vedanto28/BRAG---Better-RAG-.git";
  const sshNoGitUrl = "git@github.com:Vedanto28/BRAG---Better-RAG-";
  
  const parsedSsh = parseGitRemoteUrl(sshUrl);
  assert(parsedSsh.owner === "Vedanto28" && parsedSsh.repo === "BRAG---Better-RAG-", "Parses SSH Git URL correctly");

  const parsedHttps = parseGitRemoteUrl(httpsUrl);
  assert(parsedHttps.owner === "Vedanto28" && parsedHttps.repo === "BRAG---Better-RAG-", "Parses HTTPS Git URL correctly");

  const parsedNoGit = parseGitRemoteUrl(sshNoGitUrl);
  assert(parsedNoGit.owner === "Vedanto28" && parsedNoGit.repo === "BRAG---Better-RAG-", "Parses URL without .git suffix correctly");

  // TEST 2: Secrets Redaction Integration
  console.log("\n--- Test 2: Secrets Redaction Integration ---");
  const dirtyText = "clientId: '12345'\ngithubToken = 'ghp_secretValueHere123'\nnormalLine: true";
  const clean = redactSecrets(dirtyText);
  assert(clean.includes("[REDACTED]"), "Redacts githubToken value using unified logParser utility");
  assert(!clean.includes("ghp_secretValueHere123"), "Secret value is completely scrubbed");

  // TEST 3: Fail-Closed Gating when Credentials Unset
  console.log("\n--- Test 3: Fail-Closed Gating when Credentials Unset ---");
  const originalEnabled = EXTERNAL_MCP_CONFIG.GITHUB_MCP_ENABLED;
  const originalToken = EXTERNAL_MCP_CONFIG.GITHUB_MCP_TOKEN;

  EXTERNAL_MCP_CONFIG.GITHUB_MCP_ENABLED = false;
  EXTERNAL_MCP_CONFIG.GITHUB_MCP_TOKEN = '';
  gitHubMcpProvider._isAvailable = undefined;
  await mcpRegistry.resetAll();

  assert(await gitHubMcpProvider.isAvailable() === false, "Reports unavailable when GITHUB_MCP_ENABLED=false");

  EXTERNAL_MCP_CONFIG.GITHUB_MCP_ENABLED = true;
  gitHubMcpProvider._isAvailable = undefined;
  assert(await gitHubMcpProvider.isAvailable() === false, "Reports unavailable when GITHUB_MCP_TOKEN is empty");

  // Restore
  EXTERNAL_MCP_CONFIG.GITHUB_MCP_ENABLED = originalEnabled;
  EXTERNAL_MCP_CONFIG.GITHUB_MCP_TOKEN = originalToken;

  // TEST 4: Real Network Gating / Integration
  console.log("\n--- Test 4: Real Network Gating / Integration ---");
  const originalMock = EXTERNAL_MCP_CONFIG.MOCK_EXTERNAL_MCP;
  EXTERNAL_MCP_CONFIG.MOCK_EXTERNAL_MCP = false;

  console.log("DEBUG CONFIG:", {
    GITHUB_MCP_ENABLED: EXTERNAL_MCP_CONFIG.GITHUB_MCP_ENABLED,
    GITHUB_MCP_TOKEN: EXTERNAL_MCP_CONFIG.GITHUB_MCP_TOKEN ? "present" : "absent",
    MOCK_EXTERNAL_MCP: EXTERNAL_MCP_CONFIG.MOCK_EXTERNAL_MCP
  });

  // Mock repo resolution to octocat/Hello-World so that tests work on any token
  gitHubMcpProvider._repoInfo = { owner: "octocat", repo: "Hello-World" };

  // Clear provider cache
  gitHubMcpProvider._isAvailable = undefined;
  await mcpRegistry.resetAll();

  const isAvailable = await gitHubMcpProvider.isAvailable();
  if (!isAvailable) {
    console.log("ℹ️ Skipping live GitHub MCP server checks (GitHub provider is not available or token/repo verification failed).");
    process.env.MOCK_EXTERNAL_MCP = originalMock;
  } else {
    await startServer();
    try {
      console.log("Initializing real GitHub MCP Connection...");
      await gitHubMcpProvider.lazyConnect();
      assert(gitHubMcpProvider.connected === true, "Connected to real GitHub MCP server");

      const initialClient = gitHubMcpProvider.client;
      const initialTransport = gitHubMcpProvider.transport;

      const tools = await gitHubMcpProvider.listTools();
      assert(tools.length > 0, "Discovered tools from live GitHub server");
      assert(tools.every(t => gitHubMcpProvider.allowedTools.includes(t.name)), "Exposed tools are restricted to read-only allowedTools whitelist");

      // Verify that owner and repo are removed from required properties
      const listPrs = tools.find(t => t.name === "list_pull_requests");
      if (listPrs) {
        assert(!listPrs.inputSchema.required?.includes("owner"), "Owner is removed from required parameters of list_pull_requests schema");
        assert(!listPrs.inputSchema.required?.includes("repo"), "Repo is removed from required parameters of list_pull_requests schema");
      }

      console.log("Executing live read-only list_pull_requests call...");
      const result = await gitHubMcpProvider.callTool({ name: "list_pull_requests", arguments: {} });
      assert(result && Array.isArray(result.content), "Received valid tool result content array from live GitHub MCP server");
      console.log("Live PR list preview:", result.content[0]?.text?.slice(0, 300) || "No open PRs found on Hello-World repository.");

      // TEST 5: Persistent Connection Reuse
      console.log("\n--- Test 5: Persistent Connection Reuse ---");
      const secondResult = await gitHubMcpProvider.callTool({ name: "list_commits", arguments: { per_page: 1 } });
      assert(secondResult && Array.isArray(secondResult.content), "Successfully made a second call to list_commits");
      assert(gitHubMcpProvider.client === initialClient, "Client instance is reused between calls");
      assert(gitHubMcpProvider.transport === initialTransport, "Transport instance is reused between calls");

      // TEST 6: AbortSignal Timeout/Cancellation
      console.log("\n--- Test 6: AbortSignal Timeout/Cancellation ---");
      const controller = new AbortController();
      controller.abort();
      let timeoutAborted = false;
      try {
        await gitHubMcpProvider.callTool({ name: "list_pull_requests", arguments: {}, signal: controller.signal });
      } catch (err) {
        if (err.message && err.message.includes("aborted")) {
          timeoutAborted = true;
        }
      }
      assert(timeoutAborted === true, "Tool call aborts/rejects when request AbortSignal is cancelled");

      // TEST 7: Mixed-Tool Budget Integration
      console.log("\n--- Test 7: Mixed-Tool Budget Integration ---");
      const mixResult = await runAgentOrchestrator("live mixed budget verify in this repository");
      assert(mixResult.metadata.toolCallLimitReached === true, "Mixed internal+live external tool calls triggered toolCallLimitReached at the cap");
      assert(mixResult.metadata.toolCallsUsed === 6, "metadata.toolCallsUsed is exactly 6 (shared counter)");
      
      const extEvidence = mixResult.metadata.externalEvidence;
      console.log("ACTUAL EXTERNAL EVIDENCE:", JSON.stringify(extEvidence, null, 2));
      assert(Array.isArray(extEvidence) && extEvidence.length > 0, "Captured external evidence in metadata");
      const firstExt = extEvidence[0];
      assert(firstExt.provider === "github", "Provenance provider is github");
      assert(firstExt.toolName === "list_commits", "Provenance toolName is list_commits");
      assert(typeof firstExt.timestamp === "string" && !isNaN(Date.parse(firstExt.timestamp)), "Provenance contains valid ISO timestamp");
      assert(firstExt.repository === "octocat/Hello-World" || firstExt.repository === "Vedanto28/BRAG---Better-RAG-", "Provenance contains correct owner/repo repository field");
      assert(firstExt.providerVersion === "1.0.0", "Provenance contains providerVersion '1.0.0'");
      assert(firstExt.payload !== undefined, "Provenance contains payload object");

    } finally {
      await gitHubMcpProvider.reset();
      await stopServer();
      EXTERNAL_MCP_CONFIG.MOCK_EXTERNAL_MCP = originalMock;
      gitHubMcpProvider._repoInfo = undefined;
    }
  }

  console.log("\n==================================================");
  console.log(`ALL ${passedTests}/${totalTests} GITHUB MCP TESTS PASSED SUCCESSFULLY!`);
  console.log("==================================================");
  process.exit(0);
}

runTests().catch(async err => {
  console.error("Test execution failed:", err);
  await stopServer();
  process.exit(1);
});
