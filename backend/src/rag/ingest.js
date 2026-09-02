import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import { query } from '../db/connection.js';
import { generateEmbedding } from '../services/embeddingService.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');

async function loadJsonFile(filename) {
  try {
    const raw = await readFile(path.join(dataDir, filename), 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[Ingestion] Could not load ${filename}: ${err.message}`);
    return [];
  }
}

function formatChunkText(entry, source) {
  if (source === 'backendKnowledgeBase' || source === 'debuggingKnowledgeBase') {
    const title = entry.title || entry.id;
    const category = entry.category || 'general-debugging';
    const symptoms = Array.isArray(entry.symptoms) ? entry.symptoms.join('; ') : entry.symptoms || '';
    const causes = Array.isArray(entry.commonCauses) ? entry.commonCauses.join('; ') : entry.commonCauses || '';
    const steps = Array.isArray(entry.investigationSteps) ? entry.investigationSteps.join(' -> ') : entry.investigationSteps || '';
    const evidence = entry.typicalEvidence || '';
    const fix = entry.typicalFix || '';
    const hints = Array.isArray(entry.codeSearchHints) ? entry.codeSearchHints.join(', ') : entry.codeSearchHints || '';

    return `Diagnostic Topic: ${title}\nCategory: ${category}\nSymptoms: ${symptoms}\nCommon Causes: ${causes}\nInvestigation Steps: ${steps}\nTypical Evidence: ${evidence}\nTypical Fix: ${fix}\nCode Search Hints: ${hints}`;
  }

  // General project knowledge
  const topic = entry.topic || entry.id;
  const content = entry.content || '';
  const category = entry.category || 'BRAG Project';
  const keywords = Array.isArray(entry.keywords) ? entry.keywords.join(', ') : '';

  return `Topic: ${topic}\nCategory: ${category}\nContent: ${content}\nKeywords: ${keywords}`;
}

export async function runIngestion() {
  console.log('============================================================');
  console.log('BRAG RAG 2.0: BATCH KNOWLEDGE BASE INGESTION PIPELINE');
  console.log('============================================================\n');

  // 1. Load Knowledge Files
  const [backendEntries, debuggingEntries, projectEntries] = await Promise.all([
    loadJsonFile('backendKnowledgeBase.json'),
    loadJsonFile('debuggingKnowledgeBase.json'),
    loadJsonFile('knowledgeBase.json')
  ]);

  console.log(`[Ingestion] Loaded ${backendEntries.length} backend knowledge entries.`);
  console.log(`[Ingestion] Loaded ${debuggingEntries.length} debugging knowledge entries.`);
  console.log(`[Ingestion] Loaded ${projectEntries.length} project metadata entries.`);

  const allItems = [];

  for (const entry of backendEntries) {
    allItems.push({
      id: entry.id,
      category: entry.category || 'backend-fundamentals',
      source: 'backendKnowledgeBase.json',
      text: formatChunkText(entry, 'backendKnowledgeBase'),
      metadata: entry
    });
  }

  for (const entry of debuggingEntries) {
    // Avoid duplicate IDs if already present
    if (!allItems.some(item => item.id === entry.id)) {
      allItems.push({
        id: entry.id,
        category: entry.category || 'debugging-guide',
        source: 'debuggingKnowledgeBase.json',
        text: formatChunkText(entry, 'debuggingKnowledgeBase'),
        metadata: entry
      });
    }
  }

  for (const entry of projectEntries) {
    if (!allItems.some(item => item.id === entry.id)) {
      allItems.push({
        id: entry.id,
        category: entry.category || 'brag-project',
        source: 'knowledgeBase.json',
        text: formatChunkText(entry, 'knowledgeBase'),
        metadata: entry
      });
    }
  }

  console.log(`\n[Ingestion] Total normalized chunks to ingest: ${allItems.length}`);
  console.log('[Ingestion] Generating 768-d vector embeddings and upserting into Neon PostgreSQL...');

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    try {
      const embedding = await generateEmbedding(item.text);
      const vectorString = `[${embedding.join(',')}]`;

      await query(
        `INSERT INTO knowledge_chunks (id, chunk_text, embedding, category, source, metadata, created_at)
         VALUES ($1, $2, $3::vector, $4, $5, $6, NOW())
         ON CONFLICT (id) DO UPDATE SET
           chunk_text = EXCLUDED.chunk_text,
           embedding = EXCLUDED.embedding,
           category = EXCLUDED.category,
           source = EXCLUDED.source,
           metadata = EXCLUDED.metadata,
           created_at = NOW()`,
        [item.id, item.text, vectorString, item.category, item.source, JSON.stringify(item.metadata)]
      );

      successCount++;
      process.stdout.write(`\r[Ingestion] Progress: ${successCount}/${allItems.length} chunks embedded & stored`);
      // Throttling to stay well within Gemini embedding rate limits
      await new Promise(r => setTimeout(r, 80));
    } catch (err) {
      errorCount++;
      console.error(`\n[Ingestion] Failed chunk ${item.id}: ${err.message}`);
    }
  }

  console.log(`\n\n[Ingestion] Completed. Successfully ingested: ${successCount}, Errors: ${errorCount}`);
  
  // Verify database count
  const countRes = await query('SELECT count(*)::int as total FROM knowledge_chunks');
  console.log(`[Ingestion] Total rows in knowledge_chunks table: ${countRes.rows[0]?.total}`);

  return { total: allItems.length, ingested: successCount, errors: errorCount };
}

// Execute if run directly from CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runIngestion()
    .then(() => {
      console.log('\n[Ingestion] Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n[Ingestion] Fatal error:', err);
      process.exit(1);
    });
}
