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

delete process.env.MOCK_LLM;
process.env.LLM_PROVIDER = 'gemini';

async function run() {
  const { EXTERNAL_MCP_CONFIG } = await import('../src/utils/config.js');
  const { default: mcpRegistry } = await import('../src/services/mcpRegistry.js');
  const { default: context7McpProvider } = await import('../src/services/context7McpProvider.js');
  
  console.log("EXTERNAL_MCP_CONFIG:", {
    CONTEXT7_MCP_ENABLED: EXTERNAL_MCP_CONFIG.CONTEXT7_MCP_ENABLED,
    CONTEXT7_MCP_TOKEN: EXTERNAL_MCP_CONFIG.CONTEXT7_MCP_TOKEN ? "SET" : "EMPTY",
    MOCK_EXTERNAL_MCP: EXTERNAL_MCP_CONFIG.MOCK_EXTERNAL_MCP
  });

  const isAvail = await context7McpProvider.isAvailable();
  console.log("context7McpProvider.isAvailable():", isAvail);

  const tools = await mcpRegistry.getToolsForMode("documentation_lookup", "How does Next.js App Router handle nested layouts? Use official documentation.");
  console.log("Registered tools for documentation_lookup:", tools.map(t => t.name));

  const query = "How does Next.js App Router handle nested layouts? Use official documentation.";
  console.log(`Sending query: "${query}"`);
  
  try {
    const { runAgentOrchestrator } = await import('../src/services/agentOrchestrator.js');
    const result = await runAgentOrchestrator(query);
    console.log("Result success:", result.success);
    console.log("Mode:", result.metadata.mode);
    console.log("Tools Used:", result.metadata.toolsUsed);
    console.log("Answer preview:\n", result.answer.slice(0, 500));
  } catch (err) {
    console.error("Error during execution:", err);
  }
}

run();
