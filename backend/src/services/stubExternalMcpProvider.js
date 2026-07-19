import { EXTERNAL_MCP_CONFIG } from '../utils/config.js';

export class StubExternalMcpProvider {
  constructor() {
    this.name = "stub_external";
    this.category = "repository";
    this.isExternal = true;
    this.connected = false;
  }

  async isAvailable() {
    if (this._isAvailable !== undefined) {
      return this._isAvailable;
    }
    return EXTERNAL_MCP_CONFIG.MOCK_EXTERNAL_MCP;
  }

  async isRelevantForMode(mode) {
    return mode === "change_investigation" || mode === "repository_investigation" || mode === "log_investigation";
  }

  async lazyConnect() {
    if (!this.connected) {
      console.log("[StubExternalMcpProvider] Lazy connecting to stub external MCP server...");
      this.connected = true;
    }
  }

  async listTools(mode) {
    if (!this.connected) {
      return [];
    }
    return [
      {
        name: "searchPullRequests",
        description: "Search recent pull requests in the remote repository (stub/mock external evidence).",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query string for remote PRs."
            }
          },
          required: ["query"]
        }
      },
      {
        name: "getPullRequestDetails",
        description: "Get detailed information about a specific remote pull request by number (stub/mock external evidence).",
        inputSchema: {
          type: "object",
          properties: {
            prNumber: {
              type: "number",
              description: "PR number to inspect."
            }
          },
          required: ["prNumber"]
        }
      },
      {
        name: "list_commits",
        description: "List commits in the remote repository (stub/mock external evidence).",
        inputSchema: {
          type: "object",
          properties: {
            per_page: {
              type: "number",
              description: "Number of commits per page."
            }
          },
          required: []
        }
      },
      {
        name: "list_pull_requests",
        description: "List pull requests in the remote repository (stub/mock external evidence).",
        inputSchema: {
          type: "object",
          properties: {
            state: {
              type: "string",
              description: "PR state: open, closed, or all."
            }
          },
          required: []
        }
      },
      {
        name: "navigate_page",
        description: "Go to a URL (stub/mock external evidence).",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "Target URL"
            }
          },
          required: ["url"]
        }
      },
      {
        name: "list_console_messages",
        description: "List console messages (stub/mock external evidence).",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "list_network_requests",
        description: "List network requests (stub/mock external evidence).",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "take_screenshot",
        description: "Take a screenshot of the current page (stub/mock external evidence).",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "resolve-library-id",
        description: "Resolves a package/product name to a Context7-compatible library ID (stub/mock external evidence).",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The query to search docs with."
            },
            libraryName: {
              type: "string",
              description: "Official library name."
            }
          },
          required: ["query", "libraryName"]
        }
      },
      {
        name: "query-docs",
        description: "Query documentation for a package from Context7 (stub/mock external evidence).",
        inputSchema: {
          type: "object",
          properties: {
            libraryId: {
              type: "string",
              description: "Resolved library ID."
            },
            query: {
              type: "string",
              description: "Documentation query topic."
            }
          },
          required: ["libraryId", "query"]
        }
      }
    ];
  }

  async callTool({ name, arguments: args }) {
    if (!this.connected) {
      throw new Error("Stub external MCP not connected.");
    }
    if (name === "searchPullRequests") {
      const query = args?.query || "";
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              pullRequests: [
                {
                  prNumber: 101,
                  title: `Fix issue matching '${query}'`,
                  status: "merged",
                  author: "stub-user",
                  mergedAt: "2026-07-08T10:00:00Z"
                }
              ]
            }, null, 2)
          }
        ]
      };
    }
    if (name === "getPullRequestDetails") {
      const prNumber = args?.prNumber || 101;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              prNumber,
              title: "Refactor database config",
              state: "closed",
              diffSummary: "Modified server.js and db.js"
            }, null, 2)
          }
        ]
      };
    }
    if (name === "list_commits") {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify([
              { hash: "b7ee318", author: "stub-user", message: "refactor auth middleware" }
            ], null, 2)
          }
        ]
      };
    }
    if (name === "list_pull_requests") {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify([
              { prNumber: 101, title: "Refactor database config", state: "closed" }
            ], null, 2)
          }
        ]
      };
    }
    if (name === "navigate_page") {
      return {
        content: [
          {
            type: "text",
            text: `Successfully navigated to ${args?.url}`
          }
        ]
      };
    }
    if (name === "list_console_messages") {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              messages: [
                { type: "error", text: "Uncaught TypeError: Cannot read properties of undefined (reading 'split')", source: "console-api" }
              ]
            }, null, 2)
          }
        ]
      };
    }
    if (name === "list_network_requests") {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              requests: [
                { url: "http://localhost:5000/api/data", status: 500, statusText: "Internal Server Error" }
              ]
            }, null, 2)
          }
        ]
      };
    }
    if (name === "take_screenshot") {
      return {
        content: [
          {
            type: "text",
            text: "screenshot-image-base64-placeholder"
          }
        ]
      };
    }
    if (name === "resolve-library-id") {
      const libName = args?.libraryName || "express";
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              libraryId: `/${libName.toLowerCase()}/docs`,
              name: libName,
              description: `Stub documentation for ${libName}`,
              codeSnippets: 12,
              sourceReputation: "High",
              benchmarkScore: 95
            }, null, 2)
          }
        ]
      };
    }
    if (name === "query-docs") {
      const libId = args?.libraryId || "/express/docs";
      const q = args?.query || "";
      return {
        content: [
          {
            type: "text",
            text: `[Stub Docs] Official Context7 documentation for ${libId} on topic: "${q}":\n\n- To initialize the module, call require/import.\n- Setup server using app.listen(port).\n- Example:\n  import express from 'express';\n  const app = express();\n  app.listen(3000);`
          }
        ]
      };
    }
    throw new Error(`Tool ${name} not found on stub_external provider.`);
  }

  formatEvidence(toolName, args, result) {
    let evidenceType = "pull_request";
    let summary = `Stub external tool ${toolName} query`;
    let repository = "stub-owner/stub-repo";

    if (toolName === "searchPullRequests") {
      summary = `Stub PR search for: "${args.query || ''}"`;
    } else if (toolName === "getPullRequestDetails") {
      summary = `Stub PR details for PR #${args.prNumber || 'unknown'}`;
    } else if (toolName === "list_commits") {
      evidenceType = "commit";
      summary = "Stub listed recent commits";
    } else if (toolName === "list_pull_requests") {
      evidenceType = "pull_request";
      summary = "Stub listed recent pull requests";
    } else if (toolName === "navigate_page") {
      evidenceType = "browser_runtime";
      summary = `Stub navigated browser to: ${args.url ? args.url.split('?')[0] : 'history/reload'}`;
      repository = null;
    } else if (toolName === "list_console_messages") {
      evidenceType = "console_error";
      summary = "Stub fetched browser console logs";
      repository = null;
    } else if (toolName === "list_network_requests") {
      evidenceType = "network_failure";
      summary = "Stub fetched browser network requests";
      repository = null;
    } else if (toolName === "take_screenshot") {
      evidenceType = "browser_runtime";
      summary = "Stub captured browser screenshot";
      repository = null;
    } else if (toolName === "resolve-library-id") {
      evidenceType = "documentation";
      summary = `Stub resolved library ID for "${args.libraryName || 'unknown'}"`;
      repository = null;
    } else if (toolName === "query-docs") {
      evidenceType = "documentation";
      summary = `Stub queried documentation for library "${args.libraryId || 'unknown'}"`;
      repository = null;
    }

    return {
      provider: "stub_external",
      toolName,
      evidenceType,
      summary,
      timestamp: new Date().toISOString(),
      repository,
      providerVersion: "1.0.0",
      args,
      payload: result
    };
  }

  async reset() {
    console.log("[StubExternalMcpProvider] Resetting connection.");
    this.connected = false;
    this._isAvailable = undefined;
  }
}

export default new StubExternalMcpProvider();

