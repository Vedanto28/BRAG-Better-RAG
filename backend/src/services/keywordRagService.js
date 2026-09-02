import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { AI_CONFIG } from '../utils/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');

const STOP_WORDS = new Set([
  'the', 'who', 'what', 'how', 'why', 'are', 'you', 'and', 'for', 'out',
  'was', 'this', 'that', 'with', 'from', 'about', 'your', 'their', 'them',
  'they', 'some', 'were', 'been', 'have', 'has', 'had', 'its', 'can', 'not'
]);

let cachedData = null;

async function loadAllKnowledge() {
  if (cachedData) return cachedData;

  const [backendRaw, debuggingRaw, projectRaw] = await Promise.all([
    readFile(path.join(dataDir, 'backendKnowledgeBase.json'), 'utf8').catch(() => '[]'),
    readFile(path.join(dataDir, 'debuggingKnowledgeBase.json'), 'utf8').catch(() => '[]'),
    readFile(path.join(dataDir, 'knowledgeBase.json'), 'utf8').catch(() => '[]')
  ]);

  cachedData = {
    backend: JSON.parse(backendRaw),
    debugging: JSON.parse(debuggingRaw),
    project: JSON.parse(projectRaw)
  };
  return cachedData;
}

function tokenize(text) {
  if (typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

function scoreEntry(queryWords, entry) {
  let score = 0;
  if (!entry || typeof entry !== 'object') return score;

  const containsWord = (target, word) => {
    if (!target) return false;
    const escaped = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp('\\b' + escaped + '\\b', 'i');
    if (Array.isArray(target)) {
      return target.some(item => typeof item === 'string' && regex.test(item));
    }
    return typeof target === 'string' && regex.test(target);
  };

  for (const word of queryWords) {
    // 1. Symptoms & Topics (highest weight: 10)
    if (containsWord(entry.symptoms, word) || containsWord(entry.topic, word) || containsWord(entry.title, word)) {
      score += 10;
    }
    // 2. Category & Keywords (weight: 5)
    if (containsWord(entry.category, word) || containsWord(entry.keywords, word)) {
      score += 5;
    }
    // 3. Causes & Code Search Hints (weight: 3)
    if (containsWord(entry.commonCauses, word) || containsWord(entry.codeSearchHints, word)) {
      score += 3;
    }
    // 4. Content / Fix (weight: 2)
    if (containsWord(entry.content, word) || containsWord(entry.typicalFix, word)) {
      score += 2;
    }
  }

  return score;
}

/**
 * Keyword-based retrieval across all local knowledge files.
 * @param {string} query
 * @returns {Promise<{ allMatches: Array<object>, generalContext: string, debuggingContext: string }>}
 */
export async function retrieveKeywordContext(query) {
  const queryWords = tokenize(query);
  if (queryWords.length === 0) {
    return { allMatches: [], generalContext: '', debuggingContext: '' };
  }

  const { backend, debugging, project } = await loadAllKnowledge();
  const scored = [];

  // Score backend knowledge entries
  for (const entry of backend) {
    const s = scoreEntry(queryWords, entry);
    if (s > 0) scored.push({ entry, score: s, source: 'backendKnowledgeBase' });
  }

  // Score debugging entries
  for (const entry of debugging) {
    const s = scoreEntry(queryWords, entry);
    if (s > 0) scored.push({ entry, score: s, source: 'debuggingKnowledgeBase' });
  }

  // Score project entries
  for (const entry of project) {
    const s = scoreEntry(queryWords, entry);
    if (s > 0) scored.push({ entry, score: s, source: 'knowledgeBase' });
  }

  scored.sort((a, b) => b.score - a.score);
  const topMatches = scored.slice(0, AI_CONFIG.MAX_RAG_RESULTS || 4).map(item => ({
    id: item.entry.id,
    ...item.entry,
    score: item.score,
    source: item.source
  }));

  const generalMatches = topMatches.filter(m => !m.category?.includes('debugging') && !m.symptoms);
  const debuggingMatches = topMatches.filter(m => m.category?.includes('debugging') || m.symptoms);

  const generalContext = generalMatches.map(m => `${m.topic || m.title}: ${m.content || m.typicalFix || ''}`).join('\n');
  const debuggingContext = debuggingMatches.map(m => {
    return `Diagnostic Topic: ${m.title || m.id}\nCategory: ${m.category}\nSymptoms: ${Array.isArray(m.symptoms) ? m.symptoms.join(', ') : m.symptoms || ''}\nCommon Causes: ${Array.isArray(m.commonCauses) ? m.commonCauses.join(', ') : m.commonCauses || ''}\nInvestigation Steps: ${Array.isArray(m.investigationSteps) ? m.investigationSteps.join(' -> ') : m.investigationSteps || ''}\nTypical Evidence: ${m.typicalEvidence || ''}\nTypical Fix: ${m.typicalFix || ''}`;
  }).join('\n\n');

  return {
    allMatches: topMatches,
    generalContext,
    debuggingContext
  };
}
