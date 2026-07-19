import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { EXTERNAL_MCP_CONFIG } from '../utils/config.js';
import { redactSecrets } from '../utils/logParser.js';
import fs from 'node:fs';
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
    if (redacted.length > 5000) {
      redacted = redacted.slice(0, 5000) + "\n\n[WARNING: Payload field truncated due to size limits.]";
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

// Security Check: verifies if target URL is local/private
export function isSafeBrowserUrl(urlStr) {
  if (!urlStr) return false;
  try {
    const url = new URL(urlStr);
    const host = url.hostname.toLowerCase();

    // Loopback/localhost checks
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') {
      return true;
    }

    // RFC1918 private IP ranges
    const ipPattern = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/;
    const ipMatch = host.match(ipPattern);
    if (ipMatch) {
      const octet1 = parseInt(ipMatch[1], 10);
      const octet2 = parseInt(ipMatch[2], 10);
      if (octet1 === 10) return true;
      if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) return true;
      if (octet1 === 192 && octet2 === 168) return true;
      if (octet1 === 169 && octet2 === 254) return true;
    }

    return false;
  } catch (e) {
    return false;
  }
}

export class ChromeDevToolsMcpProvider {
  constructor() {
    this.name = "chrome-devtools";
    this.category = "runtime";
    this.isExternal = true;
    this.connected = false;
    this.client = null;
    this.transport = null;
    this._isAvailable = undefined;
    this.connectionId = 0;
    this.callCount = 0;
    this.instanceId = "chrome-" + Math.random().toString(36).substring(2, 10);
    this.connectionState = "DISCONNECTED";
    this._circuitBreaker = new ConnectionCircuitBreaker(
      "chrome-devtools",
      EXTERNAL_MCP_CONFIG.CIRCUIT_BREAKER_MAX_ATTEMPTS,
      EXTERNAL_MCP_CONFIG.CIRCUIT_BREAKER_WINDOW_MS
    );

    // Read-only / Diagnostic tools allowed
    this.allowedTools = [
      "list_pages",
      "new_page",
      "close_page",
      "navigate_page",
      "list_console_messages",
      "list_network_requests",
      "take_screenshot"
    ];
  }

  async isAvailable() {
    if (this._isAvailable !== undefined) return this._isAvailable;

    if (!EXTERNAL_MCP_CONFIG.CHROME_MCP_ENABLED) {
      this._isAvailable = false;
      return false;
    }

    if (EXTERNAL_MCP_CONFIG.MOCK_EXTERNAL_MCP) {
      this._isAvailable = false;
      return false;
    }

    if (EXTERNAL_MCP_CONFIG.CHROME_REMOTE_DEBUGGING_URL) {
      // Remote connection mode
      try {
        await this.lazyConnect();
        this._isAvailable = true;
      } catch (err) {
        console.warn(`[ChromeDevToolsMcpProvider] Live connection to remote debugging URL (${EXTERNAL_MCP_CONFIG.CHROME_REMOTE_DEBUGGING_URL}) failed:`, err.message || err);
        this._isAvailable = false;
        await this.reset();
      }
    } else {
      // Local execution mode
      const execPath = EXTERNAL_MCP_CONFIG.CHROME_EXECUTABLE_PATH;
      if (!execPath) {
        console.warn(`[ChromeDevToolsMcpProvider] Chrome executable path is not configured.`);
        this._isAvailable = false;
        return false;
      }
      
      if (!fs.existsSync(execPath)) {
        console.warn(`[ChromeDevToolsMcpProvider] Chrome binary not found at path: "${execPath}". Please install Google Chrome or configure CHROME_EXECUTABLE_PATH.`);
        this._isAvailable = false;
        return false;
      }

      try {
        await this.lazyConnect();
        this._isAvailable = true;
      } catch (err) {
        console.warn(`[ChromeDevToolsMcpProvider] Failed to launch Chrome or establish MCP connection:`, err.message || err);
        this._isAvailable = false;
        await this.reset();
      }
    }

    return this._isAvailable;
  }

  async isRelevantForMode(mode) {
    return mode === "repository_investigation" || mode === "log_investigation" || mode === "change_investigation";
  }

  async lazyConnect() {
    if (this._circuitBreaker.isTripped()) {
      this.connectionState = "CIRCUIT_OPEN";
      throw new Error(`Connection blocked by circuit breaker for provider ${this.name}`);
    }

    if (this.connected) {
      this.connectionState = "REUSED";
      console.log(`[MCP] lazyConnect requested, returning existing active client (chrome). State: ${this.connectionState} (instanceId: ${this.instanceId})`, "clientRef:", this.client ? "exists" : "null");
      return;
    }

    if (!this._circuitBreaker.recordAttempt()) {
      this.connectionState = "CIRCUIT_OPEN";
      throw new Error(`Connection blocked: circuit breaker tripped for provider ${this.name}`);
    }

    this.connectionState = "CONNECTING";
    this.connectionId++;
    console.log(`[ChromeDevToolsMcpProvider] Lazy connecting to Chrome DevTools MCP server (connectionId: ${this.connectionId}, instanceId: ${this.instanceId})...`);
    console.log("[MCP] connect() called: chrome", new Date().toISOString(), "InstanceId:", this.instanceId, "connectionId:", this.connectionId);

    try {
      const args = ["-y", "chrome-devtools-mcp@latest"];
      if (EXTERNAL_MCP_CONFIG.CHROME_REMOTE_DEBUGGING_URL) {
        args.push("--browserUrl", EXTERNAL_MCP_CONFIG.CHROME_REMOTE_DEBUGGING_URL);
      } else {
        args.push("--headless");
        if (EXTERNAL_MCP_CONFIG.CHROME_EXECUTABLE_PATH) {
          args.push("--executablePath", EXTERNAL_MCP_CONFIG.CHROME_EXECUTABLE_PATH);
        }
      }

      this.transport = new StdioClientTransport({
        command: "npx",
        args,
        env: {
          ...process.env
        }
      });

      this.client = new Client(
        { name: "brag-chrome-client", version: "1.0.0" },
        { capabilities: {} }
      );

      const startConnect = Date.now();
      await withTimeout(
        this.client.connect(this.transport),
        20000,
        "Chrome DevTools MCP server connection handshake timed out."
      );
      const duration = Date.now() - startConnect;

      this.connected = true;
      this.connectionState = "CONNECTED";
      console.log(`[ChromeDevToolsMcpProvider] Connected to Chrome DevTools MCP server successfully (connectionId: ${this.connectionId}, instanceId: ${this.instanceId}) in ${duration}ms.`);
    } catch (err) {
      this.connected = false;
      if (this._circuitBreaker.isTripped()) {
        this.connectionState = "CIRCUIT_OPEN";
      } else {
        this.connectionState = "FAILED";
      }
      console.error(`[ChromeDevToolsMcpProvider] Connection failed (instanceId: ${this.instanceId}):`, err.message || err);
      throw err;
    }
  }

  async listTools(mode) {
    if (!this.connected || !this.client) {
      return [];
    }

    const response = await this.client.listTools();
    const allTools = response.tools || [];

    // Filter to only include allowed read-only/observational tools
    const filteredTools = allTools.filter(t => this.allowedTools.includes(t.name));

    return filteredTools;
  }

  async callTool({ name, arguments: args, signal }) {
    if (!this.allowedTools.includes(name)) {
      throw new Error(`Tool ${name} is not allowed on Chrome DevTools provider.`);
    }

    // Safety boundary check
    if (!EXTERNAL_MCP_CONFIG.CHROME_MCP_ALLOW_EXTERNAL_URLS) {
      const url = args?.url;
      if (url && !isSafeBrowserUrl(url)) {
        console.warn(`[ChromeDevToolsMcpProvider] Blocked navigation to disallowed URL: ${url.split('?')[0]}`);
        throw new Error(`Navigation to external/disallowed URL "${url.split('?')[0]}" is blocked for security.`);
      }
    }

    let attempts = 0;
    while (attempts < 2) {
      attempts++;
      try {
        if (!this.connected || !this.client) {
          await this.lazyConnect();
        } else {
          console.log(`[ChromeDevToolsMcpProvider] Reusing existing connection (connectionId: ${this.connectionId})`);
        }

        const startCall = Date.now();
        const callPromise = this.client.callTool({ name, arguments: args });
        const result = await withTimeout(
          withSignal(callPromise, signal),
          15000,
          `Chrome DevTools MCP tool call ${name} timed out.`
        );
        const duration = Date.now() - startCall;
        this.callCount++;
        console.log(`[ChromeDevToolsMcpProvider] Tool call ${name} completed on connectionId ${this.connectionId}. Duration: ${duration}ms. Call count on this connection: ${this.callCount}`);

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
        const isClosedError = err.message && (
          err.message.includes("closed") ||
          err.message.includes("Connection") ||
          err.message.includes("EPIPE") ||
          err.message.includes("ECONNRESET") ||
          err.message.includes("not connected") ||
          err.message.includes("handshake")
        );
        if (isClosedError && attempts < 2) {
          console.warn(`[ChromeDevToolsMcpProvider] Connection drop detected during ${name}. Resetting and retrying once...`);
          await this.reset();
          continue;
        }
        throw err;
      }
    }
  }

  formatEvidence(toolName, args, result) {
    let evidenceType = "browser_runtime";
    let summary = `Chrome DevTools tool ${toolName} query`;

    if (toolName === "list_console_messages") {
      evidenceType = "console_error";
      summary = "Fetched browser console logs";
    } else if (toolName === "list_network_requests") {
      evidenceType = "network_failure";
      summary = "Fetched browser network requests";
    } else if (toolName === "navigate_page") {
      evidenceType = "browser_runtime";
      summary = `Navigated browser to: ${args.url ? args.url.split('?')[0] : 'history/reload'}`;
    } else if (toolName === "take_screenshot") {
      evidenceType = "browser_runtime";
      summary = "Captured browser screenshot";
    }

    const redactedPayload = redactAndCapPayload(result);

    return {
      provider: "chrome-devtools",
      toolName,
      evidenceType,
      summary,
      timestamp: new Date().toISOString(),
      repository: null,
      providerVersion: "1.0.0",
      args,
      payload: redactedPayload
    };
  }

  async reset() {
    console.log(`[ChromeDevToolsMcpProvider] Resetting connection (instanceId: ${this.instanceId}).`);
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
  }
}

export default new ChromeDevToolsMcpProvider();
