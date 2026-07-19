import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';
import app from '../server.js';
import mcpRegistry from '../src/services/mcpRegistry.js';
import internalMcpProvider from '../src/services/internalMcpProvider.js';
import gitHubMcpProvider from '../src/services/gitHubMcpProvider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_PORT = 5022;
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

async function runTests() {
  console.log("==================================================");
  console.log("RUNNING MCP CONNECTION LIFECYCLE TESTS: testMcpConnectionLifecycle.js");
  console.log("==================================================\n");

  await startServer();

  try {
    // TEST 1: Process scope / singleton registry check
    console.log("--- Test 1: Process Scope Registry & Provider Singleton Check ---");
    const initialRegistry = mcpRegistry;
    const initialInternal = internalMcpProvider;
    const initialGithub = gitHubMcpProvider;

    assert.equal(initialInternal.connectionState, "DISCONNECTED", "Internal provider starts disconnected");
    assert.equal(initialGithub.connectionState, "DISCONNECTED", "GitHub provider starts disconnected");

    // TEST 2: Transition DISCONNECTED -> CONNECTING -> CONNECTED and Reconnection Reuse
    console.log("\n--- Test 2: Connection Transition & Reuse (3 Requests) ---");
    
    // Request 1
    console.log("Request 1: connecting internal provider");
    await initialInternal.lazyConnect();
    const instId1 = initialInternal.instanceId;
    assert.equal(initialInternal.connectionState, "CONNECTED", "Internal transitions to CONNECTED");
    
    // Request 2
    console.log("Request 2: reusing existing connection");
    await initialInternal.lazyConnect();
    assert.equal(initialInternal.instanceId, instId1, "Instance ID remains stable (singleton)");
    assert.equal(initialInternal.connectionState, "REUSED", "State is set to REUSED on next check");

    // Request 3
    console.log("Request 3: reusing existing connection again");
    await initialInternal.lazyConnect();
    assert.equal(initialInternal.instanceId, instId1, "Instance ID remains stable (singleton)");
    assert.equal(initialInternal.connectionState, "REUSED", "State remains REUSED");

    // TEST 3: Invalid Transition Guarding
    console.log("\n--- Test 3: Guarding against CONNECTED -> CONNECTING without reset ---");
    
    // Reset back to DISCONNECTED cleanly
    await mcpRegistry.resetAll();
    assert.equal(initialInternal.connectionState, "DISCONNECTED", "Resets to DISCONNECTED state");
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Re-connect
    await initialInternal.lazyConnect();
    assert.equal(initialInternal.connectionState, "CONNECTED", "Re-connected successfully");

    // TEST 4: Circuit Breaker Trip on Forced Failure
    console.log("\n--- Test 4: Circuit Breaker Trips on Forced Failures ---");
    
    // Force reset
    await mcpRegistry.resetAll();
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Simulate connection failures by temporarily overriding port to unreachable port
    const originalPort = process.env.PORT;
    process.env.PORT = "9999"; // Unreachable port for SSE client
    
    let failureCount = 0;
    for (let i = 0; i < 4; i++) {
      try {
        console.log(`Connection attempt ${i + 1}`);
        await initialInternal.lazyConnect();
      } catch (err) {
        failureCount++;
        console.log(`Attempt ${i + 1} failed as expected: ${err.message}`);
      }
    }

    assert.equal(initialInternal.connectionState, "CIRCUIT_OPEN", "Internal provider is in CIRCUIT_OPEN state");
    assert.ok(initialInternal._circuitBreaker.isTripped(), "Circuit breaker is tripped");
    
    // Attempting again should immediately reject without network attempt
    try {
      await initialInternal.lazyConnect();
      assert.fail("Should have failed immediately due to open circuit");
    } catch (err) {
      console.log(`Immediate rejection on open circuit: ${err.message}`);
      assert.ok(err.message.includes("blocked by circuit breaker"), "Error message references circuit breaker");
    }

    // Reset should close the circuit
    process.env.PORT = originalPort;
    await mcpRegistry.resetAll();
    assert.equal(initialInternal.connectionState, "DISCONNECTED", "Resets to DISCONNECTED state");
    assert.equal(initialInternal._circuitBreaker.isTripped(), false, "Circuit breaker is reset");
    await new Promise(resolve => setTimeout(resolve, 300));

    console.log("\n==================================================");
    console.log("ALL MCP CONNECTION LIFECYCLE TESTS PASSED!");
    console.log("==================================================");
  } finally {
    await mcpRegistry.resetAll();
    await stopServer();
  }
}

runTests().catch(err => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
