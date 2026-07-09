import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { retrieveContext } from "./rag.js";

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
