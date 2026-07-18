import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  console.log("Starting GitHub MCP server...");
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: {
      ...process.env,
      GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_MCP_TOKEN || "dummy_token"
    }
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
  console.log("Tools found:", response.tools.map(t => t.name));

  console.log("Exiting...");
  await transport.close();
  process.exit(0);
}

main().catch(err => {
  console.error("Error discovering tools:", err);
  process.exit(1);
});
