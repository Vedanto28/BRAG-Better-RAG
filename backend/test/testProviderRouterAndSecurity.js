import assert from 'assert';
import { buildProviderExecutionChain, resolveProviderCredentials } from '../src/providers/providerRouter.js';
import { isProviderNearLimit, PROVIDER_RATE_LIMITS } from '../src/utils/providerLimits.js';
import { sanitizeOutput, validateKeyFormat, maskKey } from '../src/utils/credentials.js';

async function runRouterAndSecurityTests() {
  console.log('============================================================');
  console.log('BRAG PHASE 2: PROVIDER ROUTER & BYOK SECURITY VERIFICATION');
  console.log('============================================================\n');

  // TEST 1: Rate Limit Configuration Integrity
  console.log('TEST 1: Verifying declarative rate limits...');
  assert.strictEqual(PROVIDER_RATE_LIMITS.groq.rpm, 30, 'Groq RPM must be 30');
  assert.strictEqual(PROVIDER_RATE_LIMITS.gemini.rpm, 15, 'Gemini RPM must be 15');
  assert.strictEqual(PROVIDER_RATE_LIMITS.groq.nearLimitPercent, 0.85, 'Near limit threshold must be 85%');
  console.log('✅ PASS: Declarative rate limits properly configured.');

  // TEST 2: Rate Limit Threshold Detection
  console.log('\nTEST 2: Verifying near-limit detection from usage metadata...');
  
  // A. Groq below limit (e.g. 5 requests/min)
  const groqSafe = await isProviderNearLimit('groq', { rpm: 5, rpd: 50, tpm: 1000, tpd: 10000 });
  assert.strictEqual(groqSafe.isNearLimit, false, 'Groq with 5 RPM should be safe');

  // B. Groq near limit (e.g. 26 requests/min >= 85% of 30)
  const groqNear = await isProviderNearLimit('groq', { rpm: 26, rpd: 50, tpm: 1000, tpd: 10000 });
  assert.strictEqual(groqNear.isNearLimit, true, 'Groq with 26 RPM must trigger near-limit');
  assert(groqNear.reason.includes('RPM limit near threshold'), 'Reason must specify RPM limit near threshold');
  console.log(`✅ PASS: Rate limit detection active: "${groqNear.reason}"`);

  // TEST 3: Provider Router Chain: Groq -> Gemini -> BYOK
  console.log('\nTEST 3: Verifying Provider Router fallback logic (Groq -> Gemini -> BYOK)...');

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

  // Scenario C: Both Groq & Gemini near limit -> Falls back to BYOK
  const dummyUserKey = 'sk-user-test-byok-key-abcdef12345';
  const chainAllLimited = await buildProviderExecutionChain({
    userCredentials: { openai: dummyUserKey },
    mockUsage: {
      groq: { rpm: 29, rpd: 200, tpm: 5800, tpd: 4000 },
      gemini: { rpm: 14, rpd: 1400, tpm: 900000, tpd: 9000000 },
      openai: { rpm: 3, rpd: 200, tpm: 40000, tpd: 200000 }
    }
  });
  assert.strictEqual(chainAllLimited.executionChain[0].name, 'openai', 'When server providers are limited, user BYOK must be used');
  assert.strictEqual(chainAllLimited.executionChain[0].source, 'user', 'Provider source must be user');
  console.log('✅ PASS: Scenario C (Server providers limited) routed to User BYOK key.');

  // TEST 4: Security & Zero Key Leakage Verification
  console.log('\nTEST 4: Verifying BYOK sanitization and zero credential leakage...');
  const secretKey = 'gsk_super_secret_user_key_99999999';
  const leakedErrorText = `Upstream error with key ${secretKey}: 401 Unauthorized`;
  const sanitized = sanitizeOutput(leakedErrorText, { groq: secretKey });
  assert(!sanitized.includes(secretKey), 'Sanitized string must NEVER include the raw key');
  assert(sanitized.includes('[REDACTED_USER_KEY]'), 'Raw key must be replaced with [REDACTED_USER_KEY]');
  console.log(`✅ PASS: Sanitization confirmed: "${sanitized}"`);

  // TEST 5: Key format validation and masking
  console.log('\nTEST 5: Verifying key format validation and masking...');
  assert.strictEqual(validateKeyFormat(''), false, 'Empty key must be rejected');
  assert.strictEqual(validateKeyFormat('short'), false, 'Key < 10 chars must be rejected');
  assert.strictEqual(validateKeyFormat('valid_key_with_sufficient_length'), true, 'Valid key must pass');
  assert.strictEqual(maskKey('gsk_1234567890abcdef'), 'gsk••••••••cdef', 'Masked key format correct');
  console.log('✅ PASS: Key validation and masking rules verified.');

  console.log('\n============================================================');
  console.log('ALL PHASE 2 UNIT TESTS PASSED SUCCESSFULLY! (0 REAL LLM CALLS)');
  console.log('============================================================');
}

runRouterAndSecurityTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
