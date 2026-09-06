import assert from 'assert';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('backend/.env') });
dotenv.config();

// Ensure test keys exist in process.env for deterministic unit test execution
process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || 'gsk_test_mock_groq_key_123456789';
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSy_test_mock_gemini_key_123456';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-proj-test_mock_openai_key_123456';

import { buildProviderExecutionChain, resolveProviderCredentials, PROVIDER_SPECS } from '../src/providers/providerRouter.js';
import { isProviderNearLimit, PROVIDER_RATE_LIMITS } from '../src/utils/providerLimits.js';
import { sanitizeOutput, validateKeyFormat, maskKey } from '../src/utils/credentials.js';
import * as anthropicProvider from '../src/providers/anthropicProvider.js';

async function runRouterAndSecurityTests() {
  console.log('============================================================');
  console.log('BRAG PHASE 4B: PROVIDER ROUTER & BYOK EXPANSION VERIFICATION');
  console.log('============================================================\n');

  // TEST 1: Rate Limit & Capability Configuration Integrity across all 9 providers
  console.log('TEST 1: Verifying declarative rate limits and capability metadata for all 9 providers...');
  const expectedProviders = ['groq', 'gemini', 'openai', 'anthropic', 'openrouter', 'mistral', 'cerebras', 'deepseek', 'xai'];
  
  for (const prov of expectedProviders) {
    assert(PROVIDER_RATE_LIMITS[prov], `PROVIDER_RATE_LIMITS must contain ${prov}`);
    assert(typeof PROVIDER_RATE_LIMITS[prov].rpm === 'number' && PROVIDER_RATE_LIMITS[prov].rpm > 0, `${prov} must have positive RPM`);
    assert(typeof PROVIDER_RATE_LIMITS[prov].rpd === 'number' && PROVIDER_RATE_LIMITS[prov].rpd > 0, `${prov} must have positive RPD`);
    assert(typeof PROVIDER_RATE_LIMITS[prov].tpm === 'number' && PROVIDER_RATE_LIMITS[prov].tpm > 0, `${prov} must have positive TPM`);
    assert(typeof PROVIDER_RATE_LIMITS[prov].tpd === 'number' && PROVIDER_RATE_LIMITS[prov].tpd > 0, `${prov} must have positive TPD`);
    assert(typeof PROVIDER_RATE_LIMITS[prov].contextWindow === 'number' && PROVIDER_RATE_LIMITS[prov].contextWindow >= 32000, `${prov} context window must be defined`);
    assert(typeof PROVIDER_RATE_LIMITS[prov].supportsEmbeddings === 'boolean', `${prov} supportsEmbeddings must be boolean`);
    assert.strictEqual(PROVIDER_RATE_LIMITS[prov].nearLimitPercent, 0.85, `${prov} near limit threshold must be 85%`);
    assert(PROVIDER_SPECS[prov], `PROVIDER_SPECS must register ${prov}`);
  }

  assert.strictEqual(PROVIDER_RATE_LIMITS.anthropic.contextWindow, 200000, 'Anthropic context window must be 200,000');
  assert.strictEqual(PROVIDER_RATE_LIMITS.gemini.supportsEmbeddings, true, 'Gemini must support embeddings');
  assert.strictEqual(PROVIDER_RATE_LIMITS.mistral.supportsEmbeddings, true, 'Mistral must support embeddings');
  console.log('✅ PASS: All 9 providers have valid declarative rate limits and capability metadata.');

  // TEST 2: Rate Limit Threshold Detection
  console.log('\nTEST 2: Verifying near-limit detection from usage metadata across providers...');
  
  // A. Groq below limit (e.g. 5 requests/min)
  const groqSafe = await isProviderNearLimit('groq', { rpm: 5, rpd: 50, tpm: 1000, tpd: 10000 });
  assert.strictEqual(groqSafe.isNearLimit, false, 'Groq with 5 RPM should be safe');

  // B. Groq near limit (e.g. 26 requests/min >= 85% of 30)
  const groqNear = await isProviderNearLimit('groq', { rpm: 26, rpd: 50, tpm: 1000, tpd: 10000 });
  assert.strictEqual(groqNear.isNearLimit, true, 'Groq with 26 RPM must trigger near-limit');
  assert(groqNear.reason.includes('RPM limit near threshold'), 'Reason must specify RPM limit near threshold');

  // C. Anthropic near limit (e.g. 43 requests/min >= 85% of 50)
  const anthropicNear = await isProviderNearLimit('anthropic', { rpm: 43, rpd: 50, tpm: 1000, tpd: 10000 });
  assert.strictEqual(anthropicNear.isNearLimit, true, 'Anthropic with 43 RPM must trigger near-limit');
  assert(anthropicNear.reason.includes('RPM limit near threshold'), 'Reason must specify RPM limit near threshold');

  // D. Mistral near limit (e.g. 86000 TPM >= 85% of 100000)
  const mistralNear = await isProviderNearLimit('mistral', { rpm: 10, rpd: 50, tpm: 86000, tpd: 10000 });
  assert.strictEqual(mistralNear.isNearLimit, true, 'Mistral with 86000 TPM must trigger near-limit');
  assert(mistralNear.reason.includes('TPM limit near threshold'), 'Reason must specify TPM limit near threshold');
  console.log('✅ PASS: Rate limit detection active across standard and newly added providers.');

  // TEST 3: Provider Router Fallback Chain
  console.log('\nTEST 3: Verifying Provider Router fallback logic and BYOK prioritization...');

  // Scenario A: Normal usage (Groq is healthy)
  const chainNormal = await buildProviderExecutionChain({
    mockUsage: {
      groq: { rpm: 2, rpd: 20, tpm: 400, tpd: 4000 },
      gemini: { rpm: 1, rpd: 10, tpm: 200, tpd: 2000 }
    }
  });
  assert.strictEqual(chainNormal.executionChain[0].name, 'groq', 'Normal chain must start with Groq');
  console.log('✅ PASS: Scenario A (Normal) selected primary provider: Groq.');

  // Scenario B: Groq near limit -> Falls back to Gemini
  const chainGroqLimited = await buildProviderExecutionChain({
    mockUsage: {
      groq: { rpm: 28, rpd: 200, tpm: 5500, tpd: 4000 },
      gemini: { rpm: 2, rpd: 20, tpm: 400, tpd: 4000 }
    }
  });
  assert.strictEqual(chainGroqLimited.executionChain[0].name, 'gemini', 'When Groq is near limit, router must step to Gemini');
  const groqDiag = chainGroqLimited.diagnostics.find(d => d.provider === 'groq');
  assert.strictEqual(groqDiag.action, 'bypassed', 'Groq must be recorded as bypassed');
  console.log('✅ PASS: Scenario B (Groq near limit) bypassed Groq and stepped to Gemini.');

  // Scenario C: User BYOK Anthropic key provided
  const dummyAnthropicKey = 'sk-ant-test-byok-key-abcdef1234567890';
  const chainAnthropicByok = await buildProviderExecutionChain({
    userCredentials: { anthropic: dummyAnthropicKey }
  });
  assert.strictEqual(chainAnthropicByok.executionChain[0].name, 'anthropic', 'User Anthropic BYOK key must be prioritized');
  assert.strictEqual(chainAnthropicByok.executionChain[0].source, 'user', 'Provider source must be user');
  console.log('✅ PASS: Scenario C (Anthropic BYOK) prioritized user Anthropic key.');

  // Scenario D: User BYOK Mistral and xAI keys provided
  const dummyMistralKey = 'mistral-user-test-byok-key-123456789';
  const dummyXaiKey = 'xai-user-test-byok-key-9876543210';
  const chainMultiByok = await buildProviderExecutionChain({
    userCredentials: { mistral: dummyMistralKey, xai: dummyXaiKey }
  });
  assert(chainMultiByok.executionChain.some(p => p.name === 'mistral' && p.source === 'user'), 'User Mistral key must be in chain');
  assert(chainMultiByok.executionChain.some(p => p.name === 'xai' && p.source === 'user'), 'User xAI key must be in chain');
  console.log('✅ PASS: Scenario D (Multi BYOK) prioritized Mistral and xAI user keys.');

  // TEST 4: Anthropic Adapter Interface Conformance (Mocked Fetch)
  console.log('\nTEST 4: Verifying Anthropic adapter interface conformance and message translation...');
  const originalFetch = globalThis.fetch;
  try {
    let capturedBody = null;
    let capturedHeaders = null;

    globalThis.fetch = async (url, options) => {
      capturedBody = JSON.parse(options.body);
      capturedHeaders = options.headers;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'msg_12345',
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'text', text: 'Finding: Diagnostic completed.\nRoot cause: Pool timeout.' }
          ],
          usage: {
            input_tokens: 145,
            output_tokens: 62
          }
        })
      };
    };

    const anthropicResult = await anthropicProvider.generateResponse({
      messages: [
        { role: 'user', content: 'Investigate sporadic connection errors.' },
        { role: 'assistant', content: 'Checking logs.' },
        { role: 'user', content: 'Here is the trace.' }
      ],
      systemPrompt: 'You are Mechamaru.',
      tools: [
        { name: 'searchCode', description: 'Search repository', inputSchema: { type: 'object', properties: { q: { type: 'string' } } } }
      ],
      apiKey: 'sk-ant-test-mock-key-12345678',
      model: 'claude-3-5-sonnet-20241022'
    });

    assert.strictEqual(capturedBody.model, 'claude-3-5-sonnet-20241022', 'Target model must match');
    assert.strictEqual(capturedBody.system, 'You are Mechamaru.', 'System prompt must be top-level');
    assert.strictEqual(capturedHeaders['x-api-key'], 'sk-ant-test-mock-key-12345678', 'API key header must be set');
    assert.strictEqual(capturedHeaders['anthropic-version'], '2023-06-01', 'Anthropic version header must be set');
    assert.strictEqual(capturedBody.tools.length, 1, 'Tools must be passed in input_schema format');
    assert.strictEqual(capturedBody.tools[0].name, 'searchCode', 'Tool name must match');
    assert.strictEqual(anthropicResult.text, 'Finding: Diagnostic completed.\nRoot cause: Pool timeout.', 'Response text must match');
    assert.strictEqual(anthropicResult.usage.prompt_tokens, 145, 'Prompt tokens must be extracted');
    assert.strictEqual(anthropicResult.usage.completion_tokens, 62, 'Completion tokens must be extracted');
    console.log('✅ PASS: Anthropic adapter conforms to uniform interface with accurate message/tool/usage translation.');
  } finally {
    globalThis.fetch = originalFetch;
  }

  // TEST 5: Security & Multi-Provider Zero Key Leakage Verification
  console.log('\nTEST 5: Verifying BYOK sanitization across multiple providers...');
  const secretAnthropicKey = 'sk-ant-super_secret_anthropic_key_99999999';
  const secretMistralKey = 'mistral_secret_key_8888888888888';
  const leakedText = `Upstream error with Anthropic key ${secretAnthropicKey} and Mistral key ${secretMistralKey}`;
  const sanitized = sanitizeOutput(leakedText, { anthropic: secretAnthropicKey, mistral: secretMistralKey });
  assert(!sanitized.includes(secretAnthropicKey), 'Anthropic key must NEVER appear in output');
  assert(!sanitized.includes(secretMistralKey), 'Mistral key must NEVER appear in output');
  assert(sanitized.includes('[REDACTED_USER_KEY]'), 'Keys must be replaced with [REDACTED_USER_KEY]');
  console.log(`✅ PASS: Multi-key sanitization confirmed: "${sanitized}"`);

  // TEST 6: Key format validation and masking
  console.log('\nTEST 6: Verifying key format validation and masking...');
  assert.strictEqual(validateKeyFormat(''), false, 'Empty key must be rejected');
  assert.strictEqual(validateKeyFormat('short'), false, 'Key < 10 chars must be rejected');
  assert.strictEqual(validateKeyFormat('sk-ant-valid_key_with_sufficient_length'), true, 'Valid key must pass');
  assert.strictEqual(maskKey('sk-ant-1234567890abcdef'), 'sk-••••••••cdef', 'Masked key format correct');
  console.log('✅ PASS: Key validation and masking rules verified.');

  console.log('\n============================================================');
  console.log('ALL PHASE 4B UNIT TESTS PASSED SUCCESSFULLY! (0 REAL LLM CALLS)');
  console.log('============================================================');
  process.exit(0);
}

runRouterAndSecurityTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
