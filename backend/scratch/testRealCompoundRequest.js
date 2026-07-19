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
  const query = "My auth logic broke after the last commit — check what changed recently on GitHub and confirm we are using the current recommended JWT verification pattern from official documentation.";
  console.log(`Sending compound query: "${query}"`);
  
  try {
    const result = await runAgentOrchestrator(query);
    console.log("Result success:", result.success);
    console.log("Mode:", result.metadata.mode);
    console.log("Tools Used:", result.metadata.toolsUsed);
    console.log("External Evidence Providers:", result.metadata.externalEvidence.map(e => e.provider));
    console.log("Answer preview:\n", result.answer.slice(0, 500));
  } catch (err) {
    console.error("Error during execution:", err);
  }
}

run();
