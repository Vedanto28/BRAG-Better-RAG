import assert from 'node:assert';
import http from 'node:http';
import app from '../server.js';
import { query } from '../src/db/connection.js';
import auth from '../src/auth/auth.js';
import {
  findOrCreateInvestigation,
  recordChatInteraction,
  getInvestigation,
  listUserInvestigations,
  getInvestigationMessages,
  getInvestigationEvidence,
  getInvestigationDiagnosticReport
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

async function runTests() {
  console.log('============================================================');
  console.log('BRAG PHASE 6: AUTHENTICATION & OWNERSHIP TEST SUITE');
  console.log('============================================================\n');

  // Start temporary local test server on random port
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      console.log(`[Test Server] Running on ${baseUrl}`);
      resolve();
    });
  });

  const uniqueSuffix = Date.now();
  const emailA = `user-alpha-${uniqueSuffix}@brag.test`;
  const emailB = `user-beta-${uniqueSuffix}@brag.test`;
  let userAId, userBId, userACookie, userBCookie, sessionAToken, sessionBToken;
  const expiredSessionToken = `expired-token-${uniqueSuffix}`;

  try {
    // 1. Setup Test Users & Sessions in Neon DB using Better Auth API
    console.log('--- SETUP: Creating Test Users and Real Sessions in Better Auth ---');
    
    const resA = await auth.api.signUpEmail({
      body: { email: emailA, password: 'Password123!', name: 'User Alpha' },
      asResponse: true
    });
    userACookie = resA.headers.get('set-cookie');
    const sessA = await auth.api.getSession({ headers: new Headers({ cookie: userACookie }) });
    userAId = sessA.user.id;
    sessionAToken = sessA.session.token;

    const resB = await auth.api.signUpEmail({
      body: { email: emailB, password: 'Password123!', name: 'User Beta' },
      asResponse: true
    });
    userBCookie = resB.headers.get('set-cookie');
    const sessB = await auth.api.getSession({ headers: new Headers({ cookie: userBCookie }) });
    userBId = sessB.user.id;
    sessionBToken = sessB.session.token;

    // Create an expired session in DB for User A
    await query(
      `INSERT INTO "session" (id, token, "userId", "expiresAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, NOW() - INTERVAL '1 day', NOW(), NOW())`,
      [`sess-exp-${uniqueSuffix}`, expiredSessionToken, userAId]
    );

    console.log(`✅ User A (${userAId}) and User B (${userBId}) initialized with real sessions.\n`);

    // TEST 1: Health endpoint remains public
    console.log('--- TEST 1: Public Health Check Endpoint ---');
    const healthRes = await makeRequest('/api/health');
    assert.strictEqual(healthRes.statusCode, 200, 'Health endpoint must return 200');
    assert.strictEqual(healthRes.data.success, true, 'Health check must be success: true');
    console.log('✅ PASS: GET /api/health is open and returned 200 OK.\n');

    // TEST 2: Unauthenticated protected endpoint returns 401
    console.log('--- TEST 2: Unauthenticated Protected Requests ---');
    const unauthChat = await makeRequest('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { message: 'Explain PostgreSQL MVCC' }
    });
    assert.strictEqual(unauthChat.statusCode, 401, 'Unauthenticated POST /api/chat must return 401');
    assert.strictEqual(unauthChat.data.error.code, 'UNAUTHORIZED');

    const unauthInv = await makeRequest('/api/investigations');
    assert.strictEqual(unauthInv.statusCode, 401, 'Unauthenticated GET /api/investigations must return 401');
    console.log('✅ PASS: Unauthenticated requests to /api/chat and /api/investigations return 401 Unauthorized.\n');

    // TEST 3: Invalid session token returns 401
    console.log('--- TEST 3: Invalid / Forged Session Token ---');
    const invalidRes = await makeRequest('/api/investigations', {
      headers: {
        'Cookie': 'better-auth.session_token=forged-tampered-token-xyz'
      }
    });
    assert.strictEqual(invalidRes.statusCode, 401, 'Invalid session cookie must return 401');
    console.log('✅ PASS: Invalid / forged session tokens are rejected with 401.\n');

    // TEST 4: Expired session returns 401
    console.log('--- TEST 4: Expired Session Token ---');
    const expiredRes = await makeRequest('/api/investigations', {
      headers: {
        'Authorization': `Bearer ${expiredSessionToken}`
      }
    });
    assert.strictEqual(expiredRes.statusCode, 401, 'Expired session must return 401');
    console.log('✅ PASS: Expired session tokens are rejected with 401.\n');

    // TEST 5: Authenticated request accepted
    console.log('--- TEST 5: Authenticated Request with Valid Session ---');
    const authListRes = await makeRequest('/api/investigations', {
      headers: {
        'Cookie': userACookie
      }
    });
    assert.strictEqual(authListRes.statusCode, 200, 'Authenticated request must return 200');
    assert.strictEqual(authListRes.data.success, true);
    console.log('✅ PASS: Valid session accepted with 200 OK.\n');

    // TEST 6: IDOR Protection (Investigation, Messages, Evidence, Reports)
    console.log('--- TEST 6: IDOR Protection & User Data Isolation ---');
    // User B creates an investigation
    const invBId = `inv-user-b-${uniqueSuffix}`;
    await findOrCreateInvestigation(invBId, 'User B Secret Investigation', userBId);

    // Add message, evidence, and report for User B
    await query(
      `INSERT INTO messages (investigation_id, role, content, created_at)
       VALUES ($1, 'user', 'User B sensitive query', NOW()),
              ($1, 'assistant', 'User B sensitive answer', NOW())`,
      [invBId]
    );
    await query(
      `INSERT INTO evidence (investigation_id, source, content, created_at)
       VALUES ($1, 'internal_mcp', 'User B proprietary evidence trace', NOW())`,
      [invBId]
    );
    await query(
      `INSERT INTO diagnostic_reports (investigation_id, finding, root_cause, confidence, created_at)
       VALUES ($1, 'User B Finding', 'User B Root Cause', '95%', NOW())`,
      [invBId]
    );

    // User A attempts to access User B's investigation detail
    const idorDetailRes = await makeRequest(`/api/investigations/${invBId}`, {
      headers: {
        'Cookie': userACookie
      }
    });
    assert.strictEqual(idorDetailRes.statusCode, 403, 'User A accessing User B investigation must return 403 Forbidden');
    console.log('✅ PASS: User A cannot read User B investigation detail (403 Forbidden).');

    // User A attempts to access User B's messages
    const idorMessagesRes = await makeRequest(`/api/investigations/${invBId}/messages`, {
      headers: {
        'Cookie': userACookie
      }
    });
    assert.strictEqual(idorMessagesRes.statusCode, 403, 'User A accessing User B messages must return 403 Forbidden');
    console.log('✅ PASS: User A cannot read User B messages (403 Forbidden).');

    // User A attempts to access User B's evidence
    const idorEvidenceRes = await makeRequest(`/api/investigations/${invBId}/evidence`, {
      headers: {
        'Cookie': userACookie
      }
    });
    assert.strictEqual(idorEvidenceRes.statusCode, 403, 'User A accessing User B evidence must return 403 Forbidden');
    console.log('✅ PASS: User A cannot read User B evidence (403 Forbidden).');

    // User A attempts to access User B's diagnostic report
    const idorReportRes = await makeRequest(`/api/investigations/${invBId}/report`, {
      headers: {
        'Cookie': userACookie
      }
    });
    assert.strictEqual(idorReportRes.statusCode, 403, 'User A accessing User B report must return 403 Forbidden');
    console.log('✅ PASS: User A cannot read User B diagnostic reports (403 Forbidden).');

    // User A attempts to append messages/chat turns to User B's investigation
    const idorAppendRes = await makeRequest('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': userACookie
      },
      body: {
        message: 'Attempting to inject turn into User B investigation',
        investigationId: invBId
      }
    });
    assert.strictEqual(idorAppendRes.statusCode, 403, 'User A appending to User B investigation must return 403 Forbidden');
    console.log('✅ PASS: User A cannot hijack or append to User B investigation (403 Forbidden).\n');

    // TEST 7: Logout Invalidation
    console.log('--- TEST 7: Server-side Session Invalidation / Logout ---');
    // Invalidate User A session in DB
    await query('DELETE FROM "session" WHERE token = $1', [sessionAToken]);
    const postLogoutRes = await makeRequest('/api/investigations', {
      headers: {
        'Cookie': userACookie
      }
    });
    assert.strictEqual(postLogoutRes.statusCode, 401, 'Logged out session must return 401');
    console.log('✅ PASS: Session token invalidation immediately blocks access (401 Unauthorized).\n');

    // TEST 8: CORS configuration
    console.log('--- TEST 8: CORS Restrictiveness & Credentials Configuration ---');
    const validOriginRes = await makeRequest('/api/health', {
      headers: {
        'Origin': 'https://brag-better-rag.vercel.app'
      }
    });
    assert.strictEqual(
      validOriginRes.headers['access-control-allow-origin'],
      'https://brag-better-rag.vercel.app',
      'CORS must echo exact allowed origin'
    );
    assert.strictEqual(
      validOriginRes.headers['access-control-allow-credentials'],
      'true',
      'CORS credentials header must be true'
    );

    const invalidOriginRes = await makeRequest('/api/health', {
      headers: {
        'Origin': 'https://malicious-attacker-site.com'
      }
    });
    assert.strictEqual(
      invalidOriginRes.headers['access-control-allow-origin'],
      undefined,
      'Untrusted origin must NOT receive Access-Control-Allow-Origin header'
    );
    console.log('✅ PASS: CORS is strictly locked to trusted origins with credentials enabled.\n');

    // TEST 9: Secret Isolation
    console.log('--- TEST 9: Secret Isolation in Logs and Errors ---');
    const secretKey = 'sk-secret-byok-test-key-1234567890';
    const errorRes = await makeRequest('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': userBCookie,
        'x-byok-openai-key': secretKey
      },
      body: { message: '' } // triggers 400 validation error
    });
    const serializedResponse = JSON.stringify(errorRes);
    assert(!serializedResponse.includes(secretKey), 'Secret key must never leak in error response');
    assert(!serializedResponse.includes(process.env.BETTER_AUTH_SECRET || 'brag-secret'), 'Auth secret must never leak');
    console.log('✅ PASS: No API keys or session secrets are leaked in error responses.\n');

    console.log('============================================================');
    console.log('ALL PHASE 6 AUTHENTICATION & OWNERSHIP TESTS PASSED! (0 REAL LLM CALLS)');
    console.log('============================================================');

  } finally {
    // Clean up test data
    try {
      if (userAId || userBId) {
        await query('DELETE FROM "user" WHERE id IN ($1, $2)', [userAId || 'none', userBId || 'none']);
      }
    } catch (e) {}

    if (server) {
      server.close();
    }
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Authentication test suite failed:', err);
    process.exit(1);
  });
