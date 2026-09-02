import { retrieveHybridContext } from './hybridRagService.js';
import { retrieveKeywordContext } from './keywordRagService.js';

/**
 * Primary RAG Context Retrieval Interface.
 * Executes Hybrid Retrieval (Dense pgvector + Sparse Keyword scoring with RRF reranking),
 * falling back seamlessly to keyword matching if vector similarity returns nothing or database is unreachable.
 *
 * @param {string} query User prompt or diagnostic query
 * @returns {Promise<Array<object>>} Array of retrieved knowledge items decorated with .generalContext and .debuggingContext
 */
export async function retrieveContext(query) {
  try {
    return await retrieveHybridContext(query);
  } catch (err) {
    console.warn(`[RAG] Hybrid retrieval encountered error, falling back to pure keyword search: ${err.message}`);
    const kwResult = await retrieveKeywordContext(query);
    const result = [...kwResult.allMatches];
    result.generalContext = kwResult.generalContext;
    result.debuggingContext = kwResult.debuggingContext;
    result.retrievalMethod = 'keyword_fallback';
    return result;
  }
}

export { retrieveHybridContext, retrieveKeywordContext };
