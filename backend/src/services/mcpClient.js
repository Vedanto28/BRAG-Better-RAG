import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { ConnectionCircuitBreaker } from "./connectionCircuitBreaker.js";
import { EXTERNAL_MCP_CONFIG } from "../utils/config.js";

let clientInstance = null;
let transportInstance = null;

export const internalCircuitBreaker = new ConnectionCircuitBreaker(
  "internal",
  EXTERNAL_MCP_CONFIG.CIRCUIT_BREAKER_MAX_ATTEMPTS,
  EXTERNAL_MCP_CONFIG.CIRCUIT_BREAKER_WINDOW_MS
);

export async function getMcpClient() {
  if (global.__mcpTestTracker) {
    global.__mcpTestTracker.invocations = (global.__mcpTestTracker.invocations || 0) + 1;
  }

  if (internalCircuitBreaker.isTripped()) {
    throw new Error("Connection blocked: circuit breaker tripped for provider internal");
  }

  if (clientInstance) {
    console.log("[MCP] getMcpClient requested, returning existing active client (internal). State: CONNECTED", "clientRef:", clientInstance ? "exists" : "null");
    return clientInstance;
  }

  if (!internalCircuitBreaker.recordAttempt()) {
    throw new Error("Connection blocked: circuit breaker tripped for provider internal");
  }

  const port = process.env.PORT || 5000;
  const sseUrl = new URL(`http://localhost:${port}/api/sse`);
  console.log(`[MCP Client] Connecting to: ${sseUrl.href}`);
  console.log("[MCP] connect() called: internal", new Date().toISOString(), "URL:", sseUrl.href);

  let transport = null;
  try {
    transport = new SSEClientTransport(sseUrl);
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
      new Promise((_, reject) => setTimeout(() => reject(new Error("MCP connection timeout")), 5000))
    ]);
    clientInstance = client;
    transportInstance = transport;
    console.log("[MCP Client] Connected successfully.");
    return client;
  } catch (error) {
    console.error("[MCP Client] Connection error:", error.message || error);
    if (transport) {
      try {
        console.log("[MCP Client] Connection failed/timeout. Closing transport immediately.");
        await transport.close();
      } catch (closeErr) {
        console.warn("[MCP Client] Error closing transport on failure:", closeErr.message || closeErr);
      }
    }
    clientInstance = null;
    transportInstance = null;
    throw error;
  }
}

export async function resetMcpClient() {
  if (clientInstance) {
    console.log("[MCP] close() called: internal", new Date().toISOString(), "Client name:", clientInstance.name);
    console.log("[MCP Client] Resetting and clearing client instance.");
    const oldClient = clientInstance;
    const oldTransport = transportInstance;
    clientInstance = null;
    transportInstance = null;

    if (oldTransport) {
      try {
        await oldTransport.close();
      } catch (e) {
        console.warn("[MCP Client] Error closing transport:", e.message || e);
      }
    }

    try {
      await oldClient.close();
    } catch (e) {
      console.warn("[MCP Client] Error closing client:", e.message || e);
    }
  }
}

