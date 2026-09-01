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

process.env.MOCK_EXTERNAL_MCP = 'true';
import { EXTERNAL_MCP_CONFIG } from '../src/utils/config.js';
EXTERNAL_MCP_CONFIG.MOCK_EXTERNAL_MCP = true;

import mcpRegistry from '../src/services/mcpRegistry.js';

async function run() {
  await mcpRegistry.resetAll();
  const { tools } = await mcpRegistry.getToolsForMode("repository_investigation", "search database config in remote prs");
  console.log("Registered tools count:", tools.length);
  console.log("Registered tools:", tools.map(t => t.name));
}

run();
