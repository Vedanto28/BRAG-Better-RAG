export const AI_CONFIG = {
  MAX_USER_MESSAGE_CHARS: parseInt(process.env.MAX_USER_MESSAGE_CHARS || '2000', 10),
  MAX_CONTEXT_CHARS: parseInt(process.env.MAX_CONTEXT_CHARS || '4000', 10),
  MAX_HISTORY_MESSAGES: parseInt(process.env.MAX_HISTORY_MESSAGES || '6', 10),
  MAX_OUTPUT_TOKENS: parseInt(process.env.MAX_OUTPUT_TOKENS || '1000', 10),
  MAX_RAG_RESULTS: parseInt(process.env.MAX_RAG_RESULTS || '3', 10),
  MAX_AGENT_STEPS: parseInt(process.env.MAX_AGENT_STEPS || '6', 10),
  MAX_TOOL_CALLS_PER_REQUEST: parseInt(process.env.MAX_TOOL_CALLS_PER_REQUEST || '6', 10),
  REQUEST_TIMEOUT_MS: parseInt(process.env.REQUEST_TIMEOUT_MS || '20000', 10),
};

export const EXTERNAL_MCP_CONFIG = {
  MOCK_EXTERNAL_MCP: process.env.MOCK_EXTERNAL_MCP === 'true',
  GITHUB_MCP_ENABLED: process.env.GITHUB_MCP_ENABLED === 'true' || !!(process.env['GITHUB-MCP'] || process.env.GITHUB_MCP_TOKEN),
  GITHUB_MCP_TOKEN: process.env.GITHUB_MCP_TOKEN || process.env['GITHUB-MCP'] || '',
  CHROME_MCP_ENABLED: process.env.CHROME_MCP_ENABLED === 'true' || process.env.CHROME_DEVTOOLS_MCP_ENABLED === 'true',
  CHROME_EXECUTABLE_PATH: process.env.CHROME_EXECUTABLE_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  CHROME_REMOTE_DEBUGGING_URL: process.env.CHROME_REMOTE_DEBUGGING_URL || '',
  CHROME_MCP_ALLOW_EXTERNAL_URLS: process.env.CHROME_MCP_ALLOW_EXTERNAL_URLS === 'true',
  CONTEXT7_MCP_ENABLED: process.env.CONTEXT7_MCP_ENABLED === 'true' || !!(process.env['CONTEXT7-MCP'] || process.env.CONTEXT7_MCP_TOKEN),
  CONTEXT7_MCP_TOKEN: process.env.CONTEXT7_MCP_TOKEN || process.env['CONTEXT7-MCP'] || '',
};

