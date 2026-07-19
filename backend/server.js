import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chatRouter from './src/routes/chatRouter.js';
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import mcpServer from "./src/services/mcpServer.js";

const currentFilePath = fileURLToPath(import.meta.url);
const backendDir = path.dirname(currentFilePath);
const rootEnvPath = path.resolve(backendDir, '..', '.env');
const backendEnvPath = path.resolve(backendDir, '.env');

dotenv.config({ path: backendEnvPath });
dotenv.config({ path: rootEnvPath });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Store active MCP transports by session ID
const mcpTransports = {};

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Backend is running',
  });
});

// MCP Server SSE Endpoint
app.get('/api/sse', async (req, res) => {
  const currentSessionId = req.query.sessionId || 'unknown';
  console.log(`[Express] Establishing SSE connection for MCP... currentSessionId query: ${currentSessionId}`);
  const transport = new SSEServerTransport('/api/messages', res);
  console.log(`[Express] Created SSEServerTransport. SessionId: ${transport.sessionId}. Active server transport presence: ${mcpServer.transport ? "present" : "absent"}`);
  mcpTransports[transport.sessionId] = transport;

  res.on('close', async () => {
    console.log(`[Express] SSE connection closed for session: ${transport.sessionId}. Was it active server transport? ${mcpServer.transport === transport}`);
    delete mcpTransports[transport.sessionId];
    try {
      if (mcpServer.transport === transport) {
        await mcpServer.close();
      }
    } catch (e) {}
    transport.close().catch(err => console.warn('[Express] Error closing transport:', err));
  });

  try {
    if (mcpServer.transport) {
      console.log(`[Express] Closing active server transport (sessionId: ${mcpServer.transport.sessionId}) to connect new transport (sessionId: ${transport.sessionId})`);
      await mcpServer.close();
    }
  } catch (e) {}
  await mcpServer.connect(transport);
  console.log(`[Express] Connected new transport (sessionId: ${transport.sessionId}) to mcpServer.`);
});

// MCP Server POST Messages Endpoint
app.post('/api/messages', async (req, res) => {
  const { sessionId } = req.query;
  const transport = mcpTransports[sessionId];

  if (transport) {
    await transport.handlePostMessage(req, res, req.body);
  } else {
    res.status(400).json({ error: `No active SSE transport found for session: ${sessionId}` });
  }
});

app.use('/api', chatRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
