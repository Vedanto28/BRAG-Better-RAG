import { getMcpClient, resetMcpClient } from './mcpClient.js';

export class InternalMcpProvider {
  constructor() {
    this.name = "internal";
    this.category = "internal";
    this.isExternal = false;
  }

  async isAvailable() {
    return true;
  }

  async isRelevantForMode(mode) {
    return mode !== "normal_chat" && mode !== "knowledge_debugging";
  }

  async lazyConnect() {
    await getMcpClient();
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
    const client = await getMcpClient();
    return client.callTool({
      name,
      arguments: args
    });
  }

  async reset() {
    resetMcpClient();
  }
}

export default new InternalMcpProvider();
