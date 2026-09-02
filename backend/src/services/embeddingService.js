import { GoogleGenerativeAI } from '@google/generative-ai';

const EMBEDDING_MODEL_NAME = 'gemini-embedding-001';
export const EMBEDDING_DIMENSION = 768;

let genAIInstance = null;

function getGenAI() {
  if (!genAIInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured for embeddings.');
    }
    genAIInstance = new GoogleGenerativeAI(apiKey);
  }
  return genAIInstance;
}

/**
 * Generates a 768-dimensional embedding vector for a given text query or chunk.
 * @param {string} text Text to embed
 * @returns {Promise<number[]>} Array of 768 floating point numbers
 */
export async function generateEmbedding(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Text must be a non-empty string for embedding.');
  }

  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL_NAME });

  const response = await model.embedContent({
    content: { parts: [{ text: text.trim().slice(0, 8000) }] },
    outputDimensionality: EMBEDDING_DIMENSION
  });

  if (!response.embedding || !Array.isArray(response.embedding.values)) {
    throw new Error('Invalid embedding response from Gemini Embedding API.');
  }

  const values = response.embedding.values;
  if (values.length !== EMBEDDING_DIMENSION) {
    // In case model returns native dimension without slicing
    return values.slice(0, EMBEDDING_DIMENSION);
  }

  return values;
}

/**
 * Generates embeddings for an array of texts with sequential throttling to respect rate limits.
 * @param {string[]} texts
 * @param {number} [delayMs=100]
 * @returns {Promise<number[][]>}
 */
export async function generateEmbeddingsBatch(texts, delayMs = 150) {
  const embeddings = [];
  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    const emb = await generateEmbedding(text);
    embeddings.push(emb);
    if (i < texts.length - 1 && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return embeddings;
}
