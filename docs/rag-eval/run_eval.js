import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

import { runAgentOrchestrator } from '../../backend/src/services/agentOrchestrator.js';
import { retrieveContext } from '../../backend/src/services/rag.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runEvaluation() {
  const datasetPath = path.join(__dirname, 'dataset.json');
  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

  const results = {
    total: dataset.length,
    metrics: {
      mcpTriggerAccuracy: 0,
      hitAt3: 0,
      hitAt5: 0,
      hallucinationRate: 0,
      irrelevantContextRate: 0
    },
    details: []
  };

  let mcpCorrect = 0;
  let hit3Count = 0;
  let hit5Count = 0;
  let hallucinationCount = 0;
  let irrelevantContextCount = 0;

  console.log(`Starting evaluation on ${dataset.length} queries...`);

  for (let i = 0; i < dataset.length; i++) {
    const q = dataset[i];
    console.log(`\nEvaluating [${i + 1}/${dataset.length}]: ${q.id}`);

    try {
      // 1. RAG Retrieval Evaluation
      const ragResults = await retrieveContext(q.query);
      const chunks = ragResults.retrievedChunks || [];
      
      let foundInTop3 = false;
      let foundInTop5 = false;
      
      // If there are expected keywords, check if retrieved chunks have them
      if (q.expectedRagKeywords && q.expectedRagKeywords.length > 0) {
        chunks.slice(0, 3).forEach(chunk => {
          const text = (chunk.chunk_text + ' ' + (chunk.metadata?.topic || '')).toLowerCase();
          if (q.expectedRagKeywords.some(kw => text.includes(kw.toLowerCase()))) {
            foundInTop3 = true;
          }
        });
        chunks.slice(0, 5).forEach(chunk => {
          const text = (chunk.chunk_text + ' ' + (chunk.metadata?.topic || '')).toLowerCase();
          if (q.expectedRagKeywords.some(kw => text.includes(kw.toLowerCase()))) {
            foundInTop5 = true;
          }
        });

        if (foundInTop3) hit3Count++;
        if (foundInTop5) hit5Count++;

        // Irrelevant context logic: if NO chunks matched expected keywords, but we got chunks
        if (!foundInTop5 && chunks.length > 0) {
          irrelevantContextCount++;
        }
      }

      // 2. End-to-end LLM + MCP Evaluation (budget consumption)
      const orchestratorResult = await runAgentOrchestrator(q.query, { signal: null });
      const metadata = orchestratorResult.metadata;
      const answer = orchestratorResult.answer.toLowerCase();

      const isMcpCorrect = metadata.mode === q.expectedMode;
      if (isMcpCorrect) mcpCorrect++;

      let hallucinated = false;
      if (q.expectedMode === 'knowledge_debugging' && metadata.toolsUsed.length === 0) {
        // Must not assert specific file implementation unless provided
        if (answer.includes('src/components') || answer.includes('config.js')) {
          hallucinated = true;
        }
      }
      if (hallucinated) hallucinationCount++;

      results.details.push({
        id: q.id,
        query: q.query,
        ragMethod: ragResults.retrievalMethod,
        chunksRetrieved: chunks.length,
        foundInTop3,
        foundInTop5,
        expectedMode: q.expectedMode,
        actualMode: metadata.mode,
        mcpCorrect: isMcpCorrect,
        hallucinated,
        provider: metadata.provider,
        toolsUsed: metadata.toolsUsed,
        toolCallLimitReached: metadata.toolCallLimitReached
      });

    } catch (err) {
      console.error(`Error evaluating ${q.id}:`, err);
      results.details.push({
        id: q.id,
        error: err.message
      });
    }
  }

  const ragEvaluable = dataset.filter(q => q.expectedRagKeywords && q.expectedRagKeywords.length > 0).length;
  results.metrics.hitAt3 = ragEvaluable > 0 ? (hit3Count / ragEvaluable) : 0;
  results.metrics.hitAt5 = ragEvaluable > 0 ? (hit5Count / ragEvaluable) : 0;
  results.metrics.irrelevantContextRate = ragEvaluable > 0 ? (irrelevantContextCount / ragEvaluable) : 0;
  results.metrics.mcpTriggerAccuracy = mcpCorrect / dataset.length;
  results.metrics.hallucinationRate = hallucinationCount / dataset.length;

  const resultsPath = path.join(__dirname, 'results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));

  console.log('\n--- Evaluation Complete ---');
  console.log(JSON.stringify(results.metrics, null, 2));
  console.log(`Results saved to ${resultsPath}`);
}

runEvaluation();
