import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toNodeHandler } from 'better-auth/node';
import auth from './src/auth/auth.js';
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

// Strict CORS for credentialed Better Auth sessions
const allowedOrigins = [
  'https://brag-better-rag.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5000',
  'http://localhost:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-byok-gemini-key',
    'x-byok-openai-key',
    'x-byok-groq-key',
    'x-byok-openrouter-key',
    'x-byok-cerebras-key',
    'x-byok-deepseek-key',
    'x-byok-keys',
    'Cookie'
  ]
}));

// Better Auth API routes must be mounted before body-parser (Express 5 wildcard syntax)
app.all('/api/auth/*splat', toNodeHandler(auth));
app.all('/api/auth', toNodeHandler(auth));

app.use(express.json());

// Store active MCP transports by session ID
const mcpTransports = {};

// Public health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Backend is running',
    auth: 'better-auth'
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

// Clean error handler for CORS violations and unexpected errors
app.use((err, req, res, next) => {
  if (err && err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      error: {
        message: 'Origin not allowed by CORS policy.',
        code: 'CORS_ERROR'
      }
    });
  }
  console.error('[Express] Unhandled error:', err.message || err);
  res.status(err.status || 500).json({
    success: false,
    error: {
      message: err.message || 'Internal Server Error',
      code: 'INTERNAL_SERVER_ERROR'
    }
  });
});

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[Server] Error: Port ${PORT} is already in use by another process.`);
  } else {
    console.error('[Server] Server error:', err);
  }
});

export default app;
