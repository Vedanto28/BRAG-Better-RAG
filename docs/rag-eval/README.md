# BRAG Phase 4E: RAG Evaluation + Quality Benchmarking Report

## STATUS
Phase 4E evaluation harness and baseline measurement are complete. A fully defensible quantitative RAG benchmark is not yet established because the current dataset lacks explicit chunk-level ground truth and the evaluation harness does not retain raw LLM outputs required for rigorous citation and hallucination evaluation.

## DATASET
- **Questions:** 25
- **Ground truth valid for quantitative retrieval:** 0/25
  *(The current ground truth relies on heuristic keyword matching instead of explicit chunk-IDs. It is insufficient for rigorous quantitative measurement of precision and recall).*

## RETRIEVAL
- **Hit@3:** 11/13 = 84.6%
- **Hit@5:** 11/13 = 84.6%
  *(Note: Hit@3 and Hit@5 are identical because `retrieveContext` currently caps retrieval at a maximum of 3 chunks. Hit@5 does not independently validate rank-4 or rank-5 retrieval).*
- **MRR:** 0.8077
- **Precision:** NOT MEASURABLE
  *(Cannot be measured because keyword matching produces false positives, and the dataset lacks explicit target chunk-IDs to verify if a retrieved chunk is genuinely relevant versus merely containing the keyword).*
- **Recall:** NOT MEASURABLE
  *(Cannot be measured because the dataset does not specify the total number of genuinely relevant chunks available in the database for each query).*
- **Irrelevant-context rate:** 15.4%

## PROVENANCE
- **Citation/provenance accuracy:** NOT MEASURABLE
  *(The evaluation harness did not retain raw LLM outputs required for offline citation and source attribution verification).*

## HALLUCINATION
- **Rigorous hallucination rate:** NOT MEASURABLE
  *(Requires stored raw LLM outputs and human-level or LLM-as-a-judge evaluation).*
- **Heuristic proxy result:** 0%
  *(Strictly an automated regex keyword proxy checking `answer.includes('src/components')` on `knowledge_debugging` queries; this does NOT represent a validated hallucination rate).*

## MCP
- **MCP correctly triggered:** 12/16
  *(12 cases correctly routed to the EXACT tool-based mode. 2 cases triggered tools but routed to the wrong tool-based mode. 2 cases improperly bypassed tools).*
- **MCP correctly bypassed:** 7/9
  *(7 cases correctly routed to the EXACT bypass mode. 1 case bypassed tools but routed to the wrong bypass mode. 1 case improperly triggered tools).*
- **MCP strict overall accuracy:** 19/25 = 76%

## BENCHMARK VALIDITY
**Is this now a defensible quantitative benchmark?**
NO.

**Explanation:**
The current dataset uses `expectedRagKeywords` (heuristic substring matching) rather than `expectedChunkIds` (exact semantic mapping). While useful for baseline measurement and sanity checking, it cannot calculate true Precision or Recall, nor can it rigorously evaluate Citation Accuracy or Hallucinations without capturing the generated answers for evaluation. Furthermore, reliance on live LLM calls during MCP evaluation exposed the benchmark to provider rate limits, skewing evaluation runs towards deterministic fallback paths.

## WORST CATEGORIES
- **Log Investigation:** Error strings (e.g., SyntaxError, ECONNREFUSED) often overlap with `knowledge_debugging` and `repository_investigation` intents, causing the planner to route to incorrect modes (4/4 failures in strict mode matching for Q22-Q25).

## PROPOSED FUTURE IMPROVEMENTS
1. **Deterministic PostgreSQL benchmark corpus:** Seed the database with a fixed, known corpus of documents.
2. **Explicit expectedChunkIds:** Update `dataset.json` with explicit `expectedChunkIds` for every query to enable true Precision and Recall calculations.
3. **Stored raw LLM outputs:** Capture and persist raw LLM responses in results artifacts to allow rigorous offline provenance and hallucination verification.
4. **Separate RAG and MCP benchmarks:** Decouple RAG vector retrieval evaluation from live LLM capability planner evaluation to isolate API rate-limit and quota factors.

## REGRESSION
- **RAG tests:** PASS
- **MCP tests:** PASS
- **Diagnostic tests:** PASS
- **Frontend build:** PASS

## FILES CHANGED
- `docs/rag-eval/README.md`
- `docs/rag-eval/dataset.json`
- `docs/rag-eval/results.json`
- `docs/rag-eval/run_eval.js`
- `backend/test/rag-eval/calc_metrics.js`


## BLOCKERS
None.
