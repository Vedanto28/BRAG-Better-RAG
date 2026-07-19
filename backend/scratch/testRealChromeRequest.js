import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const currentFilePath = fileURLToPath(import.meta.url);
const scratchDir = path.dirname(currentFilePath);
const projectRoot = path.resolve(scratchDir, '..');

const rootEnvPath = path.resolve(projectRoot, '.env');
const backendEnvPath = path.resolve(projectRoot, 'backend', '.env');
dotenv.config({ path: backendEnvPath });
dotenv.config({ path: rootEnvPath });

// Enable Chrome DevTools MCP and disable mock mode
process.env.CHROME_MCP_ENABLED = 'true';
delete process.env.MOCK_LLM;
process.env.LLM_PROVIDER = 'gemini';

async function run() {
  const { EXTERNAL_MCP_CONFIG } = await import('../src/utils/config.js');
  const { default: chromeDevToolsMcpProvider } = await import('../src/services/chromeDevToolsMcpProvider.js');
  const { runAgentOrchestrator } = await import('../src/services/agentOrchestrator.js');

  console.log("CHROME_MCP_ENABLED:", EXTERNAL_MCP_CONFIG.CHROME_MCP_ENABLED);
  console.log("CHROME_EXECUTABLE_PATH:", EXTERNAL_MCP_CONFIG.CHROME_EXECUTABLE_PATH);

  const isAvail = await chromeDevToolsMcpProvider.isAvailable();
  console.log("chromeDevToolsMcpProvider.isAvailable():", isAvail);

  if (!isAvail) {
    console.log("Chrome DevTools MCP is NOT available. Exiting.");
    return;
  }

  const query = "Open http://localhost:5000/api/health in the browser and verify the page loads correctly.";
  console.log(`Sending query: "${query}"`);
  
  try {
    const result = await runAgentOrchestrator(query);
    console.log("Result success:", result.success);
    console.log("Mode:", result.metadata.mode);
    console.log("Tools Used:", result.metadata.toolsUsed);
    console.log("External Evidence:", JSON.stringify(result.metadata.externalEvidence, null, 2));
    console.log("Answer preview:\n", result.answer.slice(0, 500));
  } catch (err) {
    console.error("Error during execution:", err);
  } finally {
    await chromeDevToolsMcpProvider.reset();
  }
}

run();
