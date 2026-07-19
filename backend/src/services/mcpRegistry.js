import internalMcpProvider from './internalMcpProvider.js';
import stubExternalMcpProvider from './stubExternalMcpProvider.js';
import gitHubMcpProvider from './gitHubMcpProvider.js';
import chromeDevToolsMcpProvider from './chromeDevToolsMcpProvider.js';
import context7McpProvider from './context7McpProvider.js';

export class McpCapabilityRegistry {
  constructor() {
    this.providers = [];
    this.toolToProvider = new Map();

    // Automatically register default providers
    this.registerProvider(internalMcpProvider);
    this.registerProvider(stubExternalMcpProvider);
    this.registerProvider(gitHubMcpProvider);
    this.registerProvider(chromeDevToolsMcpProvider);
    this.registerProvider(context7McpProvider);
  }

  registerProvider(provider) {
    if (!provider || !provider.name) {
      throw new Error("Invalid provider: name is required.");
    }
    this.providers.push(provider);
  }

  async getToolsForMode(mode, query = "") {
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
        relevant = await p.isRelevantForMode(mode, query);
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

    // Mutual exclusion check: only one active provider per category is allowed (excluding 'internal' or 'unknown')
    const activeProviders = Array.from(new Set(this.toolToProvider.values()));
    const categories = {};
    for (const p of activeProviders) {
      const cat = p.category || "unknown";
      if (cat !== "internal" && cat !== "unknown") {
        if (categories[cat]) {
          throw new Error(`Registry configuration error: Both ${categories[cat].name} and ${p.name} providers cannot be active simultaneously (category: "${cat}").`);
        }
        categories[cat] = p;
      }
    }

    return tools;
  }

  getProviderForTool(toolName) {
    return this.toolToProvider.get(toolName);
  }

  async callTool({ name, arguments: args, signal }) {
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

    const toolResult = await provider.callTool({ name, arguments: args, signal });
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
