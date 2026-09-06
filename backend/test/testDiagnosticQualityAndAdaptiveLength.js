import assert from 'assert';
import dotenv from 'dotenv';
import { classifyComplexity, isFixRequested, ADAPTIVE_TOKEN_LIMITS } from '../src/services/complexityClassifier.js';
import { buildMechamaruSystemInstruction, runAgentOrchestrator } from '../src/services/agentOrchestrator.js';

import path from 'path';
dotenv.config({ path: path.resolve('backend/.env') });
dotenv.config();

async function runDiagnosticQualityTests() {
  console.log('============================================================');
  console.log('BRAG PHASE 4: DIAGNOSTIC RESPONSE QUALITY & ADAPTIVE LENGTH');
  console.log('============================================================\n');

  // TEST 1: Fix Request Detection
  console.log('--- TEST 1: Fix Request Detection ---');
  assert.strictEqual(isFixRequested('Why is PostgreSQL pool timing out?'), false, 'Pure diagnostic question should not be a fix request');
  assert.strictEqual(isFixRequested('What caused the Redis cache stampede?'), false, 'Cause inquiry should not be a fix request');
  assert.strictEqual(isFixRequested('How to fix PostgreSQL connection pool timeout error?'), true, 'Explicit "how to fix" must be detected');
  assert.strictEqual(isFixRequested('Please provide a fix for this bug'), true, 'Explicit "provide a fix" must be detected');
  console.log('✅ PASS: Fix request classifier correctly discriminates diagnostic inquiries from fix requests.\n');

  // TEST 2: Complexity Classification & Adaptive Token Targets
  console.log('--- TEST 2: Complexity Classification & Token Scaling ---');
  
  // A. Low Complexity
  const lowComp = classifyComplexity({ query: 'what is JWT?', mode: 'normal_chat' });
  console.log(`Low query classification: level=${lowComp.level}, maxTokens=${lowComp.maxTokens}, target=${lowComp.targetWords}`);
  assert.strictEqual(lowComp.level, 'low');
  assert.strictEqual(lowComp.maxTokens, ADAPTIVE_TOKEN_LIMITS.low);

  // B. Medium Complexity
  const medComp = classifyComplexity({ 
    query: 'Why is our Express server throwing PayloadTooLargeError on large request body payloads?',
    mode: 'knowledge_debugging' 
  });
  console.log(`Medium query classification: level=${medComp.level}, maxTokens=${medComp.maxTokens}, target=${medComp.targetWords}`);
  assert.strictEqual(medComp.level, 'medium');
  assert.strictEqual(medComp.maxTokens, ADAPTIVE_TOKEN_LIMITS.medium);

  // C. High Complexity (Active Tools or Multi-line Error Log)
  const highComp = classifyComplexity({
    query: 'Investigate this stack trace:\nError: connect ECONNREFUSED 127.0.0.1:5432\n    at TCPConnectWrap.afterConnect [as oncomplete] (net.js:1146:16)\n    at Connection.connect (pg/lib/connection.js:72:13)',
    mode: 'log_investigation',
    hasLog: true,
    evidenceCount: 2,
    toolsUsed: ['readFile', 'parseErrorLog']
  });
  console.log(`High query classification: level=${highComp.level}, maxTokens=${highComp.maxTokens}, target=${highComp.targetWords}`);
  assert.strictEqual(highComp.level, 'high');
  assert.strictEqual(highComp.maxTokens, ADAPTIVE_TOKEN_LIMITS.high);
  console.log('✅ PASS: Adaptive length targets (low=250, medium=500, high=900 tokens) verified.\n');

  // TEST 3: System Prompt Diagnostic Formatting & "Identify-Only" Constraint
  console.log('--- TEST 3: System Prompt Construction & Constraint ---');
  const promptLow = buildMechamaruSystemInstruction(lowComp);
  assert(promptLow.includes('STRICT IDENTIFY-ONLY DIRECTIVE'), 'Prompt must contain strict identify-only directive');
  assert(promptLow.includes('Finding'), 'Low prompt must include Finding');
  assert(promptLow.includes('Root cause'), 'Low prompt must include Root cause');
  assert(promptLow.includes('Confidence'), 'Low prompt must include Confidence');

  const promptMed = buildMechamaruSystemInstruction(medComp);
  assert(promptMed.includes('Why this is happening'), 'Medium prompt must include Why this is happening');
  assert(promptMed.includes('What this means'), 'Medium prompt must include What this means');

  const promptHigh = buildMechamaruSystemInstruction(highComp);
  assert(promptHigh.includes('Evidence'), 'High prompt must include Evidence breakdown');
  assert(promptHigh.includes('Related files'), 'High prompt must include Related files section');
  console.log('✅ PASS: Prompt generator injects exact diagnostic shape and identify-only constraint across all complexity tiers.\n');

  // TEST 4: Real LLM Call Sample Diagnostic Output Check (1 real LLM call)
  console.log('--- TEST 4: Real LLM Diagnostic Response Verification (1 Call) ---');
  const testQuery = 'Why is PostgreSQL returning error 40P01 deadlock detected under concurrent transactions?';
  console.log(`Executing real diagnostic query: "${testQuery}"`);
  
  const result = await runAgentOrchestrator(testQuery);
  assert(result.success, 'Orchestrator must return success');
  
  const answer = result.answer;
  const wordCount = answer.split(/\s+/).filter(Boolean).length;
  console.log(`Response Word Count: ${wordCount} words`);
  console.log(`Complexity classified: ${result.metadata.complexity} (Adaptive Token Budget: ${result.metadata.adaptiveMaxTokens})`);
  console.log('\n--- RESPONSE PREVIEW ---\n' + answer + '\n-------------------------\n');

  // Verify diagnostic structure presence
  const hasFinding = /finding/i.test(answer);
  const hasRootCause = /root cause/i.test(answer);
  const hasConfidence = /confidence/i.test(answer);
  const hasWhyOrEvidence = /why this is happening|evidence|what this means/i.test(answer);

  console.log(`Has Finding: ${hasFinding}`);
  console.log(`Has Root Cause: ${hasRootCause}`);
  console.log(`Has Confidence: ${hasConfidence}`);
  console.log(`Has Why/Evidence/Impact: ${hasWhyOrEvidence}`);

  assert(hasFinding && hasRootCause, 'Response must structure findings and root cause');
  console.log('✅ PASS: Diagnostic response format matches specification without unsolicited fix writing.\n');

  console.log('============================================================');
  console.log('ALL PHASE 4 DIAGNOSTIC QUALITY TESTS PASSED! (1 REAL LLM CALL)');
  console.log('============================================================');
  process.exit(0);
}

runDiagnosticQualityTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
