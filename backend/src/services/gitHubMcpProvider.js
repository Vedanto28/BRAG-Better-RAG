import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { EXTERNAL_MCP_CONFIG } from '../utils/config.js';
import { redactSecrets } from '../utils/logParser.js';
import { ConnectionCircuitBreaker } from './connectionCircuitBreaker.js';

const execFilePromise = promisify(execFile);

// Helper to parse git remote URLs
export function parseGitRemoteUrl(url) {
  if (!url) return null;
  const cleanUrl = url.trim().replace(/\.git$/, '');
  const match = cleanUrl.match(/(?:https?:\/\/|ssh:\/\/)?(?:[^@:\/]+@)?(?:github\.com[:\/])([^\/]+)\/([^\/]+)/i);
  if (match && match[1] && match[2]) {
    return {
      owner: match[1],
      repo: match[2]
    };
  }
  return null;
}

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

export class GitHubMcpProvider {
  constructor() {
    this.name = "github";
    this.category = "repository";
    this.isExternal = true;
    this.connected = false;
    this.client = null;
    this.transport = null;
    this._repoInfo = null;
    this._isAvailable = undefined;
    this.instanceId = "github-" + Math.random().toString(36).substring(2, 10);
    this.connectionState = "DISCONNECTED";
    this._circuitBreaker = new ConnectionCircuitBreaker(
      "github",
      EXTERNAL_MCP_CONFIG.CIRCUIT_BREAKER_MAX_ATTEMPTS,
      EXTERNAL_MCP_CONFIG.CIRCUIT_BREAKER_WINDOW_MS
    );

    // Allowed read-only tools
    this.allowedTools = [
      "list_pull_requests",
      "get_pull_request",
      "list_issues",
      "get_issue",
      "search_issues",
      "list_commits",
      "get_pull_request_status",
      "get_file_contents"
    ];
  }

  // Resolves owner/repo from git origin url
  async _resolveRepoInfo() {
    if (this._repoInfo) return this._repoInfo;

    const rootPath = process.env.REPO_ROOT_PATH || '.';
    try {
      const { stdout } = await execFilePromise('git', ['remote', 'get-url', 'origin'], { cwd: rootPath });
      const parsed = parseGitRemoteUrl(stdout);
      if (parsed) {
        this._repoInfo = parsed;
        return parsed;
      }
    } catch (e) {
      try {
        const { stdout } = await execFilePromise('git', ['config', '--get', 'remote.origin.url'], { cwd: rootPath });
        const parsed = parseGitRemoteUrl(stdout);
        if (parsed) {
          this._repoInfo = parsed;
          return parsed;
        }
      } catch (err) {}
    }

    if (process.env.GITHUB_MCP_OWNER && process.env.GITHUB_MCP_REPO) {
      this._repoInfo = {
        owner: process.env.GITHUB_MCP_OWNER.trim(),
        repo: process.env.GITHUB_MCP_REPO.trim()
      };
      return this._repoInfo;
    }

    throw new Error("Failed to resolve git remote origin owner/repo.");
  }

  async isAvailable() {
    if (this._isAvailable !== undefined) return this._isAvailable;

    if (!EXTERNAL_MCP_CONFIG.GITHUB_MCP_ENABLED) {
      this._isAvailable = false;
      return false;
    }
    if (!EXTERNAL_MCP_CONFIG.GITHUB_MCP_TOKEN) {
      this._isAvailable = false;
      return false;
    }
    if (EXTERNAL_MCP_CONFIG.MOCK_EXTERNAL_MCP) {
      this._isAvailable = false;
      return false;
    }

    try {
      const repoInfo = await this._resolveRepoInfo();
      if (!repoInfo || !repoInfo.owner || !repoInfo.repo) {
        this._isAvailable = false;
        return false;
      }

      // Safe lightweight verification: connect and do a test call
      await this.lazyConnect();

      try {
        await withTimeout(
          this.client.callTool({
            name: "list_commits",
            arguments: { owner: repoInfo.owner, repo: repoInfo.repo, per_page: 1, limit: 1 }
          }),
          5000,
          "Availability check handshake timed out."
        );
        this._isAvailable = true;
      } catch (err) {
        console.warn(`[GitHubMcpProvider] Live verification call failed (e.g. invalid token, wrong repo, or rate-limited):`, err.message || err);
        this._isAvailable = false;
        await this.reset();
      }

      return this._isAvailable;
    } catch (e) {
      console.warn("[GitHubMcpProvider] Availability check failed:", e.message || e);
      this._isAvailable = false;
      return false;
    }
  }

  async isRelevantForMode(mode) {
    return mode === "change_investigation" || mode === "repository_investigation" || mode === "log_investigation";
  }

  async lazyConnect() {
    if (this._circuitBreaker.isTripped()) {
      this.connectionState = "CIRCUIT_OPEN";
      throw new Error(`Connection blocked by circuit breaker for provider ${this.name}`);
    }

    if (this.connected) {
      this.connectionState = "REUSED";
      console.log(`[MCP] lazyConnect requested, returning existing active client (github). State: ${this.connectionState} (instanceId: ${this.instanceId})`, "clientRef:", this.client ? "exists" : "null");
      return;
    }

    if (!this._circuitBreaker.recordAttempt()) {
      this.connectionState = "CIRCUIT_OPEN";
      throw new Error(`Connection blocked: circuit breaker tripped for provider ${this.name}`);
    }

    this.connectionState = "CONNECTING";
    console.log(`[GitHubMcpProvider] Lazy connecting to GitHub MCP server (instanceId: ${this.instanceId})...`);
    console.log("[MCP] connect() called: github", new Date().toISOString(), "InstanceId:", this.instanceId);

    try {
      const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      this.transport = new StdioClientTransport({
        command,
        args: ["-y", "@modelcontextprotocol/server-github"],
        env: {
          ...process.env,
          GITHUB_PERSONAL_ACCESS_TOKEN: EXTERNAL_MCP_CONFIG.GITHUB_MCP_TOKEN
        }
      });

      this.client = new Client(
        { name: "brag-github-client", version: "1.0.0" },
        { capabilities: {} }
      );

      await withTimeout(
        this.client.connect(this.transport),
        15000,
        "GitHub MCP server connection handshake timed out."
      );

      this.connected = true;
      this.connectionState = "CONNECTED";
      console.log(`[GitHubMcpProvider] Connected to GitHub MCP server successfully (instanceId: ${this.instanceId}).`);
    } catch (err) {
      this.connected = false;
      if (this._circuitBreaker.isTripped()) {
        this.connectionState = "CIRCUIT_OPEN";
      } else {
        this.connectionState = "FAILED";
      }
      console.error(`[GitHubMcpProvider] Connection failed (instanceId: ${this.instanceId}):`, err.message || err);
      throw err;
    }
  }

  async listTools(mode) {
    if (!this.connected || !this.client) {
      return [];
    }

    const response = await this.client.listTools();
    const allTools = response.tools || [];

    // Filter to only include allowed read-only tools
    const filteredTools = allTools.filter(t => this.allowedTools.includes(t.name));

    // Modify schemas to remove owner and repo from required arguments
    return filteredTools.map(tool => {
      const clonedSchema = JSON.parse(JSON.stringify(tool.inputSchema || { type: "object", properties: {} }));
      if (clonedSchema.properties) {
        delete clonedSchema.properties.owner;
        delete clonedSchema.properties.repo;
      }
      if (Array.isArray(clonedSchema.required)) {
        clonedSchema.required = clonedSchema.required.filter(p => p !== "owner" && p !== "repo");
      }
      return {
        ...tool,
        inputSchema: clonedSchema
      };
    });
  }

  async callTool({ name, arguments: args, signal }) {
    const repoInfo = await this._resolveRepoInfo();
    const finalArgs = {
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      ...args
    };

    let attempts = 0;
    while (attempts < 2) {
      attempts++;
      try {
        if (!this.connected || !this.client) {
          await this.lazyConnect();
        }

        const callPromise = this.client.callTool({ name, arguments: finalArgs });
        const result = await withTimeout(
          withSignal(callPromise, signal),
          10000,
          `GitHub MCP tool call ${name} timed out.`
        );

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
          console.warn(`[GitHubMcpProvider] Connection drop detected during ${name}. Resetting and retrying once...`);
          await this.reset();
          continue;
        }
        throw err;
      }
    }
  }

  formatEvidence(toolName, args, result) {
    let evidenceType = "pull_request";
    if (toolName.includes("issue")) evidenceType = "issue";
    if (toolName.includes("commit")) evidenceType = "commit";
    if (toolName.includes("status")) evidenceType = "workflow_run";

    let summary = `GitHub tool ${toolName} query`;
    if (toolName === "get_file_contents") {
      summary = `Read file "${args.path || 'unknown'}" from ${args.owner || repoInfo.owner}/${args.repo || repoInfo.repo}`;
      evidenceType = "file_content";
    } else if (toolName === "list_pull_requests") {
      summary = "Listed recent PRs";
    } else if (toolName === "get_pull_request") {
      summary = `Fetched details for PR #${args.prNumber || args.number || 'unknown'}`;
    } else if (toolName === "list_issues") {
      summary = "Listed recent issues";
    } else if (toolName === "get_issue") {
      summary = `Fetched details for issue #${args.issueNumber || args.number || 'unknown'}`;
    } else if (toolName === "search_issues") {
      summary = `Searched issues/PRs with query: "${args.query}"`;
    } else if (toolName === "list_commits") {
      summary = "Listed recent remote commits";
    } else if (toolName === "get_pull_request_status") {
      summary = `Fetched status for PR #${args.prNumber || args.number || 'unknown'}`;
    }

    const redactedPayload = redactAndCapPayload(result);
    const repoInfo = this._repoInfo || { owner: "unknown", repo: "unknown" };

    return {
      provider: "github",
      toolName,
      evidenceType,
      summary: redactSecrets(summary),
      timestamp: new Date().toISOString(),
      repository: `${repoInfo.owner}/${repoInfo.repo}`,
      providerVersion: "1.0.0",
      args,
      payload: redactedPayload
    };
  }

  async reset() {
    console.log(`[GitHubMcpProvider] Resetting connection (instanceId: ${this.instanceId}).`);
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
    this._repoInfo = undefined;
  }
}

export default new GitHubMcpProvider();
