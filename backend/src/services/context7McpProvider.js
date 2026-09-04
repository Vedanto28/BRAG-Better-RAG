import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { EXTERNAL_MCP_CONFIG } from '../utils/config.js';
import { redactSecrets } from '../utils/logParser.js';
import { ConnectionCircuitBreaker } from './connectionCircuitBreaker.js';

// Helper to run promises with a timeout
async function withTimeout(promise, timeoutMs = 10000, errorMsg = "Operation timed out") {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMsg));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

// Helper to abort promises on AbortSignal events
async function withSignal(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) {
    throw new Error("Request aborted.");
  }
  let onAbort;
  const abortPromise = new Promise((_, reject) => {
    onAbort = () => {
      reject(new Error("Request aborted."));
    };
    signal.addEventListener('abort', onAbort);
  });
  try {
    return await Promise.race([promise, abortPromise]);
  } finally {
    if (onAbort) {
      signal.removeEventListener('abort', onAbort);
    }
  }
}

// Recursive helper to redact and cap payload fields
function redactAndCapPayload(data) {
  if (typeof data === 'string') {
    let redacted = redactSecrets(data);
    if (redacted.length > 10000) {
      redacted = redacted.slice(0, 10000) + "\n\n[WARNING: Payload field truncated due to size limits.]";
    }
    return redacted;
  }
  if (Array.isArray(data)) {
    return data.map(item => redactAndCapPayload(item));
  }
  if (data !== null && typeof data === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = redactAndCapPayload(value);
    }
    return result;
  }
  return data;
}

export class Context7McpProvider {
  constructor() {
    this.name = "context7";
    this.category = "knowledge";
    this.isExternal = true;
    this.connected = false;
    this.client = null;
    this.transport = null;
    this._isAvailable = undefined;
    this.connectionId = 0;
    this.callCount = 0;
    this.instanceId = "context7-" + Math.random().toString(36).substring(2, 10);
    this.connectionState = "DISCONNECTED";
    this._circuitBreaker = new ConnectionCircuitBreaker(
      "context7",
      EXTERNAL_MCP_CONFIG.CIRCUIT_BREAKER_MAX_ATTEMPTS,
      EXTERNAL_MCP_CONFIG.CIRCUIT_BREAKER_WINDOW_MS
    );

    // Allowed read-only tools matching real Context7 MCP server
    this.allowedTools = [
      "resolve-library-id",
      "query-docs"
    ];
  }

  async isAvailable() {
    if (this._isAvailable !== undefined) return this._isAvailable;

    if (!EXTERNAL_MCP_CONFIG.CONTEXT7_MCP_ENABLED) {
      this._isAvailable = false;
      return false;
    }
    if (!EXTERNAL_MCP_CONFIG.CONTEXT7_MCP_TOKEN) {
      console.warn("[Context7McpProvider] Unavailable: API key is not configured.");
      this._isAvailable = false;
      return false;
    }
    if (EXTERNAL_MCP_CONFIG.MOCK_EXTERNAL_MCP) {
      this._isAvailable = false;
      return false;
    }

    try {
      console.log("[Context7McpProvider] Performing live availability check...");
      await this.lazyConnect();

      // Lightweight test call to resolve express library ID
      await withTimeout(
        this.client.callTool({
          name: "resolve-library-id",
          arguments: { libraryName: "express", query: "ping" }
        }),
        7000,
        "Availability check handshake timed out."
      );
      
      this._isAvailable = true;
      console.log("[Context7McpProvider] Live verification call succeeded.");
    } catch (err) {
      const msg = err.message || String(err);
      let reason = "service unreachable";
      if (msg.includes("401") || msg.toLowerCase().includes("unauthorized") || msg.toLowerCase().includes("api key") || msg.toLowerCase().includes("invalid")) {
        reason = "auth failure";
      } else if (msg.includes("429") || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("limit") || msg.toLowerCase().includes("exhausted")) {
        reason = "quota exceeded";
      }
      console.warn(`[Context7McpProvider] Live verification call failed (${reason}):`, msg);
      this._isAvailable = false;
      await this.reset();
    }

    return this._isAvailable;
  }

  async isRelevantForMode(mode, query) {
    if (!query) return false;
    const q = query.toLowerCase();
    
    // Mentions of library/framework/API or version
    const docKeywords = [
      "next.js", "nextjs", "react", "express", "mongoose", "mongodb", "postgres", "pg", 
      "supabase", "jwt", "dotenv", "cors", "npm", "node", "api", "version", "docs", 
      "documentation", "latest", "current", "how does", "example", "examples", "pattern"
    ];
    
    const hasKeyword = docKeywords.some(kw => q.includes(kw));
    
    return (mode === "repository_investigation" || mode === "log_investigation" || mode === "change_investigation" || mode === "documentation_lookup") && hasKeyword;
  }

  async lazyConnect() {
    if (this._circuitBreaker.isTripped()) {
      this.connectionState = "CIRCUIT_OPEN";
      throw new Error(`Connection blocked by circuit breaker for provider ${this.name}`);
    }

    if (this.connected) {
      this.connectionState = "REUSED";
      console.log(`[MCP] lazyConnect requested, returning existing active client (context7). State: ${this.connectionState} (instanceId: ${this.instanceId})`, "clientRef:", this.client ? "exists" : "null");
      return;
    }

    if (!this._circuitBreaker.recordAttempt()) {
      this.connectionState = "CIRCUIT_OPEN";
      throw new Error(`Connection blocked: circuit breaker tripped for provider ${this.name}`);
    }

    this.connectionState = "CONNECTING";
    this.connectionId++;
    console.log(`[Context7McpProvider] Lazy connecting to Context7 MCP server (connectionId: ${this.connectionId}, instanceId: ${this.instanceId})...`);
    console.log("[MCP] connect() called: context7", new Date().toISOString(), "InstanceId:", this.instanceId, "connectionId:", this.connectionId);

    try {
      const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      this.transport = new StdioClientTransport({
        command,
        args: ["-y", "@upstash/context7-mcp"],
        env: {
          ...process.env,
          CONTEXT7_API_KEY: EXTERNAL_MCP_CONFIG.CONTEXT7_MCP_TOKEN
        }
      });

      this.client = new Client(
        { name: "brag-context7-client", version: "1.0.0" },
        { capabilities: {} }
      );

      await withTimeout(
        this.client.connect(this.transport),
        15000,
        "Context7 MCP server connection handshake timed out."
      );

      this.connected = true;
      this.connectionState = "CONNECTED";
      console.log(`[Context7McpProvider] Connected to Context7 MCP server successfully (instanceId: ${this.instanceId}).`);
    } catch (err) {
      this.connected = false;
      if (this._circuitBreaker.isTripped()) {
        this.connectionState = "CIRCUIT_OPEN";
      } else {
        this.connectionState = "FAILED";
      }
      console.error(`[Context7McpProvider] Connection failed (instanceId: ${this.instanceId}):`, err.message || err);
      throw err;
    }
  }

  async listTools(mode) {
    if (!this.connected || !this.client) {
      return [];
    }

    const response = await this.client.listTools();
    const allTools = response.tools || [];
    return allTools.filter(t => this.allowedTools.includes(t.name));
  }

  async callTool({ name, arguments: args, signal }) {
    let attempts = 0;
    while (attempts < 2) {
      attempts++;
      try {
        if (!this.connected || !this.client) {
          await this.lazyConnect();
        }

        this.callCount++;
        console.log(`[Context7McpProvider] Reusing existing connection (connectionId: ${this.connectionId})`);

        const startTime = Date.now();
        const callPromise = this.client.callTool({ name, arguments: args });
        const result = await withTimeout(
          withSignal(callPromise, signal),
          15000,
          `Context7 MCP tool call ${name} timed out.`
        );

        const duration = Date.now() - startTime;
        console.log(`[Context7McpProvider] Tool call ${name} completed on connectionId ${this.connectionId}. Duration: ${duration}ms. Call count on this connection: ${this.callCount}`);

        // Apply secrets redaction and length capping on text results
        if (result && Array.isArray(result.content)) {
          for (const item of result.content) {
            if (item.type === 'text' && item.text) {
              let redactedText = redactSecrets(item.text);
              if (redactedText.length > 10000) {
                redactedText = redactedText.slice(0, 10000) + "\n\n[WARNING: Response truncated due to size limits.]";
              }
              item.text = redactedText;
            }
          }
        }

        return result;
      } catch (err) {
        const msg = err.message || String(err);
        const isClosedError = msg.includes("closed") ||
          msg.includes("Connection") ||
          msg.includes("EPIPE") ||
          msg.includes("ECONNRESET") ||
          msg.includes("not connected") ||
          msg.includes("handshake");
        
        if (isClosedError && attempts < 2) {
          console.warn(`[Context7McpProvider] Connection drop detected during ${name}. Resetting and retrying once...`);
          await this.reset();
          continue;
        }
        throw err;
      }
    }
  }

  formatEvidence(toolName, args, result) {
    let summary = `Context7 documentation lookup`;
    if (toolName === "resolve-library-id") {
      summary = `Resolved library ID for "${args.libraryName || 'unknown'}"`;
    } else if (toolName === "query-docs") {
      summary = `Queried documentation for library "${args.libraryId || 'unknown'}"`;
    }

    const redactedPayload = redactAndCapPayload(result);

    return {
      provider: "context7",
      toolName,
      evidenceType: "documentation",
      summary: redactSecrets(summary),
      timestamp: new Date().toISOString(),
      repository: null, // As required by the contract
      providerVersion: "1.0.0",
      args,
      payload: redactedPayload
    };
  }

  async reset() {
    console.log(`[Context7McpProvider] Resetting connection (instanceId: ${this.instanceId}).`);
    this.connectionState = "DISCONNECTED";
    this.connected = false;
    this._circuitBreaker.reset();
    if (this.transport) {
      try {
        await this.transport.close();
      } catch (e) {}
    }
    this.client = null;
    this.transport = null;
    this._isAvailable = undefined;
    this.callCount = 0;
  }
}

export default new Context7McpProvider();
