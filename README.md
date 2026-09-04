# BRAG (Better RAG Agent) Chatbot

BRAG is a lightweight agentic chatbot platform named **Mechamaru**. This project implements a single-backend agentic loop utilizing the Model Context Protocol (MCP) for tools execution, a static keyword-based RAG retrieval system, and multi-provider LLM support (Gemini & OpenAI) with automatic fallback and safety constraints.

## Architecture & Request Flow

```
Existing React Frontend
         ↓
POST /api/chat (Request Validation & Cost Controls)
         ↓
Agent Orchestrator
   ├── 1. Static RAG Retrieval (from local knowledgeBase.json)
   ├── 2. LLM Provider Layer (Gemini default, OpenAI fallback with timeout protection)
   └── 3. MCP Client SSE Transport
             ↓
        MCP Server (mounted within Express)
             ↓
        Lightweight Tools (getCurrentDateTime, calculator, searchKnowledgeBase)
             ↓
Final Response (Natural Language Answer + Metadata)
         ↓
React Frontend
```

### RAG vs MCP Responsibilities
*   **Static RAG**: Pre-retrieves relevant context from `knowledgeBase.json` before LLM generation based on keywords. Its job is to provide relevant background knowledge.
*   **MCP Tools**: Execute actions or calculate structured/external data on demand (e.g. calculator, date/time fetch, dynamic search query back into the knowledge base) during the agent loop.

---

## Getting Started

### 1. Environment Configuration
Create a `.env` file in the `backend/` directory (or workspace root) based on `backend/.env.example`:

```env
PORT=5000
LLM_PROVIDER=gemini # Supports: gemini, openai
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
```

### 2. Running the Backend
From the project root:
```bash
cd backend
npm install
npm run dev
```
The server will run on port `5000`. 
*   **Health Check**: `GET /api/health`
*   **Chat Endpoint**: `POST /api/chat`
*   **MCP SSE Endpoint**: `GET /api/sse`
*   **MCP SSE Messages**: `POST /api/messages`

### 3. Running the Frontend
From the project root:
```bash
cd frontend
npm install
npm run dev
```

### 4. Running Regression Tests
From the project root:
```bash
npm test
```
Or run individual phase regression suites:
```bash
npm run test:phase2   # Provider Router & BYOK Security
npm run test:phase3   # Hybrid RAG 2.0 Retrieval
npm run test:phase4   # Diagnostic Quality & Adaptive Length
npm run test:phase5   # MCP Evidence Acquisition Layer
```

---

## Token & Cost Controls (AI Configuration)
Configured with safe defaults in `backend/src/utils/config.js`:
*   `MAX_USER_MESSAGE_CHARS = 2000` (rejects messages exceeding this limit)
*   `MAX_CONTEXT_CHARS = 5000` (safely truncates pre-retrieved RAG context)
*   `MAX_HISTORY_MESSAGES = 8` (persists conversation context sliding window in memory)
*   `MAX_OUTPUT_TOKENS = 500` (limits token footprint)
*   `MAX_AGENT_STEPS = 3` (strictly limits loop steps to avoid runaway execution)
*   `MAX_TOOL_CALLS_PER_REQUEST = 2` (caps total tool executions per request)
*   `REQUEST_TIMEOUT_MS = 20000` (enforces API call timeouts)

---

## Current Phase-1 Limitations
*   **Static Retrieval**: Current BRAG retrieval is static keyword-based RAG.
*   **Embeddings & Vectors**: Embeddings, vector retrieval, dynamic document ingestion, and advanced RAG are intentionally **not implemented yet** (reserved for Phase 2).
*   **History Persistence**: Chat history is stored in-memory on the backend and fits a single-user local deployment.
