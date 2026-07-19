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
  const { runAgentOrchestrator } = await import('../src/services/agentOrchestrator.js');
  const query = "List the active or merged pull requests in this repository from GitHub.";
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
  }
}

run();
