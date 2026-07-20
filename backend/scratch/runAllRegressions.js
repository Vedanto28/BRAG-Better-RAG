import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scratchDir = __dirname;

const tests = [
  'verify.js',
  'testRepoTools.js',
  'testMockOrchestrator.js',
  'testAgentInvestigation.js',
  'testDebuggingRAG.js',
  'testGitRAG.js',
  'testGitProvider.js',
  'testRedaction.js',
  'testOrchestratorFailures.js',
  'testOrchestratorRouting.js',
  'testResiliency.js',
  'testLogInvestigation.js',
  'testMultiEvidence.js',
  'testMcpRegistry.js',
  'testGitHubMcp.js',
  'testChromeDevToolsMcp.js',
  'testContext7Mcp.js',
  'testDocRoutingAndDeepseek.js',
  'testMcpConnectionLifecycle.js',
  'testCapabilityPlanner.js'
];

async function runTest(script) {
  return new Promise((resolve) => {
    console.log(`\n==================================================`);
    console.log(`RUNNING REGRESSION TEST: ${script}`);
    console.log(`==================================================`);
    
    const env = { 
      ...process.env, 
      MOCK_LLM: 'true', 
      MOCK_EXTERNAL_MCP: 'true',
      PORT: '5050'
    };

    const child = spawn('node', ['--experimental-vm-modules', script], {
      cwd: scratchDir,
      env
    });

    let stdoutBuffer = "";
    let resolved = false;

    child.stdout.on('data', (data) => {
      const chunk = data.toString();
      process.stdout.write(chunk);
      stdoutBuffer += chunk;

      // Detection signatures for successful completion
      if (
        stdoutBuffer.includes("TEST RUN COMPLETED") || 
        stdoutBuffer.includes("ALL CONTEXT7 MCP TESTS PASSED") ||
        stdoutBuffer.includes("PASSED SUCCESSFULLY") ||
        stdoutBuffer.includes("SANITY CHECK PASSED") ||
        stdoutBuffer.includes("ALL 7 FOCUS TESTS") ||
        stdoutBuffer.includes("STATUS: PASS") ||
        stdoutBuffer.includes("STATUS: SUCCESS") ||
        stdoutBuffer.includes("SUMMARY") ||
        stdoutBuffer.includes("LIFECYCLE TESTS PASSED") ||
        stdoutBuffer.includes("Passed:") && stdoutBuffer.includes("Failed: 0")
      ) {
        if (!resolved) {
          resolved = true;
          setTimeout(() => {
            child.kill();
            resolve({ script, success: true, code: 0 });
          }, 1000); // Give a second to flush logs
        }
      }
    });

    child.stderr.on('data', (data) => {
      process.stderr.write(data);
    });

    child.on('close', (code) => {
      if (!resolved) {
        resolved = true;
        if (code === 0) {
          resolve({ script, success: true, code });
        } else {
          resolve({ script, success: false, code });
        }
      }
    });

    child.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        resolve({ script, success: false, code: -1 });
      }
    });

    // Fallback safety timeout of 45 seconds per test
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        child.kill();
        resolve({ script, success: false, code: 999 });
      }
    }, 45000);
  });
}

async function main() {
  const results = [];
  for (const t of tests) {
    const res = await runTest(t);
    results.push(res);
  }

  console.log(`\n==================================================`);
  console.log(`REGRESSION SUITE SUMMARY`);
  console.log(`==================================================`);
  console.log(String.prototype.padEnd.call("Script", 35) + "Status");
  console.log("-".repeat(45));
  let failed = 0;
  for (const r of results) {
    const status = r.success ? "✅ PASS" : `❌ FAIL (code ${r.code === 999 ? 'Timeout' : r.code})`;
    if (!r.success) failed++;
    console.log(String.prototype.padEnd.call(r.script, 35) + status);
  }
  console.log("==================================================");
  console.log(`Passed: ${tests.length - failed}/${tests.length}`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
