import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { AI_CONFIG } from '../utils/config.js';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const knowledgeBasePath = path.join(currentDir, '..', 'data', 'knowledgeBase.json');

async function loadKnowledgeBase() {
  try {
    const fileContents = await readFile(knowledgeBasePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    console.error('[RAG] Failed to load knowledge base:', error);
    return [];
  }
}

function normalizeText(value) {
  return typeof value === 'string' ? value.toLowerCase() : '';
}

const STOP_WORDS = new Set([
  'the', 'who', 'what', 'how', 'why', 'are', 'you', 'and', 'for', 'out',
  'was', 'this', 'that', 'with', 'from', 'about', 'your', 'their', 'them',
  'they', 'some', 'were', 'been', 'have', 'has', 'had', 'its', 'can', 'not'
]);

function hasKeywordMatch(query, entry) {
  if (!entry || typeof entry !== 'object') {
    return false;
  }
  const normalizedQuery = normalizeText(query).trim();
  if (!normalizedQuery) {
    return false;
  }

  // Tokenize the query into words of length > 2, excluding stop words
  const queryWords = normalizedQuery
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
  if (queryWords.length === 0) {
    return false;
  }

  const topic = normalizeText(entry.topic);
  const content = normalizeText(entry.content);
  const category = normalizeText(entry.category);
  const keywords = Array.isArray(entry.keywords)
    ? entry.keywords.filter((k) => typeof k === 'string').map((k) => k.toLowerCase())
    : [];

  // Check if any query word matches topic, content, category, or keywords as a whole word
  return queryWords.some((word) => {
    // Escape special characters just in case, though words here are alpha-numeric
    const escapedWord = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const wordRegex = new RegExp('\\b' + escapedWord + '\\b', 'i');

    return (
      wordRegex.test(topic) ||
      wordRegex.test(content) ||
      wordRegex.test(category) ||
      keywords.some((kw) => wordRegex.test(kw))
    );
  });
}

export async function retrieveContext(query) {
  const normalizedQuery = normalizeText(query).trim();
  if (!normalizedQuery) {
    return [];
  }

  const knowledgeBase = await loadKnowledgeBase();
  if (!Array.isArray(knowledgeBase)) {
    return [];
  }

  const matched = knowledgeBase.filter((entry) => hasKeywordMatch(normalizedQuery, entry));
  const maxResults = AI_CONFIG.MAX_RAG_RESULTS || 3;
  return matched.slice(0, maxResults);
}

