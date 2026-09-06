process.env.NODE_ENV = 'test';
process.env.MOCK_LLM = 'true';
import assert from 'node:assert';
import http from 'node:http';
import app from '../server.js';
import { query } from '../src/db/connection.js';
import auth from '../src/auth/auth.js';
import {
  findOrCreateInvestigation,
  getInvestigation,
  getInvestigationMessages,
  getInvestigationEvidence,
  updateInvestigationStatus
} from '../src/db/investigationRepository.js';

let server;
let baseUrl;

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      if (typeof options.body === 'object') {
        req.write(JSON.stringify(options.body));
      } else {
        req.write(options.body);
      }
    }
    req.end();
  });
}

async function runThreadingTests() {
  console.log('============================================================');
  console.log('BRAG PHASE 4C: INVESTIGATION WORKSPACE & THREADING TESTS');
  console.log('============================================================\n');

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      console.log(`[Test Server] Running on ${baseUrl}`);
      resolve();
    });
  });

  const uniqueSuffix = Date.now();
  const emailA = `investigator-alpha-${uniqueSuffix}@brag.test`;
  const emailB = `investigator-beta-${uniqueSuffix}@brag.test`;
  let userAId, userBId, userACookie, userBCookie;

  try {
    // 1. Setup Test Users
    console.log('--- SETUP: Creating Test Users in Neon PostgreSQL ---');
    const resA = await auth.api.signUpEmail({
      body: { email: emailA, password: 'Password123!', name: 'User Alpha' },
      asResponse: true
    });
    userACookie = resA.headers.get('set-cookie');
    const sessA = await auth.api.getSession({ headers: new Headers({ cookie: userACookie }) });
    userAId = sessA.user.id;

    const resB = await auth.api.signUpEmail({
      body: { email: emailB, password: 'Password123!', name: 'User Beta' },
      asResponse: true
    });
    userBCookie = resB.headers.get('set-cookie');
    const sessB = await auth.api.getSession({ headers: new Headers({ cookie: userBCookie }) });
    userBId = sessB.user.id;

    console.log(`Created User A: ${userAId} (${emailA})`);
    console.log(`Created User B: ${userBId} (${emailB})\n`);

    // TEST 1: First user message (Q1) creates an investigation
    console.log('--- TEST 1: Q1 creates first investigation ---');
    const q1Res = await makeRequest('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: userACookie
      },
      body: { message: 'Q1: What causes PostgreSQL connection pool exhaustion under load?' }
    });

    assert.strictEqual(q1Res.statusCode, 200, 'Q1 should return 200');
    assert.strictEqual(q1Res.data.success, true, 'Q1 response success should be true');
    const investigationId = q1Res.data.investigationId;
    assert.ok(investigationId, 'Q1 must return investigationId');
    assert.ok(q1Res.data.investigation, 'Q1 must return investigation metadata');
    assert.strictEqual(q1Res.data.investigation.id, investigationId);
    assert.strictEqual(q1Res.data.investigation.status, 'active');
    console.log(`✅ PASS: Q1 created Investigation ID: ${investigationId}\n`);

    // TEST 2: Second user message (Q2) with investigationId appends to same investigation
    console.log('--- TEST 2: Q2 sends same investigationId ---');
    const q2Res = await makeRequest('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: userACookie
      },
      body: {
        message: 'Q2: How does setting max_connections relate to the pool size?',
        investigationId
      }
    });

    assert.strictEqual(q2Res.statusCode, 200, 'Q2 should return 200');
    assert.strictEqual(q2Res.data.investigationId, investigationId, 'Q2 must return identical investigationId');
    console.log(`✅ PASS: Q2 appended to same Investigation ID: ${q2Res.data.investigationId}\n`);

    // TEST 3: Third user message (Q3) with investigationId appends to same investigation
    console.log('--- TEST 3: Q3 sends same investigationId ---');
    const q3Res = await makeRequest('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: userACookie
      },
      body: {
        message: 'Q3: What are the symptom indicators in server logs?',
        investigationId
      }
    });

    assert.strictEqual(q3Res.statusCode, 200, 'Q3 should return 200');
    assert.strictEqual(q3Res.data.investigationId, investigationId, 'Q3 must return identical investigationId');
    console.log(`✅ PASS: Q3 appended to same Investigation ID: ${q3Res.data.investigationId}\n`);

    // TEST 4: Verify PostgreSQL Messages Persistence under same investigation
    console.log('--- TEST 4: Verify PostgreSQL Persistence for Q1, Q2, Q3 ---');
    const dbMessages = await getInvestigationMessages(investigationId, userAId);
    console.log(`Found ${dbMessages.length} messages in PostgreSQL for investigation ${investigationId}`);
    assert.strictEqual(dbMessages.length, 6, 'Should have exactly 6 messages (3 user + 3 assistant)');
    assert.strictEqual(dbMessages[0].role, 'user');
    assert(dbMessages[0].content.includes('Q1:'), 'First message should be Q1');
    assert.strictEqual(dbMessages[1].role, 'assistant');
    assert.strictEqual(dbMessages[2].role, 'user');
    assert(dbMessages[2].content.includes('Q2:'), 'Third message should be Q2');
    assert.strictEqual(dbMessages[3].role, 'assistant');
    assert.strictEqual(dbMessages[4].role, 'user');
    assert(dbMessages[4].content.includes('Q3:'), 'Fifth message should be Q3');
    assert.strictEqual(dbMessages[5].role, 'assistant');
    console.log('✅ PASS: All 6 conversation turns persisted under the same investigation in PostgreSQL.\n');

    // TEST 5: IDOR Check - User B cannot read or append to User A's investigation
    console.log('--- TEST 5: IDOR Isolation & Access Control ---');
    // User B tries to append to User A's investigation
    const idorAppendRes = await makeRequest('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: userBCookie
      },
      body: {
        message: 'User B attempting unauthorized append',
        investigationId
      }
    });
    assert.strictEqual(idorAppendRes.statusCode, 403, 'User B must be forbidden from appending to User A investigation');
    assert.strictEqual(idorAppendRes.data.success, false);

    // User B tries to read User A's investigation detail
    const idorReadRes = await makeRequest(`/api/investigations/${investigationId}`, {
      headers: { cookie: userBCookie }
    });
    assert.strictEqual(idorReadRes.statusCode, 403, 'User B must be forbidden from reading User A investigation');
    console.log('✅ PASS: IDOR protection confirmed. User B denied access (403 Forbidden).\n');

    // TEST 6: Simulated Reload & Hydration (GET /api/investigations/:id)
    console.log('--- TEST 6: Simulated Browser Reload & Thread Hydration ---');
    const reloadRes = await makeRequest(`/api/investigations/${investigationId}`, {
      headers: { cookie: userACookie }
    });
    assert.strictEqual(reloadRes.statusCode, 200, 'User A should load investigation on reload');
    assert.strictEqual(reloadRes.data.investigation.id, investigationId);
    assert.strictEqual(reloadRes.data.investigation.messages.length, 6);
    console.log(`✅ PASS: Investigation ${investigationId} successfully re-hydrated with 6 messages.\n`);

    // TEST 7: Follow-up message (Q4) after reload continues with same investigationId
    console.log('--- TEST 7: Follow-up Q4 after reload preserves thread ---');
    const q4Res = await makeRequest('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: userACookie
      },
      body: {
        message: 'Q4: What metrics should we monitor to prevent future pool exhaustion?',
        investigationId
      }
    });
    assert.strictEqual(q4Res.statusCode, 200, 'Q4 should return 200');
    assert.strictEqual(q4Res.data.investigationId, investigationId, 'Q4 must maintain identical investigationId');

    const updatedMessages = await getInvestigationMessages(investigationId, userAId);
    assert.strictEqual(updatedMessages.length, 8, 'Should now have 8 messages (4 user + 4 assistant)');
    console.log(`✅ PASS: Q4 continued the thread seamlessly. DB now contains ${updatedMessages.length} messages.\n`);

    // TEST 8: Investigation Status Lifecycle (Active -> Completed -> Active)
    console.log('--- TEST 8: Status Lifecycle & Ownership Checks ---');
    // User B cannot change User A's status
    const idorStatusRes = await makeRequest(`/api/investigations/${investigationId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: userBCookie
      },
      body: { status: 'completed' }
    });
    assert.strictEqual(idorStatusRes.statusCode, 403, 'User B cannot change status');

    // User A marks completed
    const completeRes = await makeRequest(`/api/investigations/${investigationId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: userACookie
      },
      body: { status: 'completed' }
    });
    assert.strictEqual(completeRes.statusCode, 200);
    assert.strictEqual(completeRes.data.investigation.status, 'completed');

    // User A reopens as active
    const reopenRes = await makeRequest(`/api/investigations/${investigationId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: userACookie
      },
      body: { status: 'active' }
    });
    assert.strictEqual(reopenRes.statusCode, 200);
    assert.strictEqual(reopenRes.data.investigation.status, 'active');
    console.log('✅ PASS: Status transitions (active -> completed -> active) verified with IDOR enforcement.\n');

    console.log('============================================================');
    console.log('ALL PHASE 4C INVESTIGATION WORKSPACE & THREADING TESTS PASSED!');
    console.log('============================================================\n');
  } finally {
    if (server) {
      server.close();
    }
  }
}

runThreadingTests().catch((err) => {
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});
