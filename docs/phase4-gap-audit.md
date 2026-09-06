# BRAG — Phase 4A: Product Architecture & Gap Audit

**Date:** 2026-09-06  
**Auditor:** BRAG Autonomous Engineering Agent  
**Audit Scope:** Full Product Surface (Experience, Engine, Platform)  
**Methodology:** Read-only static inspection of codebase, Neon PostgreSQL schema, and runtime configurations. No code or schema modifications made.

---

## 1. Executive Summary

BRAG (Better RAG) has established a resilient, production-grade foundation across authentication (Better Auth + Neon PostgreSQL + same-origin Vercel proxy), multi-provider AI routing (6 providers with rate-limit telemetry awareness and BYOK zero-leakage isolation), hybrid vector/sparse retrieval, and server-side anti-IDOR data security.

However, a significant **Experience–Engine Disconnect** exists:
1. The backend has rich, structured diagnostic persistence (`investigations`, `messages`, `evidence`, `diagnostic_reports`, `usage_metadata`), but the frontend **History Archive** (`InvestigationHistoryPage.tsx`) and **Case Report** (`InvestigationDetailPage.tsx`) remain hardcoded to static mock data and simulated `setTimeout` handlers.
2. The **Live Console** (`useChat.js`) does not pass `investigationId` on multi-turn conversations, causing each message to spawn a new isolated investigation thread in the database rather than appending to an ongoing diagnostic session.
3. The **RAG Engine** operates on a functional hybrid dense (pgvector) + sparse (BM25) fusion architecture with unit spot-checks, but lacks a formal offline evaluation benchmark (Hit@K, MRR, NDCG).

---

## 2. Comprehensive Audit Matrix

| Area | Item | Status | Evidence (Files / Tables) | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Experience** | **Live Console: Investigation Creation** | **Implemented** | `frontend/src/hooks/useChat.js:34`<br>`frontend/src/services/chatService.js:49`<br>`backend/src/routes/chatRouter.js:80`<br>`backend/src/db/investigationRepository.js:11` | Calls `POST /api/chat`, invokes `runAgentOrchestrator`, and creates a persistent row in the `investigations` table in Neon. |
| **Experience** | **Live Console: Naming & Title Generation** | **Partial** | `backend/src/db/investigationRepository.js:181`<br>`frontend/src/App.jsx:180-184` | Backend automatically titles investigations with the first 60 characters of the initial prompt (`userMessage.slice(0, 60)`). However, the Live Console UI header displays static `"BRAG / Live Console"` rather than the active investigation title or ID. |
| **Experience** | **Live Console: Evidence Panel** | **Missing** | `frontend/src/components/ChatHistory.jsx:63`<br>`frontend/src/components/MessageBubble.jsx:50-68` | Live Console only displays an inline badge tag in the assistant bubble footer (`RAG Context`, `Tools: [...]`). The rich collapsible Evidence Drawer/Pane (present in `InvestigationDetailPage.tsx`) is missing from the Live Console view. |
| **Experience** | **Live Console: Execution Timeline** | **Missing** | `frontend/src/components/MessageBubble.jsx:1-74`<br>`frontend/src/components/investigation/InvestigationDetailPage.tsx:119-146` | Live Console has no visual step-by-step diagnostic pipeline execution timeline (Planning -> Static Analysis -> MCP Ingestion -> Report Synthesis), which currently exists only in the static Case Report mock component. |
| **Experience** | **Live Console: Retrieved-Evidence Display** | **Partial** | `frontend/src/components/MessageBubble.jsx:50-68`<br>`backend/src/services/agentOrchestrator.js:620` | Full external/internal evidence arrays (`inspectedPaths`, `externalEvidence`, `logEvidence`) are returned in `metadata`, but `MessageBubble.jsx` only renders a small pill tag rather than expandable evidence cards with code snippets, diffs, or line ranges. |
| **Experience** | **Live Console: Source & Provenance Display** | **Missing** | `frontend/src/components/MessageBubble.jsx:45-69` | Source repository names, relative file paths, and confidence scores are not rendered in the Live Console response bubble. |
| **Experience** | **Live Console: Finding / Confidence / Root Cause Display** | **Partial** | `backend/src/services/agentOrchestrator.js:54-102`<br>`frontend/src/components/MessageBubble.jsx:45-47` | The LLM outputs structured markdown sections (`Finding`, `Root cause`, `Evidence`, `Confidence`, `What this means`), but the frontend renders them as a monolithic plain-text markdown block without structured UI card containers or confidence meters. |
| **Experience** | **Live Console: Follow-up Investigation Flow** | **Partial** | `frontend/src/hooks/useChat.js:21-49`<br>`backend/src/routes/chatRouter.js:83-143` | `useChat.js` maintains a local in-memory UI message history, but does NOT store `data.metadata.investigationId` from turn 1 or pass `investigationId` in subsequent `sendChatMessage()` calls. Consequently, multi-turn follow-ups are orphaned as independent, single-turn DB investigations. |
| **Experience** | **Live Console: Investigation Status** | **Partial** | `backend/src/db/migrations/001_initial_schema.sql:13`<br>`frontend/src/App.jsx:178-222` | Database tracks status (`active`, `completed`, `archived`), but Live Console header does not show status badges (e.g. `Investigating`, `Resolved`, `Failed`). |
| **Experience** | **History Archive: Persisted vs Mocked** | **Partial** | `backend/src/routes/chatRouter.js:192-243`<br>`frontend/src/services/chatService.js:98-129`<br>`frontend/src/components/history/InvestigationHistoryPage.tsx:19`<br>`frontend/src/mockData/index.ts:82-234` | Full backend CRUD & anti-IDOR endpoints are implemented (`/api/investigations`, `/api/investigations/:id`, `/messages`, `/evidence`, `/report`). However, `InvestigationHistoryPage.tsx` initializes with `useState(mockInvestigations)` and never calls `fetchUserInvestigations()`. |
| **Experience** | **History Archive: Investigation Reopening & State Restoration** | **Missing** | `frontend/src/App.jsx:251-266`<br>`frontend/src/components/investigation/InvestigationDetailPage.tsx:19-55` | Selecting a historical case in `App.jsx` sets `selectedCaseId` and opens `InvestigationDetailPage.tsx`. However, `InvestigationDetailPage.tsx` matches against `mockInvestigations` and uses hardcoded mock messages/steps with a fake `setTimeout` send handler, completely disconnected from real DB data. |
| **Experience** | **Settings: Real vs Placeholder UI** | **Partial** | `frontend/src/components/settings/AccountSettingsPage.tsx:17-370`<br>`backend/src/routes/userRouter.js:12-79`<br>`backend/src/db/userProfileRepository.js:1-160` | - **Profile & Security**: Real (connected to `/api/user/profile`).<br>- **Agent Defaults**: Partial (saves `defaultProvider` and `telemetryEnabled` to `/api/user/preferences`; `maxBudget` is local state).<br>- **Usage & Quota**: Placeholder (uses `mockUsageMetrics`).<br>- **Models & Privacy**: Missing (tab button exists, but no render block in JSX).<br>- **Danger Zone**: Partial (Revoke Sessions works via `signOut()`; Delete Account only shows a toast). |
| **Engine** | **RAG: Retrieval Quality & Evaluation Signal** | **Partial / Spot-Checked** | `backend/src/services/hybridRagService.js:15-93`<br>`backend/src/services/keywordRagService.js:1-120`<br>`backend/test/testHybridRagRetrieval.js:9-65` | Dense pgvector cosine similarity (`vector(768)`) + sparse keyword BM25 fallback with Reciprocal Rank Fusion (RRF, $k=60$) is fully operational. Verified on 5 spot-check queries in test suite, but has **never been benchmarked against a formal evaluation dataset** (no Hit@K, MRR, NDCG metrics). |
| **Engine** | **Agent Orchestrator: State Mapping & Loop** | **Implemented** | `backend/src/services/agentOrchestrator.js:236-665`<br>`backend/src/services/capabilityPlanner.js:1-180`<br>`backend/src/services/complexityClassifier.js:1-110` | Implements query complexity classification (low/medium/high), capability planning, mode routing (7 modes), multi-step tool loop with 6-call budget cap, observability trace generation, and secret redaction. |
| **Engine** | **Agent Orchestrator: Multi-turn Memory** | **Partial** | `backend/src/services/agentOrchestrator.js:136, 296-302` | Orchestrator uses a module-level `let globalHistory = []` array in Node memory (truncated at 10 items) rather than querying previous turns from PostgreSQL `messages` table for the active `investigationId`. |
| **Engine** | **Providers: Wiring & Adapter Completeness** | **Implemented** | `backend/src/providers/providerRouter.js:6-40`<br>`backend/src/providers/geminiProvider.js:1-350`<br>`backend/src/providers/openaiProvider.js:1-120`<br>`backend/src/providers/deepseekProvider.js:1-110`<br>`backend/src/utils/providerLimits.js:7-56` | All 6 candidate providers are wired with standard adapters:<br>1. **Groq**: Llama 3.3 / Qwen (OpenAI-compatible)<br>2. **Gemini**: Flash / Pro (`@google/genai` SDK)<br>3. **OpenAI**: GPT-4o / GPT-4o-mini (OpenAI SDK)<br>4. **OpenRouter**: Unified gateway adapter<br>5. **Cerebras**: Llama 3.1 ultra-fast inference<br>6. **DeepSeek**: DeepSeek Chat / Coder |
| **Engine** | **Diagnosis: Fact vs Inference Discipline** | **Implemented** | `backend/src/services/agentOrchestrator.js:122-132` | Explicit system instruction enforcing distinction between **Observed fact** (runtime logs, status codes), **Repository fact** (source code, config files), and **Inference** (reasoned causal hypothesis with confidence score). Enforced in all diagnostic prompts. |
| **Platform** | **Auth: Stability & Session Hydration** | **Implemented** | `backend/src/auth/auth.js:1-85`<br>`backend/src/middleware/authMiddleware.js:1-45`<br>`frontend/src/context/AuthContext.jsx:1-170`<br>`frontend/src/lib/authClient.js:1-15` | Better Auth 1.7.2 with PostgreSQL session store in Neon, same-origin Vercel rewrite proxy (`/api/*`), cookie hydration, automatic token refresh, server-side `requireAuth` on all API routes, and 401 JSON contract. No regressions detected. |
| **Platform** | **BYOK: Provider Isolation & Redaction** | **Implemented** | `frontend/src/components/byok/ProviderHubPage.tsx:22-153`<br>`frontend/src/services/chatService.js:25-41`<br>`backend/src/routes/chatRouter.js:22-77`<br>`backend/src/services/agentOrchestrator.js:10-42` | Zero server-side persistence (keys stored exclusively in browser `sessionStorage`), forwarded via `x-byok-[provider]-key` headers, validated for format (min 10 chars, no whitespace), prioritized in router, and stripped via bidirectional `[REDACTED_USER_KEY]` filtering. |
| **Platform** | **Usage: Telemetry Persistence & Router Integration** | **Implemented** | `backend/src/db/migrations/001_initial_schema.sql:47-59`<br>`backend/src/db/investigationRepository.js:136-159`<br>`backend/src/utils/providerLimits.js:63-99`<br>`backend/src/providers/providerRouter.js:133-145` | Every chat turn records `input_tokens`, `output_tokens`, `tool_calls`, `rag_chunks`, and `latency_ms` in `usage_metadata`. `getRecentProviderUsage()` dynamically aggregates 1-minute (RPM/TPM) and daily (RPD/TPD) usage, triggering 85% threshold near-limit bypass in `providerRouter.js`. |
| **Platform** | **Security: Auth Guards, IDOR & Sanitization** | **Implemented** | `backend/src/middleware/authMiddleware.js:1-45`<br>`backend/src/routes/chatRouter.js:116-127, 191-243`<br>`backend/src/db/investigationRepository.js:18-22, 278-291`<br>`backend/server.js:120-129` | Upfront IDOR checks verify user ownership on investigation mutation and retrieval. Catch-all 404 JSON handler prevents HTML error leaks. Secret redactor strips credentials from diagnostic output. |

---

## 3. Prioritized Top Gaps

The following are the **top 6 gaps** between the current implementation and a frictionless, high-value product loop:

### 1. [CRITICAL] Frontend History Archive & Case Report Disconnected from Live DB
- **Current State:** `InvestigationHistoryPage.tsx` and `InvestigationDetailPage.tsx` render static `mockInvestigations` and simulate follow-ups with `setTimeout`.
- **Impact:** Users cannot browse or reopen their actual past investigations, inspect historical evidence, or review past diagnostic findings.
- **Remedy Path:** Wire `InvestigationHistoryPage` to `fetchUserInvestigations()` and `InvestigationDetailPage` to `fetchInvestigationDetail(id)` / `sendChatMessage(msg, { investigationId })`.

### 2. [CRITICAL] Live Console Turn Chaining & Investigation Threading Missing
- **Current State:** `useChat.js` sends prompt strings to `POST /api/chat` without tracking or passing `investigationId`.
- **Impact:** Each user query in a session creates a disconnected, single-turn row in the `investigations` DB table. The orchestrator cannot recall context from earlier turns in the same investigation thread from PostgreSQL.
- **Remedy Path:** Store `investigationId` from turn 1 response in `useChat.js` state; pass it to subsequent `sendChatMessage` calls; update `agentOrchestrator.js` to load past turns for the active `investigationId`.

### 3. [MAJOR] Live Console Lacks Structured Evidence Drawer & Execution Visualizations
- **Current State:** `MessageBubble.jsx` renders diagnostic results as a single markdown string with a small footer tag (`RAG Context`, `Tools: [...]`).
- **Impact:** The Live Console feels like a basic chatbot rather than a high-end agentic debugger. Rich inspection artifacts (file snippets, line ranges, diffs, tool execution breakdown) are hidden in JSON metadata.
- **Remedy Path:** Port the 3-pane layout / collapsible Evidence Drawer and interactive pipeline steps from `InvestigationDetailPage.tsx` into the Live Console workbench.

### 4. [MAJOR] RAG Pipeline Lacks Quantitative Offline Benchmark
- **Current State:** Retrieval is tested on only 5 spot-check queries in `testHybridRagRetrieval.js`.
- **Impact:** No baseline signal exists for Hit@K, MRR, or NDCG across typical backend failure scenarios (PostgreSQL timeouts, Redis stampedes, Node memory leaks, auth mismatches). Improvements to chunking or embeddings cannot be measured objectively.
- **Remedy Path:** Implement an automated RAG evaluation script (`evaluateRag.js`) with a 25-50 query ground-truth dataset measuring Mean Reciprocal Rank (MRR) and Hit@3.

### 5. [MINOR] Account Settings Usage Tab & Models Tab Incomplete
- **Current State:** Usage & Quota tab displays hardcoded `mockUsageMetrics` instead of live aggregation from `usage_metadata`; the Models & Privacy tab button renders blank.
- **Impact:** Users cannot see their real monthly token consumption, active BYOK usage breakdown, or configure model preferences in the UI.
- **Remedy Path:** Add `GET /api/user/usage` endpoint aggregating `usage_metadata` for the authenticated user and wire it to `AccountSettingsPage.tsx`.

### 6. [MINOR] Danger Zone Account Deletion Endpoint Missing
- **Current State:** Clicking "Delete Developer Account" in Settings opens a confirmation modal that emits a toast notification without calling any backend endpoint.
- **Impact:** Users cannot execute GDPR/privacy-compliant self-service account removal.
- **Remedy Path:** Implement `DELETE /api/user/account` endpoint with cascade deletion of user sessions, preferences, and investigations.

---

## 4. Surprises & Positive Findings

1. **Provider Router & Rate Limiting are 100% Real:** Unlike many prototypes that mock rate-limit awareness, BRAG's `providerLimits.js` actually executes SQL queries against `usage_metadata` to measure real-time RPM/TPM/RPD/TPD and automatically bypasses near-limit providers with an 85% threshold.
2. **BYOK Security Architecture is Fully Sound:** The browser `sessionStorage` -> ephemeral header -> server-side key validation -> bidirectional regex redaction pipeline is completely implemented, tested, and secure.
3. **Anti-IDOR Protection is Upfront and Comprehensive:** Every investigation and diagnostic report endpoint validates `user_id` ownership both at the Express route middleware layer and deep within `investigationRepository.js`.
4. **Rich UI Components Already Exist in Codebase:** The 3-pane diagnostic layout, collapsible evidence drawer, and confidence badges in `InvestigationDetailPage.tsx` are fully designed with TailwindCSS and Lucide icons—they simply need to be wired to real data APIs instead of mock data.

---

## 5. Next Steps

1. **Phase 4B (Console & Threading Hardening):** Connect `useChat.js` to track `investigationId`, enable continuous multi-turn diagnostic chaining, and render structured Finding/Root-Cause/Confidence cards with an expandable Evidence Drawer in Live Console.
2. **Phase 4C (History Archive & Case Report Live Data Wiring):** Replace `mockInvestigations` in `InvestigationHistoryPage.tsx` and `InvestigationDetailPage.tsx` with live data fetched from `/api/investigations` and `/api/investigations/:id`.
3. **Phase 4D (RAG Evaluation & Benchmark Suite):** Create an automated offline evaluation script with a 30-case failure taxonomy eval set to measure Hit@K and MRR across dense, sparse, and hybrid fusion modes.
