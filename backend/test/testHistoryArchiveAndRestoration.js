process.env.NODE_ENV = 'test';
process.env.MOCK_LLM = 'true';
import assert from 'node:assert';
import http from 'node:http';
import app from '../server.js';
import { query } from '../src/db/connection.js';
import auth from '../src/auth/auth.js';
import {
  getInvestigation,
  listUserInvestigations,
  getInvestigationMessages,
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

async function runHistoryArchiveTests() {
  console.log('============================================================');
  console.log('BRAG PHASE 4D: HISTORY ARCHIVE & RESTORATION TEST SUITE');
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
  const emailA = `archivist-alpha-${uniqueSuffix}@brag.test`;
  const emailB = `archivist-beta-${uniqueSuffix}@brag.test`;
  let userAId, userBId, userACookie, userBCookie;

  try {
    // 1. Setup Test Users
    console.log('--- SETUP: Creating Test Users in Neon PostgreSQL ---');
    const resA = await auth.api.signUpEmail({
      body: { email: emailA, password: 'Password123!', name: 'Archivist Alpha' },
      asResponse: true
    });
    userACookie = resA.headers.get('set-cookie');
    const sessA = await auth.api.getSession({ headers: new Headers({ cookie: userACookie }) });
    userAId = sessA.user.id;

    const resB = await auth.api.signUpEmail({
      body: { email: emailB, password: 'Password123!', name: 'Archivist Beta' },
      asResponse: true
    });
    userBCookie = resB.headers.get('set-cookie');
    const sessB = await auth.api.getSession({ headers: new Headers({ cookie: userBCookie }) });
    userBId = sessB.user.id;

    console.log(`Created User Alpha: ${userAId}`);
    console.log(`Created User Beta: ${userBId}\n`);

    // TEST 1: User Alpha creates Investigation #1 (Q1, Q2, Q3)
    console.log('--- TEST 1: User Alpha conducts Multi-Turn Investigation #1 ---');
    const q1 = await makeRequest('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: userACookie },
      body: { message: 'Q1: Why are Redis socket connections dropping intermittently?' }
    });
    assert.strictEqual(q1.statusCode, 200);
    const inv1Id = q1.data.investigationId;
    assert.ok(inv1Id);

    const q2 = await makeRequest('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: userACookie },
      body: { message: 'Q2: How does TCP keepalive affect redis client timeout?', investigationId: inv1Id }
    });
    assert.strictEqual(q2.data.investigationId, inv1Id);

    const q3 = await makeRequest('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: userACookie },
      body: { message: 'Q3: What logs indicate maxclients threshold reached?', investigationId: inv1Id }
    });
    assert.strictEqual(q3.data.investigationId, inv1Id);
    console.log(`✅ PASS: Investigation #1 (${inv1Id}) created with 3 user questions + 3 assistant responses.\n`);

    // TEST 2: User Alpha creates Investigation #2 (Separate Thread)
    console.log('--- TEST 2: User Alpha conducts Separate Investigation #2 ---');
    const qInv2 = await makeRequest('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: userACookie },
      body: { message: 'Q1_B: Investigating memory leak in Node.js event emitter.' }
    });
    assert.strictEqual(qInv2.statusCode, 200);
    const inv2Id = qInv2.data.investigationId;
    assert.notStrictEqual(inv2Id, inv1Id, 'New thread must generate a distinct investigation ID');
    console.log(`✅ PASS: Separate Investigation #2 created with ID: ${inv2Id}\n`);

    // TEST 3: User Alpha fetches History Archive List (GET /api/investigations)
    console.log('--- TEST 3: Fetching History Archive List (GET /api/investigations) ---');
    const listRes = await makeRequest('/api/investigations', {
      headers: { cookie: userACookie }
    });
    assert.strictEqual(listRes.statusCode, 200);
    assert.strictEqual(listRes.data.success, true);
    assert(Array.isArray(listRes.data.investigations), 'investigations must be an array');
    assert(listRes.data.investigations.length >= 2, 'Must contain both created investigations');

    const item1 = listRes.data.investigations.find(i => i.id === inv1Id);
    const item2 = listRes.data.investigations.find(i => i.id === inv2Id);
    assert.ok(item1, 'Investigation #1 must be present in archive');
    assert.ok(item2, 'Investigation #2 must be present in archive');
    assert.strictEqual(parseInt(item1.message_count, 10), 6, 'Investigation #1 should have 6 messages recorded');
    assert.strictEqual(parseInt(item2.message_count, 10), 2, 'Investigation #2 should have 2 messages recorded');
    console.log(`✅ PASS: History Archive list returns real investigations with accurate message counts (${item1.message_count}, ${item2.message_count}).\n`);

    // TEST 4: User Alpha restores complete Investigation #1 Detail (GET /api/investigations/:id)
    console.log('--- TEST 4: Investigation Detail & Full State Restoration ---');
    const detailRes = await makeRequest(`/api/investigations/${inv1Id}`, {
      headers: { cookie: userACookie }
    });
    assert.strictEqual(detailRes.statusCode, 200);
    assert.strictEqual(detailRes.data.success, true);
    const invData = detailRes.data.investigation;
    assert.strictEqual(invData.id, inv1Id);
    assert.strictEqual(invData.status, 'active');
    assert(Array.isArray(invData.messages), 'messages array must be present');
    assert.strictEqual(invData.messages.length, 6, 'Must contain all 6 persisted turns');
    assert.strictEqual(invData.messages[0].content, 'Q1: Why are Redis socket connections dropping intermittently?');
    console.log(`✅ PASS: Full investigation detail and messages restored accurately.\n`);

    // TEST 5: Continue Investigation Flow (History -> Live Console -> Q4 -> same inv1Id)
    console.log('--- TEST 5: Continue Investigation Flow with Q4 ---');
    const continueRes = await makeRequest('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: userACookie },
      body: {
        message: 'Q4: What kernel parameters (sysctl) should we tune for high socket throughput?',
        investigationId: inv1Id
      }
    });
    assert.strictEqual(continueRes.statusCode, 200);
    assert.strictEqual(continueRes.data.investigationId, inv1Id, 'Must append to existing investigation #1');

    const updatedMessages = await getInvestigationMessages(inv1Id, userAId);
    assert.strictEqual(updatedMessages.length, 8, 'Should now have 8 messages in PostgreSQL');
    assert.strictEqual(updatedMessages[6].content, 'Q4: What kernel parameters (sysctl) should we tune for high socket throughput?');
    console.log(`✅ PASS: Continue flow successfully persisted Q4 to same Investigation #1 (DB count: 8 messages).\n`);

    // TEST 6: IDOR Protection & User Isolation in History
    console.log('--- TEST 6: IDOR Protection & Access Control ---');
    // User Beta lists their investigations -> must NOT see User Alpha's
    const betaList = await makeRequest('/api/investigations', {
      headers: { cookie: userBCookie }
    });
    assert.strictEqual(betaList.statusCode, 200);
    assert.strictEqual(betaList.data.investigations.length, 0, 'User Beta must see 0 investigations');

    // User Beta tries to read User Alpha's investigation #1
    const betaGetDetail = await makeRequest(`/api/investigations/${inv1Id}`, {
      headers: { cookie: userBCookie }
    });
    assert.strictEqual(betaGetDetail.statusCode, 403, 'User Beta must be rejected with 403 Forbidden');

    // User Beta tries to update status of User Alpha's investigation #1
    const betaPatchStatus = await makeRequest(`/api/investigations/${inv1Id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie: userBCookie },
      body: { status: 'completed' }
    });
    assert.strictEqual(betaPatchStatus.statusCode, 403, 'User Beta must be forbidden from updating status');

    // User Beta tries to append messages to User Alpha's investigation #1
    const betaAppend = await makeRequest('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: userBCookie },
      body: { message: 'Malicious append', investigationId: inv1Id }
    });
    assert.strictEqual(betaAppend.statusCode, 403, 'User Beta must be forbidden from appending to investigation');
    console.log('✅ PASS: Strict IDOR isolation confirmed across listing, retrieval, status update, and append.\n');

    // TEST 7: Investigation Status Transitions in History (Active -> Completed -> Active)
    console.log('--- TEST 7: Status Lifecycle in History Archive ---');
    const completeRes = await makeRequest(`/api/investigations/${inv1Id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie: userACookie },
      body: { status: 'completed' }
    });
    assert.strictEqual(completeRes.statusCode, 200);
    assert.strictEqual(completeRes.data.investigation.status, 'completed');

    const reopenedRes = await makeRequest(`/api/investigations/${inv1Id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie: userACookie },
      body: { status: 'active' }
    });
    assert.strictEqual(reopenedRes.statusCode, 200);
    assert.strictEqual(reopenedRes.data.investigation.status, 'active');
    console.log('✅ PASS: Status lifecycle transitions verified.\n');

    console.log('============================================================');
    console.log('ALL PHASE 4D HISTORY ARCHIVE & RESTORATION TESTS PASSED!');
    console.log('============================================================\n');
  } finally {
    if (server) {
      server.close();
    }
  }
}

runHistoryArchiveTests().catch((err) => {
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});
