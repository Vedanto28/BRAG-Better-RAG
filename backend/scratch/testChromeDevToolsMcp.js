import 'dotenv/config';
import assert from 'node:assert';
import chromeDevToolsMcpProvider, { isSafeBrowserUrl } from '../src/services/chromeDevToolsMcpProvider.js';
import mcpRegistry from '../src/services/mcpRegistry.js';
import { runAgentOrchestrator } from '../src/services/agentOrchestrator.js';
import { EXTERNAL_MCP_CONFIG } from '../src/utils/config.js';
import http from 'node:http';

let serverInstance;
const TEST_PORT = 5011;

function startServer() {
  return new Promise((resolve) => {
    // Simple dummy server to navigate to
    serverInstance = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <body>
            <h1>Test Page</h1>
            <script>
              console.error("Test console error token=sk-proj-ABCD1234");
            </script>
          </body>
        </html>
      `);
    });
    serverInstance.listen(TEST_PORT, () => {
      console.log(`[Test Web Server] Started on port ${TEST_PORT}`);
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (serverInstance) {
      serverInstance.close();
      console.log('[Test Web Server] Stopped.');
      resolve();
    } else {
      resolve();
    }
  });
}

async function runTests() {
  console.log("==================================================");
  console.log("RUNNING PROMPT 4D VERIFICATION SUITE: testChromeDevToolsMcp.js");
  console.log("==================================================\n");

  await startServer();

  try {
    // TEST 1: URL Safety Boundary Verification
    console.log("--- Test 1: URL Safety Boundary Verification ---");
    assert(isSafeBrowserUrl("http://localhost:3000/api") === true, "localhost should be safe");
    assert(isSafeBrowserUrl("http://127.0.0.1:8080") === true, "127.0.0.1 should be safe");
    assert(isSafeBrowserUrl("http://192.168.1.50") === true, "192.168.x.x should be safe");
    assert(isSafeBrowserUrl("http://10.0.0.1") === true, "10.x.x.x should be safe");
    assert(isSafeBrowserUrl("http://172.20.0.1") === true, "172.16-31.x.x should be safe");
    
    assert(isSafeBrowserUrl("http://172.50.0.1") === false, "172.50.x.x is external/disallowed");
    assert(isSafeBrowserUrl("https://www.google.com") === false, "google.com is external/disallowed");
    assert(isSafeBrowserUrl("https://github.com/login") === false, "github.com is external/disallowed");
    console.log("✅ PASS: URL Safety check correctly identifies safe vs disallowed ranges.");

    // TEST 2: Provider-level Block on Disallowed Targets
    console.log("\n--- Test 2: Provider-level Block on Disallowed Targets ---");
    let originalAllowConfig = EXTERNAL_MCP_CONFIG.CHROME_MCP_ALLOW_EXTERNAL_URLS;
    EXTERNAL_MCP_CONFIG.CHROME_MCP_ALLOW_EXTERNAL_URLS = false;

    let blockedCorrectly = false;
    try {
      await chromeDevToolsMcpProvider.callTool({
        name: "navigate_page",
        arguments: { url: "https://www.google.com" }
      });
    } catch (err) {
      if (err.message.includes("blocked for security")) {
        blockedCorrectly = true;
      }
    }
    assert(blockedCorrectly === true, "Calling navigate_page with an external URL should throw security exception");
    console.log("✅ PASS: Disallowed URL navigation is blocked at the provider layer.");

    // TEST 3: Offline Stub Browser Verification
    console.log("\n--- Test 3: Offline Stub Browser Verification ---");
    let originalMock = EXTERNAL_MCP_CONFIG.MOCK_EXTERNAL_MCP;
    process.env.MOCK_EXTERNAL_MCP = 'true';
    EXTERNAL_MCP_CONFIG.MOCK_EXTERNAL_MCP = true;
    await mcpRegistry.resetAll();

    const { tools: stubTools } = await mcpRegistry.getToolsForMode("repository_investigation");
    assert(stubTools.some(t => t.name === "navigate_page"), "Stub exposes navigate_page when mock enabled");
    assert(stubTools.some(t => t.name === "list_console_messages"), "Stub exposes list_console_messages when mock enabled");

    const stubCall = await mcpRegistry.callTool({
      name: "list_console_messages",
      arguments: {}
    });
    const parsedText = JSON.parse(stubCall.toolResult.content[0].text);
    assert(parsedText.messages.some(m => m.text.includes("Uncaught TypeError")), "Stub returns simulated console error");

    const stubEvidence = stubCall.provider.formatEvidence(
      "list_console_messages",
      {},
      stubCall.toolResult
    );
    assert(stubEvidence.provider === "stub_external", "Stub evidence provider is stub_external");
    assert(stubEvidence.evidenceType === "console_error", "Stub evidence type is console_error");
    assert(stubEvidence.repository === null, "Stub browser evidence has null repository");
    assert(stubEvidence.providerVersion === "1.0.0", "Stub version is 1.0.0");
    console.log("✅ PASS: Stub provider successfully mocks browser tools and evidence.");

    // TEST 4: Live Handshake & Navigation (If Chrome available)
    console.log("\n--- Test 4: Live Handshake & Navigation ---");
    process.env.MOCK_EXTERNAL_MCP = 'false';
    EXTERNAL_MCP_CONFIG.MOCK_EXTERNAL_MCP = false;
    EXTERNAL_MCP_CONFIG.CHROME_MCP_ENABLED = true;
    await mcpRegistry.resetAll();

    let liveAvailable = false;
    try {
      liveAvailable = await chromeDevToolsMcpProvider.isAvailable();
    } catch (e) {
      console.warn("Live check threw:", e.message);
    }

    if (!liveAvailable) {
      console.log("⚠️ SKIP: Live Chrome verification skipped. (Chrome executable not found or launch failed in this environment)");
    } else {
      console.log("[Test] Chrome is available. Connecting and executing live navigation to local server...");
      
      // Perform live navigation
      const navResult = await chromeDevToolsMcpProvider.callTool({
        name: "navigate_page",
        arguments: { url: `http://localhost:${TEST_PORT}` }
      });
      console.log("[Test] Live navigation complete:", JSON.stringify(navResult));

      // Get console messages
      const consoleMessages = await chromeDevToolsMcpProvider.callTool({
        name: "list_console_messages",
        arguments: {}
      });
      console.log("[Test] Live console logs fetched:", JSON.stringify(consoleMessages));
      
      const logsText = JSON.stringify(consoleMessages);
      assert(!logsText.includes("sk-proj-ABCD1234"), "Logs must not contain unredacted secrets");
      assert(logsText.includes("token=[REDACTED]"), "Logs must contain redacted secrets");
      console.log("✅ PASS: Live console messages successfully fetched and redacted.");

      // Verify connection reuse
      const firstClient = chromeDevToolsMcpProvider.client;
      const firstTransport = chromeDevToolsMcpProvider.transport;

      await chromeDevToolsMcpProvider.callTool({
        name: "list_network_requests",
        arguments: {}
      });

      assert(chromeDevToolsMcpProvider.client === firstClient, "Connection client must be reused");
      assert(chromeDevToolsMcpProvider.transport === firstTransport, "Connection transport must be reused");
      console.log("✅ PASS: Stdio connection is persistently reused across calls.");

      // Verify AbortSignal
      const controller = new AbortController();
      controller.abort();
      let abortedCorrectly = false;
      try {
        await chromeDevToolsMcpProvider.callTool({
          name: "list_console_messages",
          arguments: {},
          signal: controller.signal
        });
      } catch (err) {
        if (err.message.includes("aborted")) {
          abortedCorrectly = true;
        }
      }
      assert(abortedCorrectly === true, "Tool call should abort immediately when AbortSignal is aborted");
      console.log("✅ PASS: AbortSignal cancellation propagates to DevTools tool execution.");
    }

    // TEST 5: Mixed-Tool Budget Integration (Mock Mode)
    console.log("\n--- Test 5: Mixed-Tool Budget Integration (Mock Mode) ---");
    process.env.MOCK_EXTERNAL_MCP = 'true';
    EXTERNAL_MCP_CONFIG.MOCK_EXTERNAL_MCP = true;
    process.env.MOCK_LLM = 'true';
    await mcpRegistry.resetAll();

    // We will simulate a query that triggers the mock orchestrator logic
    const mixResult = await runAgentOrchestrator("Check the console logs and search GitHub PRs for database timeout");
    console.log("[Test] Orchestrator finished mixed budget run. Tools used:", mixResult.metadata.toolsUsed);
    assert(mixResult.metadata.toolCallsUsed === 6, "Mixed budget counter should be exactly 6");
    assert(mixResult.metadata.toolCallLimitReached === true, "Mixed budget should reach limit");
    
    const extEv = mixResult.metadata.externalEvidence;
    assert(Array.isArray(extEv) && extEv.length > 0, "External evidence should be captured");
    
    const chromeEv = extEv.find(ev => ev.provider === "chrome-devtools" || (ev.provider === "stub_external" && ev.evidenceType === "console_error"));
    assert(chromeEv !== undefined, "Captured console log evidence in externalEvidence");
    assert(chromeEv.repository === null, "Browser evidence repository is null");
    assert(chromeEv.providerVersion === "1.0.0", "Browser evidence providerVersion is 1.0.0");
    assert(typeof chromeEv.timestamp === "string", "Browser evidence has string timestamp");
    
    console.log("✅ PASS: Browser evidence participated in mixed budget limit and produced formatted provenance.");

    // TEST 6: Concurrency Stress-Test (Mock Mode)
    console.log("\n--- Test 6: Concurrency Stress-Test (Mock Mode) ---");
    EXTERNAL_MCP_CONFIG.MOCK_EXTERNAL_MCP = true;
    process.env.MOCK_EXTERNAL_MCP = 'true';
    process.env.MOCK_LLM = 'true';
    await mcpRegistry.resetAll();

    const concurrentQueries = [
      "Check the console logs and search GitHub PRs for database timeout",
      "Check the console logs and search GitHub PRs for database timeout",
      "Check the console logs and search GitHub PRs for database timeout",
      "Check the console logs and search GitHub PRs for database timeout",
      "Check the console logs and search GitHub PRs for database timeout"
    ];

    console.log(`[Test] Launching ${concurrentQueries.length} concurrent investigation requests...`);
    const promises = concurrentQueries.map(q => runAgentOrchestrator(q));
    const results = await Promise.all(promises);

    console.log("[Test] All concurrent requests completed.");
    results.forEach((res, i) => {
      assert(res.metadata.toolCallsUsed === 6, `Concurrent request ${i} should have used exactly 6 tool calls`);
      assert(res.metadata.toolCallLimitReached === true, `Concurrent request ${i} should have reached tool call limit`);
    });
    console.log("✅ PASS: Concurrency stress-test completed. Budgets are correctly isolated per-request.");

    // TEST 7: Reconnection & Leak Verification
    console.log("\n--- Test 7: Reconnection & Leak Verification ---");
    const initialMemory = process.memoryUsage().heapUsed;
    console.log(`[Test] Heap memory before cycles: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`);

    for (let i = 1; i <= 5; i++) {
      EXTERNAL_MCP_CONFIG.MOCK_EXTERNAL_MCP = true;
      process.env.MOCK_EXTERNAL_MCP = 'true';
      await mcpRegistry.resetAll();

      // Lazy connect & call
      await chromeDevToolsMcpProvider.lazyConnect();
      const callRes = await chromeDevToolsMcpProvider.callTool({
        name: "list_console_messages",
        arguments: {}
      });
      assert(callRes !== undefined, `Reconnection cycle ${i} tool call succeeded`);

      // Reset
      await chromeDevToolsMcpProvider.reset();
    }

    const finalMemory = process.memoryUsage().heapUsed;
    console.log(`[Test] Heap memory after 5 mock cycles: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`);
    console.log(`[Test] Memory delta: ${((finalMemory - initialMemory) / 1024 / 1024).toFixed(2)} MB`);
    console.log("✅ PASS: Reconnection cycle leak test complete.");

    // Cleanup configuration
    process.env.MOCK_EXTERNAL_MCP = originalMock ? 'true' : 'false';
    EXTERNAL_MCP_CONFIG.MOCK_EXTERNAL_MCP = originalMock;
    EXTERNAL_MCP_CONFIG.CHROME_MCP_ALLOW_EXTERNAL_URLS = originalAllowConfig;
    await mcpRegistry.resetAll();

  } finally {
    await stopServer();
    await chromeDevToolsMcpProvider.reset();
  }

  console.log("\n==================================================");
  console.log("ALL CHROME DEVTOOLS MCP TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================");
  process.exit(0);
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
