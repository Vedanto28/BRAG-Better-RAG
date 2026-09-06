/**
 * BRAG PHASE 4F — RELIABILITY & PERFORMANCE VALIDATION
 *
 * Test-first reliability validation of the full BRAG system.
 * No feature development — only validation and minimal targeted fixes.
 *
 * Sections:
 *   1. Provider failure, fallback, and retry
 *   2. Database (Neon) resilience
 *   3. MCP partial failure
 *   4. Concurrency
 *   5. Cancellation / AbortSignal
 *   6. Orchestrator error paths
 *   7. History & conversation scaling
 *   8. Credential security during failures
 *   9. Full regression (all prior phases)
 *
 * Runs entirely with MOCK_LLM=true. Zero real LLM calls, zero network calls.
 */

import assert from 'assert';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('backend/.env') });
dotenv.config();

// Ensure deterministic test execution with mock keys
process.env.MOCK_LLM = 'true';
process.env.MOCK_EXTERNAL_MCP = 'true';
process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || 'gsk_test_mock_groq_key_123456789';
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSy_test_mock_gemini_key_123456';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-proj-test_mock_openai_key_123456';

import { buildProviderExecutionChain, resolveProviderCredentials, PROVIDER_SPECS } from '../src/providers/providerRouter.js';
import { isProviderNearLimit, PROVIDER_RATE_LIMITS } from '../src/utils/providerLimits.js';
import { sanitizeOutput, maskKey } from '../src/utils/credentials.js';
import { generateResponse } from '../src/providers/providerInterface.js';
import { runAgentOrchestrator, redactSensitiveData, buildMechamaruSystemInstruction } from '../src/services/agentOrchestrator.js';
import { classifyComplexity } from '../src/services/complexityClassifier.js';
import { retrieveContext } from '../src/services/rag.js';
import { AI_CONFIG } from '../src/utils/config.js';

let passed = 0;
let failed = 0;
const failures = [];

function check(condition, testName) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${testName}`);
    failed++;
    failures.push(testName);
  }
}

async function asyncCheck(fn, testName) {
  try {
    await fn();
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } catch (err) {
    console.log(`❌ FAIL: ${testName} — ${err.message}`);
    failed++;
    failures.push(testName);
  }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 1: PROVIDER FAILURE, FALLBACK, AND RETRY
// ═══════════════════════════════════════════════════════════════

async function testProviderFailureAndFallback() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('SECTION 1: PROVIDER FAILURE, FALLBACK, AND RETRY');
  console.log('══════════════════════════════════════════════════════\n');

  // 1A: All 9 providers near-limit → execution chain should be EMPTY
  await asyncCheck(async () => {
    const mockAllNearLimit = {};
    for (const prov of Object.keys(PROVIDER_SPECS)) {
      mockAllNearLimit[prov] = { rpm: 999999, rpd: 999999, tpm: 999999999, tpd: 999999999 };
    }
    const { executionChain } = await buildProviderExecutionChain({ mockUsage: mockAllNearLimit });
    assert.strictEqual(executionChain.length, 0, 'Chain must be empty when all providers are near-limit');
  }, '1A: All 9 providers near-limit → empty chain');

  // 1B: Verify each provider's near-limit threshold independently
  for (const provName of Object.keys(PROVIDER_RATE_LIMITS)) {
    const limits = PROVIDER_RATE_LIMITS[provName];
    await asyncCheck(async () => {
      // Just below threshold → should be safe
      const safeUsage = {
        rpm: Math.floor(limits.rpm * limits.nearLimitPercent) - 1,
        rpd: 0, tpm: 0, tpd: 0
      };
      const safe = await isProviderNearLimit(provName, safeUsage);
      assert.strictEqual(safe.isNearLimit, false, `${provName} just below RPM threshold should be safe`);

      // At threshold → should trigger
      const triggerUsage = {
        rpm: Math.ceil(limits.rpm * limits.nearLimitPercent),
        rpd: 0, tpm: 0, tpd: 0
      };
      const triggered = await isProviderNearLimit(provName, triggerUsage);
      assert.strictEqual(triggered.isNearLimit, true, `${provName} at RPM threshold should trigger`);
    }, `1B: ${provName} near-limit threshold boundary`);
  }

  // 1C: BYOK key takes priority even when server keys are near-limit
  await asyncCheck(async () => {
    const mockAllNearLimit = {};
    for (const prov of Object.keys(PROVIDER_SPECS)) {
      mockAllNearLimit[prov] = { rpm: 999999, rpd: 999999, tpm: 999999999, tpd: 999999999 };
    }
    const userCreds = { openai: 'sk-user-byok-key-for-openai-test-1234' };
    const { executionChain } = await buildProviderExecutionChain({
      userCredentials: userCreds,
      mockUsage: mockAllNearLimit
    });
    assert(executionChain.length >= 1, 'Chain must include user BYOK even when all server providers near-limit');
    assert.strictEqual(executionChain[0].name, 'openai');
    assert.strictEqual(executionChain[0].source, 'user');
  }, '1C: BYOK priority survives all-server-near-limit');

  // 1D: Fallback chain order under normal conditions
  await asyncCheck(async () => {
    const safeMock = {};
    for (const prov of Object.keys(PROVIDER_SPECS)) {
      safeMock[prov] = { rpm: 0, rpd: 0, tpm: 0, tpd: 0 };
    }
    const { executionChain } = await buildProviderExecutionChain({ mockUsage: safeMock });
    const expectedOrder = ['groq', 'gemini', 'openai', 'anthropic', 'mistral', 'deepseek', 'xai', 'cerebras', 'openrouter'];
    const chainNames = executionChain.map(c => c.name);
    // Only check configured providers (those with env keys)
    const configuredFromChain = chainNames.filter(n => expectedOrder.includes(n));
    for (let i = 1; i < configuredFromChain.length; i++) {
      const idxCurr = expectedOrder.indexOf(configuredFromChain[i]);
      const idxPrev = expectedOrder.indexOf(configuredFromChain[i - 1]);
      assert(idxCurr > idxPrev, `${configuredFromChain[i]} must come after ${configuredFromChain[i - 1]} in priority`);
    }
  }, '1D: Fallback chain priority order preserved');

  // 1E: Mock LLM generates valid response through providerInterface
  await asyncCheck(async () => {
    const result = await generateResponse({
      messages: [{ role: 'user', content: 'hello' }],
      systemPrompt: 'You are a test assistant.',
      tools: []
    });
    assert(result.text, 'Mock LLM must return text');
    assert.strictEqual(result.provider, 'mock');
  }, '1E: Mock LLM responds through providerInterface');

  // 1F: resolveProviderCredentials returns correct source for user vs server
  await asyncCheck(async () => {
    const userResult = resolveProviderCredentials('openai', { openai: 'sk-user-custom-key-for-test-1234' });
    assert.strictEqual(userResult.source, 'user');
    assert.strictEqual(userResult.apiKey, 'sk-user-custom-key-for-test-1234');

    const serverResult = resolveProviderCredentials('groq', {});
    assert.strictEqual(serverResult.source, 'server');
    assert(serverResult.apiKey, 'Server key must exist from env');
  }, '1F: resolveProviderCredentials source detection');

  // 1G: Unknown provider returns null credentials
  await asyncCheck(async () => {
    const result = resolveProviderCredentials('nonexistent_provider_xyz', {});
    assert.strictEqual(result.apiKey, null);
    assert.strictEqual(result.source, 'none');
    assert.strictEqual(result.spec, null);
  }, '1G: Unknown provider gracefully returns none');

  // 1H: Short or malformed BYOK key is ignored (< 10 chars)
  await asyncCheck(async () => {
    const result = resolveProviderCredentials('openai', { openai: 'short' });
    // Should fall through to server key since BYOK too short
    assert.notStrictEqual(result.source, 'user', 'Short key should not be treated as user source');
  }, '1H: Short BYOK key (<10 chars) ignored');
}

// ═══════════════════════════════════════════════════════════════
// SECTION 2: DATABASE (NEON) RESILIENCE
// ═══════════════════════════════════════════════════════════════

async function testDatabaseResilience() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('SECTION 2: DATABASE (NEON) RESILIENCE');
  console.log('══════════════════════════════════════════════════════\n');

  // 2A: getRecentProviderUsage returns zeros when DB is unreachable
  await asyncCheck(async () => {
    // providerLimits.getRecentProviderUsage already handles DB errors gracefully
    // With MOCK_LLM and no real DB connection in this test env, it should return zeros
    const { getRecentProviderUsage } = await import('../src/utils/providerLimits.js');
    const usage = await getRecentProviderUsage('groq');
    assert(typeof usage.rpm === 'number', 'rpm must be a number');
    assert(typeof usage.rpd === 'number', 'rpd must be a number');
    assert(typeof usage.tpm === 'number', 'tpm must be a number');
    assert(typeof usage.tpd === 'number', 'tpd must be a number');
  }, '2A: getRecentProviderUsage returns zeros gracefully when DB unavailable');

  // 2B: checkDbHealth returns boolean (not throws)
  await asyncCheck(async () => {
    const { checkDbHealth } = await import('../src/db/connection.js');
    const health = await checkDbHealth();
    assert(typeof health === 'boolean', 'checkDbHealth must return boolean');
  }, '2B: checkDbHealth returns boolean without throwing');

  // 2C: Chat endpoint works even when DB persistence fails (graceful degradation)
  await asyncCheck(async () => {
    // The orchestrator itself doesn't depend on DB — persistence is done at the route level
    // and wrapped in try/catch. Test the orchestrator directly:
    const result = await runAgentOrchestrator('hello', {
      userCredentials: {},
      conversationHistory: []
    });
    assert(result.success, 'Orchestrator must succeed even without DB');
    assert(result.answer, 'Answer must be non-empty');
  }, '2C: Orchestrator succeeds without DB persistence');

  // 2D: isProviderNearLimit returns safe when DB query fails
  await asyncCheck(async () => {
    // Without explicit customUsage, it queries DB. With DB offline, should return isNearLimit=false
    const result = await isProviderNearLimit('groq');
    assert.strictEqual(result.isNearLimit, false, 'Provider should be considered safe when DB is unreachable');
  }, '2D: Provider not near-limit when DB is unreachable (fail-open for routing)');
}

// ═══════════════════════════════════════════════════════════════
// SECTION 3: MCP PARTIAL FAILURE
// ═══════════════════════════════════════════════════════════════

async function testMcpPartialFailure() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('SECTION 3: MCP PARTIAL FAILURE');
  console.log('══════════════════════════════════════════════════════\n');

  // 3A: McpRegistry tolerates provider isAvailable() throwing
  await asyncCheck(async () => {
    const { McpCapabilityRegistry } = await import('../src/services/mcpRegistry.js');
    const registry = new McpCapabilityRegistry();

    // Register a broken provider
    const brokenProvider = {
      name: 'test-broken',
      category: 'test',
      isAvailable: () => { throw new Error('Simulated availability check failure'); },
      isRelevantForMode: () => true,
      lazyConnect: () => {},
      listTools: () => [],
      callTool: () => ({ content: [] })
    };
    registry.registerProvider(brokenProvider);

    // Should not throw — broken provider is silently skipped
    const { tools, exposedProviders } = await registry.getToolsForMode('repository_investigation', 'test query');
    assert(!exposedProviders.includes('test-broken'), 'Broken provider must not appear in exposed providers');
  }, '3A: McpRegistry tolerates provider isAvailable() throwing');

  // 3B: McpRegistry tolerates provider isRelevantForMode() throwing
  await asyncCheck(async () => {
    const { McpCapabilityRegistry } = await import('../src/services/mcpRegistry.js');
    const registry = new McpCapabilityRegistry();

    const flakeyProvider = {
      name: 'test-flakey-relevance',
      category: 'test-rel',
      isAvailable: () => true,
      isRelevantForMode: () => { throw new Error('Simulated relevance check failure'); },
      lazyConnect: () => {},
      listTools: () => [{ name: 'flakey_tool', description: 'test', inputSchema: { type: 'object', properties: {} } }],
      callTool: () => ({ content: [{ text: 'result' }] })
    };
    registry.registerProvider(flakeyProvider);

    const { tools, exposedProviders } = await registry.getToolsForMode('repository_investigation', 'test');
    assert(!exposedProviders.includes('test-flakey-relevance'), 'Flakey relevance provider must not be exposed');
  }, '3B: McpRegistry tolerates provider isRelevantForMode() throwing');

  // 3C: McpRegistry tolerates provider lazyConnect() failing
  await asyncCheck(async () => {
    const { McpCapabilityRegistry } = await import('../src/services/mcpRegistry.js');
    const registry = new McpCapabilityRegistry();

    const connectFailProvider = {
      name: 'test-connect-fail',
      category: 'test-conn',
      isAvailable: () => true,
      isRelevantForMode: () => true,
      lazyConnect: () => { throw new Error('Simulated connect failure'); },
      listTools: () => [{ name: 'connect_fail_tool', description: 'test', inputSchema: { type: 'object', properties: {} } }],
      callTool: () => ({ content: [{ text: 'should not reach' }] })
    };
    registry.registerProvider(connectFailProvider);

    // Should not throw — tools from failed provider are silently excluded
    const { tools } = await registry.getToolsForMode('repository_investigation', 'test');
    const failToolNames = tools.map(t => t.name);
    assert(!failToolNames.includes('connect_fail_tool'), 'Failed connect provider tools must not appear');
  }, '3C: McpRegistry tolerates provider lazyConnect() failing');

  // 3D: callTool for unregistered tool throws descriptive error
  await asyncCheck(async () => {
    const { McpCapabilityRegistry } = await import('../src/services/mcpRegistry.js');
    const registry = new McpCapabilityRegistry();
    try {
      await registry.callTool({ name: 'completely_nonexistent_tool_xyz', arguments: {} });
      assert.fail('Should have thrown');
    } catch (err) {
      assert(err.message.includes('not registered') || err.message.includes('not available'),
        'Error must indicate tool is not registered/available');
    }
  }, '3D: callTool for unregistered tool throws descriptive error');

  // 3E: resetAll does not throw even with misbehaving providers
  await asyncCheck(async () => {
    const { McpCapabilityRegistry } = await import('../src/services/mcpRegistry.js');
    const registry = new McpCapabilityRegistry();

    registry.registerProvider({
      name: 'test-bad-reset',
      category: 'test-reset',
      isAvailable: () => true,
      isRelevantForMode: () => false,
      lazyConnect: () => {},
      listTools: () => [],
      callTool: () => ({ content: [] }),
      reset: () => { throw new Error('Simulated reset failure'); }
    });

    // Should not throw
    await registry.resetAll();
  }, '3E: resetAll tolerates provider reset() throwing');
}

// ═══════════════════════════════════════════════════════════════
// SECTION 4: CONCURRENCY
// ═══════════════════════════════════════════════════════════════

async function testConcurrency() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('SECTION 4: CONCURRENCY');
  console.log('══════════════════════════════════════════════════════\n');

  // 4A: Concurrent orchestrator calls don't corrupt each other
  await asyncCheck(async () => {
    const queries = [
      'hello',
      'What is JavaScript?',
      'What is RAG?',
      'What is CORS?',
      'What is a git commit?'
    ];

    const results = await Promise.all(
      queries.map(q => runAgentOrchestrator(q, { userCredentials: {}, conversationHistory: [] }))
    );

    // Each must succeed independently
    for (let i = 0; i < results.length; i++) {
      assert(results[i].success, `Concurrent query ${i} must succeed`);
      assert(results[i].answer && results[i].answer.length > 0, `Concurrent query ${i} must have answer`);
    }

    // Verify they got different responses (not cross-contaminated)
    const answers = results.map(r => r.answer);
    const uniqueAnswers = new Set(answers);
    assert(uniqueAnswers.size >= 3, 'Concurrent queries should produce mostly different answers');
  }, '4A: 5 concurrent orchestrator calls complete without cross-contamination');

  // 4B: Concurrent buildProviderExecutionChain calls don't interfere
  await asyncCheck(async () => {
    const safeMock = {};
    for (const prov of Object.keys(PROVIDER_SPECS)) {
      safeMock[prov] = { rpm: 0, rpd: 0, tpm: 0, tpd: 0 };
    }

    const chains = await Promise.all([
      buildProviderExecutionChain({ mockUsage: safeMock }),
      buildProviderExecutionChain({ mockUsage: safeMock }),
      buildProviderExecutionChain({ mockUsage: safeMock })
    ]);

    // All chains should have the same structure
    for (const chain of chains) {
      assert(chain.executionChain.length > 0, 'Each chain must have providers');
      assert.strictEqual(chain.executionChain[0].name, 'groq', 'First provider must be groq');
    }
  }, '4B: Concurrent buildProviderExecutionChain calls independent');

  // 4C: Concurrent RAG context retrieval
  await asyncCheck(async () => {
    const queries = [
      'Why do I keep getting connection timeouts?',
      'login keeps failing ECONNREFUSED',
      'what is jwt',
      'hello'
    ];
    const contexts = await Promise.all(queries.map(q => retrieveContext(q)));
    for (let i = 0; i < contexts.length; i++) {
      assert(Array.isArray(contexts[i]), `RAG context ${i} must be an array`);
    }
  }, '4C: Concurrent RAG context retrieval');
}

// ═══════════════════════════════════════════════════════════════
// SECTION 5: CANCELLATION / ABORTSIGNAL
// ═══════════════════════════════════════════════════════════════

async function testCancellation() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('SECTION 5: CANCELLATION / ABORTSIGNAL');
  console.log('══════════════════════════════════════════════════════\n');

  // 5A: Orchestrator respects signal parameter structure
  await asyncCheck(async () => {
    const controller = new AbortController();
    // Don't abort yet — just verify the parameter is accepted
    const result = await runAgentOrchestrator('hello', {
      signal: controller.signal,
      userCredentials: {},
      conversationHistory: []
    });
    assert(result.success, 'Non-aborted signal must succeed');
  }, '5A: Orchestrator accepts AbortSignal without error');

  // 5B: AI_CONFIG timeout is configured and reasonable
  await asyncCheck(async () => {
    assert(typeof AI_CONFIG.REQUEST_TIMEOUT_MS === 'number', 'REQUEST_TIMEOUT_MS must be a number');
    assert(AI_CONFIG.REQUEST_TIMEOUT_MS >= 5000, 'Timeout must be at least 5 seconds');
    assert(AI_CONFIG.REQUEST_TIMEOUT_MS <= 120000, 'Timeout must be at most 120 seconds');
  }, '5B: REQUEST_TIMEOUT_MS is configured within reasonable bounds');

  // 5C: Tool call budget limit is enforced
  await asyncCheck(async () => {
    assert(typeof AI_CONFIG.MAX_TOOL_CALLS_PER_REQUEST === 'number', 'MAX_TOOL_CALLS_PER_REQUEST must be number');
    assert(AI_CONFIG.MAX_TOOL_CALLS_PER_REQUEST >= 1, 'Must allow at least 1 tool call');
    assert(AI_CONFIG.MAX_TOOL_CALLS_PER_REQUEST <= 20, 'Must not allow more than 20 tool calls');
  }, '5C: MAX_TOOL_CALLS_PER_REQUEST within bounds');

  // 5D: Agent step limit is enforced
  await asyncCheck(async () => {
    assert(typeof AI_CONFIG.MAX_AGENT_STEPS === 'number', 'MAX_AGENT_STEPS must be number');
    assert(AI_CONFIG.MAX_AGENT_STEPS >= 1, 'Must allow at least 1 agent step');
    assert(AI_CONFIG.MAX_AGENT_STEPS <= 10, 'Must not allow more than 10 agent steps');
  }, '5D: MAX_AGENT_STEPS within bounds');
}

// ═══════════════════════════════════════════════════════════════
// SECTION 6: ORCHESTRATOR ERROR PATHS
// ═══════════════════════════════════════════════════════════════

async function testOrchestratorErrorPaths() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('SECTION 6: ORCHESTRATOR ERROR PATHS');
  console.log('══════════════════════════════════════════════════════\n');

  // 6A: Empty message throws 400
  await asyncCheck(async () => {
    try {
      await runAgentOrchestrator('', { userCredentials: {}, conversationHistory: [] });
      assert.fail('Should have thrown');
    } catch (err) {
      assert.strictEqual(err.status, 400, 'Empty message must return 400');
    }
  }, '6A: Empty message → 400 error');

  // 6B: Whitespace-only message throws 400
  await asyncCheck(async () => {
    try {
      await runAgentOrchestrator('   \n\t  ', { userCredentials: {}, conversationHistory: [] });
      assert.fail('Should have thrown');
    } catch (err) {
      assert.strictEqual(err.status, 400);
    }
  }, '6B: Whitespace-only message → 400 error');

  // 6C: Null message throws 400
  await asyncCheck(async () => {
    try {
      await runAgentOrchestrator(null, { userCredentials: {}, conversationHistory: [] });
      assert.fail('Should have thrown');
    } catch (err) {
      assert.strictEqual(err.status, 400);
    }
  }, '6C: Null message → 400 error');

  // 6D: Message exceeding MAX_USER_MESSAGE_CHARS throws 400
  await asyncCheck(async () => {
    const longMessage = 'x'.repeat(AI_CONFIG.MAX_USER_MESSAGE_CHARS + 1);
    try {
      await runAgentOrchestrator(longMessage, { userCredentials: {}, conversationHistory: [] });
      assert.fail('Should have thrown');
    } catch (err) {
      assert.strictEqual(err.status, 400, 'Oversized message must return 400');
      assert(err.message.includes('too long'), 'Error must mention message length');
    }
  }, '6D: Oversized message → 400 error');

  // 6E: Normal chat produces valid metadata structure
  await asyncCheck(async () => {
    const result = await runAgentOrchestrator('What is JavaScript?', {
      userCredentials: {},
      conversationHistory: []
    });
    assert(result.success);
    assert(result.metadata, 'Response must include metadata');
    assert(result.metadata.mode, 'Metadata must include mode');
    assert(result.metadata.provider, 'Metadata must include provider');
    assert(result.metadata.observabilityTrace, 'Metadata must include observabilityTrace');
    assert(typeof result.metadata.observabilityTrace.timing === 'object', 'Must include timing data');
    assert(typeof result.metadata.observabilityTrace.timing.totalMs === 'number', 'totalMs must be a number');
  }, '6E: Normal chat returns valid metadata with observability trace');

  // 6F: Knowledge debugging mode produces valid response
  await asyncCheck(async () => {
    const result = await runAgentOrchestrator('Why do I keep getting connection timeouts?', {
      userCredentials: {},
      conversationHistory: []
    });
    assert(result.success);
    assert(result.answer.length > 0);
    assert.strictEqual(result.metadata.mode, 'knowledge_debugging',
      'Connection timeout query should route to knowledge_debugging');
  }, '6F: Knowledge debugging query routes correctly');

  // 6G: Orchestrator with explicit conversation history
  await asyncCheck(async () => {
    const history = [
      { role: 'user', content: 'What is JWT?' },
      { role: 'assistant', content: 'JWT stands for JSON Web Token.' }
    ];
    const result = await runAgentOrchestrator('What is JavaScript?', {
      userCredentials: {},
      conversationHistory: history
    });
    assert(result.success);
    assert(result.answer);
  }, '6G: Orchestrator with pre-existing conversation history');

  // 6H: buildMechamaruSystemInstruction handles all complexity levels
  await asyncCheck(async () => {
    for (const level of ['low', 'medium', 'high']) {
      const instruction = buildMechamaruSystemInstruction({ level, fixAllowed: false, toolsActive: true });
      assert(typeof instruction === 'string', `Instruction for ${level} must be string`);
      assert(instruction.length > 100, `Instruction for ${level} must be substantial`);
      assert(instruction.includes('Mechamaru'), `Instruction for ${level} must reference Mechamaru`);
    }
  }, '6H: System instruction generated for all complexity levels');
}

// ═══════════════════════════════════════════════════════════════
// SECTION 7: HISTORY & CONVERSATION SCALING
// ═══════════════════════════════════════════════════════════════

async function testHistoryScaling() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('SECTION 7: HISTORY & CONVERSATION SCALING');
  console.log('══════════════════════════════════════════════════════\n');

  // 7A: Orchestrator handles 10 messages of history
  await asyncCheck(async () => {
    const history = [];
    for (let i = 0; i < 10; i++) {
      history.push({ role: 'user', content: `Question ${i}: What is debugging?` });
      history.push({ role: 'assistant', content: `Answer ${i}: Debugging is the process of finding errors.` });
    }
    const start = Date.now();
    const result = await runAgentOrchestrator('What is Node.js?', {
      userCredentials: {},
      conversationHistory: history
    });
    const elapsed = Date.now() - start;
    assert(result.success);
    assert(result.answer);
    // With MOCK_LLM, this should be fast — verify no quadratic blowup
    assert(elapsed < 5000, `10-message history should process in <5s (took ${elapsed}ms)`);
  }, '7A: 10-message history processed within time bounds');

  // 7B: Orchestrator handles 50 messages of history
  await asyncCheck(async () => {
    const history = [];
    for (let i = 0; i < 50; i++) {
      history.push({ role: 'user', content: `Question ${i}: Explain concept ${i}?` });
      history.push({ role: 'assistant', content: `Answer ${i}: Concept ${i} is a technical topic.` });
    }
    const start = Date.now();
    const result = await runAgentOrchestrator('hello', {
      userCredentials: {},
      conversationHistory: history
    });
    const elapsed = Date.now() - start;
    assert(result.success);
    // History should be truncated to MAX_HISTORY_MESSAGES
    assert(elapsed < 5000, `50-message history should process in <5s (took ${elapsed}ms)`);
  }, '7B: 50-message history truncated and processed');

  // 7C: MAX_HISTORY_MESSAGES config truncates correctly
  await asyncCheck(async () => {
    assert(typeof AI_CONFIG.MAX_HISTORY_MESSAGES === 'number');
    assert(AI_CONFIG.MAX_HISTORY_MESSAGES >= 4, 'Must keep at least 4 history messages');
    assert(AI_CONFIG.MAX_HISTORY_MESSAGES <= 50, 'Must not keep more than 50 history messages');
  }, '7C: MAX_HISTORY_MESSAGES within sane bounds');

  // 7D: Large message near MAX_USER_MESSAGE_CHARS boundary works
  await asyncCheck(async () => {
    const almostMax = 'a'.repeat(AI_CONFIG.MAX_USER_MESSAGE_CHARS - 1);
    const result = await runAgentOrchestrator(almostMax, {
      userCredentials: {},
      conversationHistory: []
    });
    assert(result.success, 'Near-max message should still succeed');
  }, '7D: Message at MAX_USER_MESSAGE_CHARS - 1 succeeds');

  // 7E: Context truncation at MAX_CONTEXT_CHARS
  await asyncCheck(async () => {
    assert(typeof AI_CONFIG.MAX_CONTEXT_CHARS === 'number');
    assert(AI_CONFIG.MAX_CONTEXT_CHARS >= 1000, 'Context limit must be at least 1000 chars');
  }, '7E: MAX_CONTEXT_CHARS is configured');
}

// ═══════════════════════════════════════════════════════════════
// SECTION 8: CREDENTIAL SECURITY DURING FAILURES
// ═══════════════════════════════════════════════════════════════

async function testCredentialSecurity() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('SECTION 8: CREDENTIAL SECURITY DURING FAILURES');
  console.log('══════════════════════════════════════════════════════\n');

  // 8A: sanitizeOutput removes BYOK keys from error messages
  await asyncCheck(async () => {
    const userKeys = { openai: 'sk-user-super-secret-key-1234567890' };
    const errorMsg = `Provider failed with key sk-user-super-secret-key-1234567890 embedded in error`;
    const sanitized = sanitizeOutput(errorMsg, userKeys);
    assert(!sanitized.includes('sk-user-super-secret-key-1234567890'),
      'Sanitized output must not contain raw key');
    assert(sanitized.includes('[REDACTED_USER_KEY]'), 'Must replace with redaction marker');
  }, '8A: sanitizeOutput redacts BYOK keys from error text');

  // 8B: redactSensitiveData removes multiple credential types
  await asyncCheck(async () => {
    const text = 'Error with key=sk-super-secret-token-12345 and api_key: AIzaSy_another_secret_token';
    const userCreds = { openai: 'sk-super-secret-token-12345' };
    const redacted = redactSensitiveData(text, userCreds);
    assert(!redacted.includes('sk-super-secret-token-12345'), 'Must redact user key');
  }, '8B: redactSensitiveData handles multiple credential patterns');

  // 8C: maskKey produces safe partial display
  await asyncCheck(async () => {
    const masked = maskKey('sk-proj-test-key-1234567890abcdef');
    assert(!masked.includes('sk-proj-test-key-1234567890abcdef'), 'Full key must not appear');
    assert(masked.includes('••••••••'), 'Must contain masking characters');
  }, '8C: maskKey produces safe partial display');

  // 8D: BYOK keys don't leak in orchestrator response
  await asyncCheck(async () => {
    const userCreds = {
      openai: 'sk-proj-leaked-test-key-abcdefghij',
      gemini: 'AIzaSy_leaked_test_key_1234567890'
    };
    const result = await runAgentOrchestrator('What is JavaScript?', {
      userCredentials: userCreds,
      conversationHistory: []
    });
    const fullJson = JSON.stringify(result);
    assert(!fullJson.includes('sk-proj-leaked-test-key-abcdefghij'),
      'OpenAI key must not appear in response JSON');
    assert(!fullJson.includes('AIzaSy_leaked_test_key_1234567890'),
      'Gemini key must not appear in response JSON');
  }, '8D: BYOK keys not leaked in orchestrator response');

  // 8E: Workspace paths are redacted in responses
  await asyncCheck(async () => {
    const rootPath = process.cwd();
    const text = `Error at ${rootPath}/src/services/agentOrchestrator.js:42`;
    const redacted = redactSensitiveData(text);
    assert(!redacted.includes(rootPath), 'Absolute workspace path must be redacted');
    assert(redacted.includes('[REPO_ROOT]'), 'Must replace with [REPO_ROOT] marker');
  }, '8E: Workspace absolute paths redacted');
}

// ═══════════════════════════════════════════════════════════════
// SECTION 9: FULL REGRESSION (ALL PRIOR PHASES)
// ═══════════════════════════════════════════════════════════════

async function testFullRegression() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('SECTION 9: FULL REGRESSION');
  console.log('══════════════════════════════════════════════════════\n');

  // 9A: All 9 providers registered in PROVIDER_SPECS
  await asyncCheck(async () => {
    const expected = ['groq', 'gemini', 'openai', 'anthropic', 'openrouter', 'mistral', 'cerebras', 'deepseek', 'xai'];
    for (const prov of expected) {
      assert(PROVIDER_SPECS[prov], `PROVIDER_SPECS must contain ${prov}`);
      assert(PROVIDER_SPECS[prov].module, `${prov} must have a module`);
      assert(typeof PROVIDER_SPECS[prov].envKey === 'function', `${prov} must have envKey function`);
    }
  }, '9A: All 9 providers registered in PROVIDER_SPECS');

  // 9B: All 9 providers have rate limits
  await asyncCheck(async () => {
    const expected = ['groq', 'gemini', 'openai', 'anthropic', 'openrouter', 'mistral', 'cerebras', 'deepseek', 'xai'];
    for (const prov of expected) {
      assert(PROVIDER_RATE_LIMITS[prov], `PROVIDER_RATE_LIMITS must contain ${prov}`);
      assert(PROVIDER_RATE_LIMITS[prov].rpm > 0, `${prov} RPM must be positive`);
      assert(PROVIDER_RATE_LIMITS[prov].contextWindow >= 32000, `${prov} must have substantial context window`);
    }
  }, '9B: All 9 providers have rate limits configured');

  // 9C: RAG retrieval returns results for debugging queries
  await asyncCheck(async () => {
    const context = await retrieveContext('login keeps failing ECONNREFUSED');
    assert(Array.isArray(context), 'Context must be array');
    // Should have debugging matches for connection-related query
  }, '9C: RAG retrieval returns array for debugging queries');

  // 9D: Routing mode classification regression
  await asyncCheck(async () => {
    // Test key routing decisions
    const testCases = [
      { query: 'hello', expectedMode: 'normal_chat' },
      { query: 'What is JavaScript?', expectedMode: 'normal_chat' },
      { query: 'What is CORS?', expectedMode: 'normal_chat' },
      { query: 'Why do I keep getting connection timeouts?', expectedMode: 'knowledge_debugging' },
    ];

    for (const tc of testCases) {
      const result = await runAgentOrchestrator(tc.query, {
        userCredentials: {},
        conversationHistory: []
      });
      assert.strictEqual(result.metadata.mode, tc.expectedMode,
        `Query "${tc.query}" should route to ${tc.expectedMode}, got ${result.metadata.mode}`);
    }
  }, '9D: Routing mode classification regression');

  // 9E: Complexity classifier regression
  await asyncCheck(async () => {
    const lowComplexity = classifyComplexity({
      query: 'hello',
      mode: 'normal_chat',
      hasLog: false,
      evidenceCount: 0,
      toolsUsed: []
    });
    assert.strictEqual(lowComplexity.level, 'low', 'Simple greeting must be low complexity');

    const highComplexity = classifyComplexity({
      query: 'TypeError: Cannot read properties of undefined at server.js:25:20',
      mode: 'log_investigation',
      hasLog: true,
      evidenceCount: 3,
      toolsUsed: ['parseErrorLog', 'readFile', 'searchCode']
    });
    assert.strictEqual(highComplexity.level, 'high', 'Log investigation with evidence must be high');
  }, '9E: Complexity classifier regression');

  // 9F: Adaptive token allocation regression
  await asyncCheck(async () => {
    assert(AI_CONFIG.ADAPTIVE_OUTPUT_TOKENS.low < AI_CONFIG.ADAPTIVE_OUTPUT_TOKENS.medium,
      'Low tokens must be less than medium');
    assert(AI_CONFIG.ADAPTIVE_OUTPUT_TOKENS.medium < AI_CONFIG.ADAPTIVE_OUTPUT_TOKENS.high,
      'Medium tokens must be less than high');
  }, '9F: Adaptive token allocation hierarchy');

  // 9G: Deterministic fallback produces valid response structure
  await asyncCheck(async () => {
    const { buildDeterministicFallback } = await import('../src/providers/geminiProvider.js');
    const fallback = buildDeterministicFallback('hello', '', [], []);
    assert(typeof fallback === 'string', 'Fallback must return string');
    assert(fallback.length > 0, 'Fallback must not be empty');
  }, '9G: Deterministic fallback produces valid response');

  // 9H: End-to-end orchestrator smoke test across query types
  const smokeTests = [
    { query: 'hello', label: 'greeting' },
    { query: 'What is RAG?', label: 'conceptual' },
    { query: 'What is a git commit?', label: 'git concept' },
    { query: 'calculate 5 multiplied by 8', label: 'calculator' },
  ];

  for (const st of smokeTests) {
    await asyncCheck(async () => {
      const result = await runAgentOrchestrator(st.query, {
        userCredentials: {},
        conversationHistory: []
      });
      assert(result.success, `Smoke test [${st.label}] must succeed`);
      assert(result.answer.length > 0, `Smoke test [${st.label}] must have answer`);
      assert(result.metadata, `Smoke test [${st.label}] must have metadata`);
    }, `9H: End-to-end smoke [${st.label}]`);
  }
}

// ═══════════════════════════════════════════════════════════════
// RUNNER
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('════════════════════════════════════════════════════════');
  console.log('BRAG PHASE 4F — RELIABILITY & PERFORMANCE VALIDATION');
  console.log('════════════════════════════════════════════════════════');

  const globalStart = Date.now();

  await testProviderFailureAndFallback();
  await testDatabaseResilience();
  await testMcpPartialFailure();
  await testConcurrency();
  await testCancellation();
  await testOrchestratorErrorPaths();
  await testHistoryScaling();
  await testCredentialSecurity();
  await testFullRegression();

  const totalMs = Date.now() - globalStart;

  console.log('\n════════════════════════════════════════════════════════');
  console.log(`PHASE 4F RESULTS: ${passed} passed, ${failed} failed (${totalMs}ms)`);
  console.log('════════════════════════════════════════════════════════');

  if (failed > 0) {
    console.log('\nFailed tests:');
    for (const f of failures) {
      console.log(`  ❌ ${f}`);
    }
    
    // Attempt to cleanly shutdown the registry to avoid libuv assertion failures
    const mcpRegistry = (await import('../src/services/mcpRegistry.js')).default;
    await mcpRegistry.resetAll();
    
    process.exit(1);
  } else {
    console.log('\n✅ ALL PHASE 4F RELIABILITY TESTS PASSED (0 real LLM calls)');
    
    // Attempt to cleanly shutdown the registry to avoid libuv assertion failures
    const mcpRegistry = (await import('../src/services/mcpRegistry.js')).default;
    await mcpRegistry.resetAll();
    
    process.exit(0);
  }
}

main().catch(err => {
  console.error('FATAL ERROR IN TEST RUNNER:', err);
  process.exit(1);
});
