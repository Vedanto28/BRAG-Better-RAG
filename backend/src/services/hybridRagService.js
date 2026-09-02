import { query as dbQuery } from '../db/connection.js';
import { generateEmbedding } from './embeddingService.js';
import { retrieveKeywordContext } from './keywordRagService.js';
import { AI_CONFIG } from '../utils/config.js';

const VECTOR_SIMILARITY_THRESHOLD = 0.55;
const RRF_K = 60;

/**
 * Performs vector similarity search over knowledge_chunks in Neon PostgreSQL.
 * @param {string} queryText User query
 * @param {number} [limit=4] Max candidates to return
 * @returns {Promise<Array<{ id: string, chunk_text: string, category: string, source: string, metadata: object, score: number }>>}
 */
export async function searchVectorKnowledge(queryText, limit = 4) {
  try {
    const embedding = await generateEmbedding(queryText);
    const vectorString = `[${embedding.join(',')}]`;

    const result = await dbQuery(
      `SELECT 
         id,
         chunk_text,
         category,
         source,
         metadata,
         (1 - (embedding <=> $1::vector)) AS score
       FROM knowledge_chunks
       WHERE (1 - (embedding <=> $1::vector)) >= $2
       ORDER BY embedding <=> $1::vector ASC
       LIMIT $3`,
      [vectorString, VECTOR_SIMILARITY_THRESHOLD, limit]
    );

    return result.rows.map(row => ({
      id: row.id,
      chunk_text: row.chunk_text,
      category: row.category,
      source: row.source,
      metadata: row.metadata || {},
      score: parseFloat(row.score) || 0
    }));
  } catch (err) {
    console.warn(`[HybridRAG] Vector search failed or skipped: ${err.message}`);
    return [];
  }
}

/**
 * Reciprocal Rank Fusion (RRF) to merge and rerank sparse (keyword) and dense (vector) matches.
 * @param {Array<object>} vectorMatches
 * @param {Array<object>} keywordMatches
 * @param {number} [topN=3]
 * @returns {Array<object>}
 */
export function fuseHybridResults(vectorMatches = [], keywordMatches = [], topN = 3) {
  const fusedScores = new Map();
  const docMap = new Map();

  // 1. Process Vector Ranks (dense semantic)
  vectorMatches.forEach((match, rank) => {
    const id = match.id;
    docMap.set(id, match);
    const rrf = 1.0 / (RRF_K + (rank + 1));
    fusedScores.set(id, (fusedScores.get(id) || 0) + rrf * 1.2);
  });

  // 2. Process Keyword Ranks (sparse exact)
  keywordMatches.forEach((match, rank) => {
    const id = match.id;
    if (!docMap.has(id)) {
      docMap.set(id, {
        id: match.id,
        chunk_text: match.content || match.text || match.title || '',
        category: match.category || 'general',
        source: match.source || 'keyword',
        metadata: match
      });
    }
    const rrf = 1.0 / (RRF_K + (rank + 1));
    fusedScores.set(id, (fusedScores.get(id) || 0) + rrf * 1.0);
  });

  // 3. Sort by fused score descending
  const sortedIds = Array.from(fusedScores.keys()).sort(
    (a, b) => fusedScores.get(b) - fusedScores.get(a)
  );

  return sortedIds.slice(0, topN).map(id => ({
    ...docMap.get(id),
    fusedScore: fusedScores.get(id)
  }));
}

/**
 * Main Hybrid Context Retrieval entrypoint.
 * Merges dense vector similarity search with keyword search, falling back seamlessly.
 *
 * @param {string} userQuery
 * @returns {Promise<Array<object>>} Decorated results array compatible with Agent Orchestrator
 */
export async function retrieveHybridContext(userQuery) {
  if (!userQuery || typeof userQuery !== 'string' || userQuery.trim().length === 0) {
    const empty = [];
    empty.generalContext = '';
    empty.debuggingContext = '';
    empty.retrievalMethod = 'none';
    return empty;
  }

  const cleanQuery = userQuery.trim();
  const maxResults = AI_CONFIG.MAX_RAG_RESULTS || 3;

  // Run vector search and keyword search in parallel
  const [vectorMatches, keywordResult] = await Promise.all([
    searchVectorKnowledge(cleanQuery, maxResults),
    retrieveKeywordContext(cleanQuery)
  ]);

  let finalChunks = [];
  let retrievalMethod = 'hybrid';

  if (vectorMatches.length > 0) {
    finalChunks = fuseHybridResults(vectorMatches, keywordResult.allMatches || [], maxResults);
    retrievalMethod = keywordResult.allMatches?.length > 0 ? 'hybrid' : 'vector';
  } else if (keywordResult.allMatches && keywordResult.allMatches.length > 0) {
    finalChunks = keywordResult.allMatches.slice(0, maxResults);
    retrievalMethod = 'keyword_fallback';
  }

  // Format concise contextual blocks for prompt injection
  const generalContextParts = [];
  const debuggingContextParts = [];

  for (const chunk of finalChunks) {
    const text = chunk.chunk_text;
    const meta = chunk.metadata || {};
    const isDiag = chunk.category?.includes('database') ||
                   chunk.category?.includes('auth') ||
                   chunk.category?.includes('node') ||
                   chunk.category?.includes('async') ||
                   chunk.category?.includes('network') ||
                   chunk.category?.includes('docker') ||
                   chunk.category?.includes('websocket') ||
                   chunk.category?.includes('cors') ||
                   chunk.category?.includes('middleware') ||
                   chunk.category?.includes('debugging') ||
                   meta.symptoms ||
                   meta.investigationSteps;

    if (isDiag) {
      if (text) {
        debuggingContextParts.push(text);
      } else {
        debuggingContextParts.push(
          `Diagnostic Topic: ${meta.title || chunk.id}\nCategory: ${chunk.category}\nSymptoms: ${Array.isArray(meta.symptoms) ? meta.symptoms.join(', ') : meta.symptoms || ''}\nCommon Causes: ${Array.isArray(meta.commonCauses) ? meta.commonCauses.join(', ') : meta.commonCauses || ''}\nInvestigation Steps: ${Array.isArray(meta.investigationSteps) ? meta.investigationSteps.join(' -> ') : meta.investigationSteps || ''}\nTypical Evidence: ${meta.typicalEvidence || ''}\nTypical Fix: ${meta.typicalFix || ''}`
        );
      }
    } else {
      if (text) {
        generalContextParts.push(text);
      } else {
        generalContextParts.push(`${meta.topic || chunk.id}: ${meta.content || ''}`);
      }
    }
  }

  const result = [...finalChunks];
  result.generalContext = generalContextParts.join('\n\n');
  result.debuggingContext = debuggingContextParts.join('\n\n');
  result.retrievedChunks = finalChunks;
  result.retrievalMethod = retrievalMethod;
  result.vectorMatchesCount = vectorMatches.length;
  result.keywordMatchesCount = keywordResult.allMatches?.length || 0;

  return result;
}
