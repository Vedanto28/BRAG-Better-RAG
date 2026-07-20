import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { planCapabilities } from '../src/services/capabilityPlanner.js';
import { runAgentOrchestrator } from '../src/services/agentOrchestrator.js';
import mcpRegistry from '../src/services/mcpRegistry.js';
import { EXTERNAL_MCP_CONFIG } from '../src/utils/config.js';
import app from '../server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.REPO_ROOT_PATH = path.resolve(__dirname, '../..');
process.env.MOCK_LLM = 'true';
process.env.MOCK_EXTERNAL_MCP = 'true';
EXTERNAL_MCP_CONFIG.MOCK_EXTERNAL_MCP = true;

const TEST_PORT = 5025;
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
  console.log("RUNNING PROMPT 5A VERIFICATION SUITE: testCapabilityPlanner.js");
  console.log("==================================================\n");

  await startServer();

  try {
    // ----------------------------------------------------
    // Test 1: "What is JavaScript?"
    // ----------------------------------------------------
    console.log("--- Test 1: Conceptual Exclusions (Bypass) ---");
    const plan1 = planCapabilities("What is JavaScript?");
    assert(!plan1.requiresRepository, "JavaScript concept query should not require repository");
    assert(!plan1.requiresGit, "JavaScript concept query should not require git");
    assert(!plan1.requiresRuntime, "JavaScript concept query should not require runtime");
    assert(!plan1.requiresDocumentation, "JavaScript concept query should not require documentation");
    assert(!plan1.requiresDebuggingRag, "JavaScript concept query should not require debugging RAG");

    const res1 = await runAgentOrchestrator("What is JavaScript?");
    assert(res1.success, "Orchestrator response was successful");
    assert(res1.metadata.mode === "normal_chat", "Orchestrator routed to normal_chat");
    assert(res1.metadata.toolsUsed.length === 0, "No tools used for conceptual query");

    // ----------------------------------------------------
    // Test 2: "How does Next.js App Router handle nested layouts?"
    // ----------------------------------------------------
    console.log("\n--- Test 2: Documentation Query ---");
    const plan2 = planCapabilities("How does Next.js App Router handle nested layouts?");
    assert(plan2.requiresDocumentation, "Next.js App Router query requires documentation");
    assert(plan2.suggestedPriority && plan2.suggestedPriority.includes("Context7 Documentation"), "Should prioritize Context7");
    assert(plan2.suggestedBudgetGuidance.includes("Look up the official documentation"), "Should suggest budget for documentation");

    const res2 = await runAgentOrchestrator("How does Next.js App Router handle nested layouts?");
    assert(res2.success, "Orchestrator response was successful");
    assert(res2.metadata.capabilityPlan.requiresDocumentation, "Response metadata capability plan shows requiresDocumentation");

    // ----------------------------------------------------
    // Test 3: "My auth.ts broke after yesterday's commit"
    // ----------------------------------------------------
    console.log("\n--- Test 3: Git + Repository Query ---");
    const plan3 = planCapabilities("My auth.ts broke after yesterday's commit");
    assert(plan3.requiresGit, "auth.ts change query requires git");
    assert(plan3.requiresRepository, "auth.ts change query requires repository");
    assert(plan3.suggestedPriority && plan3.suggestedPriority.includes("Git History"), "Should prioritize Git History");

    const res3 = await runAgentOrchestrator("My auth.ts broke after yesterday's commit");
    assert(res3.success, "Orchestrator response was successful");
    assert(res3.metadata.capabilityPlan.requiresGit, "Response metadata shows requiresGit");
    assert(res3.metadata.capabilityPlan.requiresRepository, "Response metadata shows requiresRepository");

    // ----------------------------------------------------
    // Test 4: "My React page went blank after upgrading Next.js yesterday."
    // ----------------------------------------------------
    console.log("\n--- Test 4: Compound Query (Multiple Capabilities) ---");
    const plan4 = planCapabilities("My React page went blank after upgrading Next.js yesterday.");
    assert(plan4.requiresRuntime, "React page went blank requires runtime");
    assert(plan4.requiresDocumentation, "Next.js upgrading requires documentation");
    assert(plan4.requiresRepository, "React page upgrading requires repository");
    assert(plan4.requiresGit, "upgrading Next.js yesterday requires git");

    // Let's verify provider relevance for plan4
    const relevantProviders = [];
    for (const p of mcpRegistry.providers) {
      if (mcpRegistry.isRelevantForCapabilities(p, plan4)) {
        relevantProviders.push(p.name);
      }
    }
    console.log("Exposed providers for compound query:", relevantProviders);
    assert(relevantProviders.includes("internal"), "Should expose internal provider");
    assert(relevantProviders.includes("stub_external"), "Should expose stub_external provider (in mock mode)");
    assert(relevantProviders.includes("chrome-devtools"), "Should expose chrome-devtools provider");
    assert(relevantProviders.includes("context7"), "Should expose context7 provider");

    console.log("\n==================================================");
    console.log(`ALL TESTS PASSED SUCCESSFULLY: ${passedTests}/${totalTests}`);
    console.log("==================================================");
    await stopServer();
    process.exit(0);
  } catch (error) {
    console.error("Test execution failed:", error);
    await stopServer();
    process.exit(1);
  }
}

runTests();
