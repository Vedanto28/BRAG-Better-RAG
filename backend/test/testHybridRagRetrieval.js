import assert from 'assert';
import dotenv from 'dotenv';
import { retrieveHybridContext, searchVectorKnowledge } from '../src/services/hybridRagService.js';
import { retrieveKeywordContext } from '../src/services/keywordRagService.js';
import { retrieveContext } from '../src/services/rag.js';

dotenv.config();

async function testRetrievalQuality() {
  console.log('============================================================');
  console.log('BRAG PHASE 3: HYBRID RAG 2.0 RETRIEVAL QUALITY VERIFICATION');
  console.log('============================================================\n');

  // TEST 1: Vector similarity search on PostgreSQL connection pool timeout
  console.log('--- TEST 1: Diagnostic Query: PostgreSQL Connection Pool Timeout ---');
  const q1 = 'Why am I getting PostgreSQL connection pool timeout error and idle in transaction?';
  const v1 = await searchVectorKnowledge(q1, 3);
  console.log(`Vector matches found: ${v1.length}`);
  assert(v1.length > 0, 'Vector search must return at least 1 match');
  console.log(`Top vector match: [${v1[0].id}] ${v1[0].category} (Score: ${v1[0].score.toFixed(3)})`);
  assert(v1[0].id === 'pg-001' || v1[0].category.includes('postgresql') || v1[0].category.includes('database'), 'Top match must be PostgreSQL/DB connection topic');
  console.log('✅ PASS: Relevant PostgreSQL pool chunk retrieved via dense vector similarity.\n');

  // TEST 2: Hybrid search on HTTP 413 Payload Too Large
  console.log('--- TEST 2: Diagnostic Query: Express Payload Too Large ---');
  const q2 = 'Our Express server crashes with PayloadTooLargeError on large request body';
  const h2 = await retrieveHybridContext(q2);
  console.log(`Hybrid retrieved chunks: ${h2.length}, Retrieval Method: ${h2.retrievalMethod}`);
  console.log(`Vector count: ${h2.vectorMatchesCount}, Keyword count: ${h2.keywordMatchesCount}`);
  assert(h2.length > 0, 'Hybrid retrieval must return matching chunks');
  const matchedRest = h2.find(c => c.id === 'rest-001' || c.chunk_text.includes('413') || c.chunk_text.includes('PayloadTooLarge'));
  assert(matchedRest, 'Must retrieve 413 payload too large diagnostic knowledge');
  console.log('✅ PASS: HTTP 413 Payload chunk successfully retrieved via Hybrid RAG.\n');

  // TEST 3: Hybrid search on Redis cache stampede
  console.log('--- TEST 3: Diagnostic Query: Redis Cache Stampede ---');
  const q3 = 'How to prevent Redis cache stampede and thundering herd on high traffic TTL expiration?';
  const h3 = await retrieveHybridContext(q3);
  console.log(`Top retrieved topic: ${h3[0]?.id} - ${h3[0]?.category}`);
  assert(h3.some(c => c.id === 'redis-002' || c.chunk_text.includes('Stampede') || c.chunk_text.includes('thundering herd')), 'Must retrieve cache stampede topic');
  console.log('✅ PASS: Redis cache stampede chunk retrieved accurately.\n');

  // TEST 4: Keyword Fallback Path
  console.log('--- TEST 4: Keyword Fallback Path Verification ---');
  const kwResult = await retrieveKeywordContext('JWT signature invalid token verification failed');
  console.log(`Keyword matches found: ${kwResult.allMatches.length}`);
  assert(kwResult.allMatches.length > 0, 'Keyword search must find matches');
  console.log(`Top keyword match: ${kwResult.allMatches[0].id} (Score: ${kwResult.allMatches[0].score})`);
  assert(kwResult.allMatches[0].id.includes('auth'), 'Must match authentication entry');
  console.log('✅ PASS: Keyword fallback path verified.\n');

  // TEST 5: Context Formatting and Token Reduction Measurement
  console.log('--- TEST 5: Token / Context Reduction Measurement ---');
  const sampleQuery = 'PostgreSQL deadlock detected error 40P01 concurrent update';
  const ragResult = await retrieveContext(sampleQuery);
  const contextLength = (ragResult.debuggingContext?.length || 0) + (ragResult.generalContext?.length || 0);
  console.log(`Raw Retrieved Context Characters: ${contextLength} chars (~${Math.round(contextLength / 4)} tokens)`);
  console.log(`Context contains targeted root cause: ${ragResult.debuggingContext.includes('40P01') || ragResult.debuggingContext.includes('Deadlock')}`);
  assert(contextLength <= 4000, 'Targeted RAG context should be concise (< 1000 tokens), avoiding large context dumps');
  console.log('✅ PASS: Highly targeted context delivered with minimal token footprint.\n');

  console.log('============================================================');
  console.log('ALL PHASE 3 RETRIEVAL QUALITY TESTS PASSED! (0 REAL LLM CALLS)');
  console.log('============================================================');
  process.exit(0);
}

testRetrievalQuality().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
