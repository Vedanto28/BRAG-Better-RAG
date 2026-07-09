import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { AI_CONFIG } from '../utils/config.js';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const knowledgeBasePath = path.join(currentDir, '..', 'data', 'knowledgeBase.json');
const debuggingBasePath = path.join(currentDir, '..', 'data', 'debuggingKnowledgeBase.json');

async function loadKnowledgeBase() {
  try {
    const fileContents = await readFile(knowledgeBasePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    console.error('[RAG] Failed to load knowledge base:', error);
    return [];
  }
}

async function loadDebuggingBase() {
  try {
    const fileContents = await readFile(debuggingBasePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    console.error('[RAG] Failed to load debugging knowledge base:', error);
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

/**
 * Calculates a matching score for a debugging entry based on the query.
 * Symptoms match: highest weight (10)
 * Category match: high weight (5)
 * Common Causes / Code Search Hints match: medium weight (2)
 */
function scoreDebuggingEntry(query, entry) {
  if (!entry || typeof entry !== 'object') {
    return 0;
  }
  const q = query.toLowerCase();

  // Tokenize the query into words of length > 2, excluding stop words
  const queryWords = q
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
  if (queryWords.length === 0) {
    return 0;
  }

  const containsWord = (target, word) => {
    if (!target) return false;
    const escapedWord = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const wordRegex = new RegExp('\\b' + escapedWord + '\\b', 'i');
    if (Array.isArray(target)) {
      return target.some(item => typeof item === 'string' && wordRegex.test(item));
    }
    return typeof target === 'string' && wordRegex.test(target);
  };

  let score = 0;
  for (const word of queryWords) {
    // symptoms: highest weight (10)
    if (containsWord(entry.symptoms, word)) {
      score += 10;
    }
    // category: high weight (5)
    if (containsWord(entry.category, word)) {
      score += 5;
    }
    // commonCauses: medium weight (2)
    if (containsWord(entry.commonCauses, word)) {
      score += 2;
    }
    // codeSearchHints: medium weight (2)
    if (containsWord(entry.codeSearchHints, word)) {
      score += 2;
    }
  }
  return score;
}

export async function retrieveContext(query) {
  const normalizedQuery = normalizeText(query).trim();
  if (!normalizedQuery) {
    return [];
  }

  const [knowledgeBase, debuggingBase] = await Promise.all([
    loadKnowledgeBase(),
    loadDebuggingBase()
  ]);

  // 1. General matches (existing logic)
  const generalMatches = Array.isArray(knowledgeBase)
    ? knowledgeBase.filter((entry) => hasKeywordMatch(normalizedQuery, entry))
    : [];
  const maxResults = AI_CONFIG.MAX_RAG_RESULTS || 3;
  const slicedGeneral = generalMatches.slice(0, maxResults);

  // 2. Debugging matches (extended logic with scoring & ranking)
  const scoredDebugging = [];
  if (Array.isArray(debuggingBase)) {
    for (const entry of debuggingBase) {
      const score = scoreDebuggingEntry(normalizedQuery, entry);
      if (score > 0) {
        scoredDebugging.push({ entry, score });
      }
    }
  }

  // Sort by score descending
  scoredDebugging.sort((a, b) => b.score - a.score);
  const slicedDebugging = scoredDebugging.slice(0, 3).map(item => item.entry);

  // 3. Format contexts
  const generalContextText = slicedGeneral.map((entry) => `${entry.topic}: ${entry.content}`).join('\n');
  const debuggingContextText = slicedDebugging.map((entry) => {
    return `ID: ${entry.id}\nCategory: ${entry.category}\nSymptoms: ${entry.symptoms.join(', ')}\nCommon Causes: ${entry.commonCauses.join(', ')}\nInvestigation Steps: ${entry.investigationSteps.join(', ')}\nCode Search Hints: ${entry.codeSearchHints.join(', ')}`;
  }).join('\n\n');

  // Maintain 100% backward compatibility by returning a decorated array of general matches
  const result = [...slicedGeneral];
  result.generalContext = generalContextText;
  result.debuggingContext = debuggingContextText;
  result.debuggingMatches = slicedDebugging;

  return result;
}
