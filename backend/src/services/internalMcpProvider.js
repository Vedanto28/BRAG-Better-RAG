import { getMcpClient, resetMcpClient, internalCircuitBreaker } from './mcpClient.js';

export class InternalMcpProvider {
  constructor() {
    this.name = "internal";
    this.category = "internal";
    this.isExternal = false;
    this.instanceId = "internal-" + Math.random().toString(36).substring(2, 10);
    this.connectionState = "DISCONNECTED";
    this.connected = false;
    this._circuitBreaker = internalCircuitBreaker;
  }

  async isAvailable() {
    return true;
  }

  async isRelevantForMode(mode) {
    return mode !== "normal_chat" && mode !== "knowledge_debugging";
  }

  async lazyConnect() {
    if (this._circuitBreaker.isTripped()) {
      this.connectionState = "CIRCUIT_OPEN";
      throw new Error(`Connection blocked by circuit breaker for provider ${this.name}`);
    }

    if (this.connected) {
      this.connectionState = "REUSED";
      console.log(`[MCP] lazyConnect requested, returning existing active client (${this.name}). State: ${this.connectionState} (instanceId: ${this.instanceId})`);
      return;
    }

    this.connectionState = "CONNECTING";
    console.log(`[MCP] lazyConnect called: ${this.name} (${this.instanceId}). Transitioning to CONNECTING`);

    try {
      await getMcpClient();
      this.connected = true;
      this.connectionState = "CONNECTED";
      console.log(`[MCP] Connection state updated for ${this.name}: ${this.connectionState} (instanceId: ${this.instanceId})`);
    } catch (err) {
      this.connected = false;
      if (this._circuitBreaker.isTripped()) {
        this.connectionState = "CIRCUIT_OPEN";
      } else {
        this.connectionState = "FAILED";
      }
      console.error(`[MCP] Connection state updated for ${this.name}: ${this.connectionState} (instanceId: ${this.instanceId}). Error:`, err.message || err);
      throw err;
    }
  }

  async listTools(mode) {
    const client = await getMcpClient();
    const toolsResponse = await client.listTools();
    const allTools = toolsResponse.tools || [];
    if (mode === "utility_tool") {
      return allTools.filter(t => !["listRepositoryFiles", "searchCode", "readFile", "getRecentCommits", "inspectCommit"].includes(t.name));
    }
    return allTools;
  }

  async callTool({ name, arguments: args }) {
    if (process.env.TEST_INTERNAL_MCP_TOOL_ERROR === 'true') {
      throw new Error('Mocked mid-investigation tool failure');
    }
    const client = await getMcpClient();
    return client.callTool({
      name,
      arguments: args
    });
  }

  async reset() {
    console.log(`[MCP] reset called for ${this.name} (${this.instanceId}). Transitioning to DISCONNECTED`);
    this.connectionState = "DISCONNECTED";
    this.connected = false;
    this._circuitBreaker.reset();
    await resetMcpClient();
  }
}

export default new InternalMcpProvider();
