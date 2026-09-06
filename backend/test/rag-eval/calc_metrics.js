import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

import { retrieveContext } from '../../src/services/rag.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function calcMetrics() {
  const datasetPath = path.resolve(__dirname, '../../../docs/rag-eval/dataset.json');
  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  
  let mrrSum = 0;
  let hit3Count = 0;
  let hit5Count = 0;
  let evaluableCount = 0;

  for (let i = 0; i < dataset.length; i++) {
    const q = dataset[i];
    if (q.expectedRagKeywords && q.expectedRagKeywords.length > 0) {
      evaluableCount++;
      const ragResults = await retrieveContext(q.query);
      const chunks = ragResults.retrievedChunks || [];
      
      let firstMatchRank = -1;
      
      for (let rank = 0; rank < chunks.length; rank++) {
        const chunk = chunks[rank];
        const text = (chunk.chunk_text + ' ' + (chunk.metadata?.topic || '')).toLowerCase();
        
        if (q.expectedRagKeywords.some(kw => text.includes(kw.toLowerCase()))) {
          firstMatchRank = rank + 1; // 1-indexed
          break;
        }
      }

      console.log(`Q${i+1} [${q.id}]: rank = ${firstMatchRank}, retrieved = ${chunks.length}`);

      if (firstMatchRank !== -1) {
        mrrSum += (1 / firstMatchRank);
        if (firstMatchRank <= 3) hit3Count++;
        if (firstMatchRank <= 5) hit5Count++;
      }
    }
  }

  console.log('--- METRICS ---');
  console.log(`Evaluable Queries: ${evaluableCount}`);
  console.log(`Hit@3: ${hit3Count} / ${evaluableCount} = ${(hit3Count/evaluableCount).toFixed(4)}`);
  console.log(`Hit@5: ${hit5Count} / ${evaluableCount} = ${(hit5Count/evaluableCount).toFixed(4)}`);
  console.log(`MRR: ${(mrrSum / evaluableCount).toFixed(4)}`);
}

calcMetrics().catch(console.error);
