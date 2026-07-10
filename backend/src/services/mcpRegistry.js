import internalMcpProvider from './internalMcpProvider.js';
import stubExternalMcpProvider from './stubExternalMcpProvider.js';

export class McpCapabilityRegistry {
  constructor() {
    this.providers = [];
    this.toolToProvider = new Map();

    // Automatically register default providers
    this.registerProvider(internalMcpProvider);
    this.registerProvider(stubExternalMcpProvider);
  }

  registerProvider(provider) {
    if (!provider || !provider.name) {
      throw new Error("Invalid provider: name is required.");
    }
    this.providers.push(provider);
  }

  async getToolsForMode(mode) {
    this.toolToProvider.clear();
    const tools = [];

    for (const p of this.providers) {
      let available = false;
      try {
        available = await p.isAvailable();
      } catch (err) {
        console.warn(`[McpRegistry] Provider ${p.name} threw during isAvailable() check. Treating as unavailable (fail closed).`, err.message || err);
        available = false;
      }
      if (!available) continue;

      let relevant = false;
      try {
        relevant = await p.isRelevantForMode(mode);
      } catch (err) {
        console.warn(`[McpRegistry] Provider ${p.name} threw during isRelevantForMode(${mode}). Treating as not relevant.`, err.message || err);
        relevant = false;
      }
      if (!relevant) continue;

      try {
        await p.lazyConnect();
        const providerTools = await p.listTools(mode);
        if (Array.isArray(providerTools)) {
          for (const t of providerTools) {
            tools.push(t);
            this.toolToProvider.set(t.name, p);
          }
        }
      } catch (err) {
        console.warn(`[McpRegistry] Provider ${p.name} failed during lazyConnect/listTools for mode ${mode}. Skipping provider tools.`, err.message || err);
      }
    }

    return tools;
  }

  getProviderForTool(toolName) {
    return this.toolToProvider.get(toolName);
  }

  async callTool({ name, arguments: args }) {
    let provider = this.toolToProvider.get(name);
    if (!provider) {
      // Fallback check: if toolToProvider mapping was cleared or tool requested without mode listing
      for (const p of this.providers) {
        let available = false;
        try { available = await p.isAvailable(); } catch (e) {}
        if (available && typeof p.listTools === 'function') {
          try {
            const list = await p.listTools("*");
            if (list && list.some(t => t.name === name)) {
              provider = p;
              this.toolToProvider.set(name, p);
              break;
            }
          } catch (e) {}
        }
      }
    }

    if (!provider) {
      throw new Error(`Tool ${name} is not registered or available.`);
    }

    const toolResult = await provider.callTool({ name, arguments: args });
    return {
      toolResult,
      provider
    };
  }

  async resetAll() {
    console.log("[McpRegistry] Resetting all capability providers.");
    for (const p of this.providers) {
      if (typeof p.reset === 'function') {
        try {
          await p.reset();
        } catch (err) {
          console.warn(`[McpRegistry] Error resetting provider ${p.name}:`, err.message || err);
        }
      }
    }
    this.toolToProvider.clear();
  }
}

export default new McpCapabilityRegistry();
