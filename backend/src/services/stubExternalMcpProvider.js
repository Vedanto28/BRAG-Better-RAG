export class StubExternalMcpProvider {
  constructor() {
    this.name = "stub_external";
    this.isExternal = true;
    this.connected = false;
  }

  async isAvailable() {
    return process.env.MOCK_EXTERNAL_MCP === 'true';
  }

  async isRelevantForMode(mode) {
    return mode === "change_investigation" || mode === "repository_investigation";
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
    throw new Error(`Tool ${name} not found on stub_external provider.`);
  }

  formatEvidence(toolName, args, result) {
    let evidenceType = "pull_request";
    let summary = `Stub external tool ${toolName} query`;
    if (toolName === "searchPullRequests") {
      summary = `Stub PR search for: "${args.query || ''}"`;
    } else if (toolName === "getPullRequestDetails") {
      summary = `Stub PR details for PR #${args.prNumber || 'unknown'}`;
    }
    return {
      provider: "stub_external",
      toolName,
      evidenceType,
      summary,
      timestamp: new Date().toISOString(),
      repository: "stub-owner/stub-repo",
      providerVersion: "1.0.0",
      args,
      payload: result
    };
  }

  async reset() {
    console.log("[StubExternalMcpProvider] Resetting connection.");
    this.connected = false;
  }
}

export default new StubExternalMcpProvider();
