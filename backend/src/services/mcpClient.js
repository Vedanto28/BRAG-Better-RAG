import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

let clientInstance = null;

export async function getMcpClient() {
  if (global.__mcpTestTracker) {
    global.__mcpTestTracker.invocations = (global.__mcpTestTracker.invocations || 0) + 1;
  }

  if (clientInstance) {
    return clientInstance;
  }

  const port = process.env.PORT || 5000;
  const sseUrl = new URL(`http://localhost:${port}/api/sse`);
  console.log(`[MCP Client] Connecting to: ${sseUrl.href}`);

  try {
    const transport = new SSEClientTransport(sseUrl);
    const client = new Client(
      {
        name: "mechamaru-mcp-client",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    const connectPromise = client.connect(transport);
    await Promise.race([
      connectPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("MCP connection timeout")), 2000))
    ]);
    clientInstance = client;
    console.log("[MCP Client] Connected successfully.");
    return client;
  } catch (error) {
    console.error("[MCP Client] Connection error:", error.message || error);
    clientInstance = null;
    throw error;
  }
}

export function resetMcpClient() {
  if (clientInstance) {
    console.log("[MCP Client] Resetting and clearing client instance.");
    clientInstance = null;
  }
}

