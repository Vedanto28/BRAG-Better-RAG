import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const scratchDir = path.dirname(currentFilePath);
const projectRoot = path.resolve(scratchDir, '..', '..');

const rootEnvPath = path.resolve(projectRoot, '.env');
const backendEnvPath = path.resolve(projectRoot, 'backend', '.env');
dotenv.config({ path: backendEnvPath });
dotenv.config({ path: rootEnvPath });

const token = process.env.CONTEXT7_MCP_TOKEN || process.env['CONTEXT7-MCP'] || '';

async function main() {
  console.log("Starting Context7 MCP server with token:", token ? "FOUND" : "NOT FOUND");
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["-y", "@upstash/context7-mcp", "--api-key", token]
  });

  const client = new Client(
    {
      name: "test-client",
      version: "1.0.0"
    },
    {
      capabilities: {}
    }
  );

  console.log("Connecting to transport...");
  await client.connect(transport);

  console.log("Listing tools...");
  const response = await client.listTools();
  console.log("Tools found:", JSON.stringify(response.tools, null, 2));

  console.log("Exiting...");
  await transport.close();
  process.exit(0);
}

main().catch(err => {
  console.error("Error discovering tools:", err);
  process.exit(1);
});
