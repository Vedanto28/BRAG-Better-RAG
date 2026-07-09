import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { retrieveContext } from "./rag.js";
import { LocalRepoProvider } from "../providers/localRepoProvider.js";
import { LocalGitProvider } from "../providers/localGitProvider.js";

let repoProviderInstance = null;
function getRepoProvider() {
  if (repoProviderInstance) return repoProviderInstance;
  const rootPath = process.env.REPO_ROOT_PATH;
  if (!rootPath) {
    throw new Error("REPO_ROOT_PATH environment variable is not set.");
  }
  repoProviderInstance = new LocalRepoProvider(rootPath);
  return repoProviderInstance;
}

let gitProviderInstance = null;
function getGitProvider() {
  if (gitProviderInstance) return gitProviderInstance;
  const rootPath = process.env.REPO_ROOT_PATH;
  if (!rootPath) {
    throw new Error("REPO_ROOT_PATH environment variable is not set.");
  }
  gitProviderInstance = new LocalGitProvider(rootPath);
  return gitProviderInstance;
}

const server = new Server(
  {
    name: "mechamaru-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const toolsList = [
  {
    name: "getCurrentDateTime",
    description: "Get the current server date, time, and timezone information.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "calculator",
    description: "Perform basic arithmetic operations (add, subtract, multiply, divide).",
    inputSchema: {
      type: "object",
      properties: {
        operator: {
          type: "string",
          enum: ["add", "subtract", "multiply", "divide"],
          description: "The arithmetic operator to apply."
        },
        operand1: {
          type: "number",
          description: "The first operand."
        },
        operand2: {
          type: "number",
          description: "The second operand."
        }
      },
      required: ["operator", "operand1", "operand2"]
    }
  },
  {
    name: "searchKnowledgeBase",
    description: "Search the local static knowledge base for information about RAG, NodeJS, ExpressJS, Embeddings, etc.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The keyword or topic to search for."
        }
      },
      required: ["query"]
    }
  },
  {
    name: "listRepositoryFiles",
    description: "List files and directories in the repository under a given sub-path (relative to the repository root). This tool is read-only.",
    inputSchema: {
      type: "object",
      properties: {
        subPath: {
          type: "string",
          description: "Optional relative sub-path within the repository to list files from. If omitted or empty, lists from the repository root."
        }
      }
    }
  },
  {
    name: "readFile",
    description: "Read the contents of a text file in the repository (relative to the repository root). Returns file contents as plain text. Caps the output at 50KB or 1000 lines, appending a warning if truncated. This tool is read-only.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The relative path of the file to read."
        }
      },
      required: ["path"]
    }
  },
  {
    name: "searchCode",
    description: "Search for a text query across files in the repository recursively. Caps results at 30 matches. This tool is read-only.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The text string to search for."
        },
        extensions: {
          type: "array",
          items: {
            type: "string"
          },
          description: "Optional list of file extensions to restrict the search to (e.g. ['js', 'json'])."
        }
      },
      required: ["query"]
    }
  },
  {
    name: "getRecentCommits",
    description: "Retrieve a list of recent commits from the repository (read-only, local history, secrets are redacted).",
    inputSchema: {
      type: "object",
      properties: {
        since: {
          type: "string",
          description: "Optional date or relative time (e.g. '1.day.ago', '2026-07-01') to filter commits."
        },
        limit: {
          type: "number",
          description: "Optional maximum number of commits to retrieve (default 10, max 30)."
        }
      }
    }
  },
  {
    name: "inspectCommit",
    description: "Inspect details of a specific commit by hash, including files changed and redacted unified diff (read-only, local history, secrets are redacted).",
    inputSchema: {
      type: "object",
      properties: {
        commitHash: {
          type: "string",
          description: "The full or short commit hash (hexadecimal string) to inspect."
        }
      },
      required: ["commitHash"]
    }
  }
];


server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: toolsList,
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "getCurrentDateTime": {
        const now = new Date();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                dateTime: now.toISOString(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                localTime: now.toString(),
              }, null, 2),
            },
          ],
        };
      }
      case "calculator": {
        const { operator, operand1, operand2 } = args ?? {};
        if (typeof operand1 !== "number" || typeof operand2 !== "number") {
          throw new Error("operand1 and operand2 must be numbers.");
        }
        let result;
        switch (operator) {
          case "add":
            result = operand1 + operand2;
            break;
          case "subtract":
            result = operand1 - operand2;
            break;
          case "multiply":
            result = operand1 * operand2;
            break;
          case "divide":
            if (operand2 === 0) {
              throw new Error("Division by zero is not allowed.");
            }
            result = operand1 / operand2;
            break;
          default:
            throw new Error(`Unsupported operator: ${operator}`);
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ result }),
            },
          ],
        };
      }
      case "searchKnowledgeBase": {
        const { query } = args ?? {};
        if (!query || typeof query !== "string") {
          throw new Error("query parameter is required and must be a string.");
        }
        const results = await retrieveContext(query);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ results }),
            },
          ],
        };
      }
      case "listRepositoryFiles": {
        const { subPath } = args ?? {};
        const provider = getRepoProvider();
        const files = await provider.listFiles(subPath);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ files }, null, 2),
            },
          ],
        };
      }
      case "readFile": {
        const { path: filePath } = args ?? {};
        if (!filePath || typeof filePath !== "string") {
          throw new Error("path parameter is required and must be a string.");
        }
        const provider = getRepoProvider();
        const content = await provider.readFile(filePath);
        return {
          content: [
            {
              type: "text",
              text: content,
            },
          ],
        };
      }
      case "searchCode": {
        const { query, extensions } = args ?? {};
        if (!query || typeof query !== "string") {
          throw new Error("query parameter is required and must be a string.");
        }
        const provider = getRepoProvider();
        const result = await provider.searchCode(query, { extensions });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
      case "getRecentCommits": {
        const { since, limit } = args ?? {};
        const provider = getGitProvider();
        const commits = await provider.getRecentCommits({ since, limit });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ commits }, null, 2),
            },
          ],
        };
      }
      case "inspectCommit": {
        const { commitHash } = args ?? {};
        if (!commitHash || typeof commitHash !== "string") {
          throw new Error("commitHash parameter is required and must be a string.");
        }
        const provider = getGitProvider();
        const details = await provider.inspectCommit(commitHash);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(details, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Tool not found: ${name}`);
    }
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }
});

export default server;
