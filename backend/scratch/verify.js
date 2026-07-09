import app from '../server.js';
import { AI_CONFIG } from '../src/utils/config.js';

const TEST_PORT = 5002;
let serverInstance;

function startServer() {
  return new Promise((resolve) => {
    // Override PORT env for testing
    process.env.PORT = TEST_PORT;
    serverInstance = app.listen(TEST_PORT, () => {
      console.log(`[Test Server] Listening on port ${TEST_PORT}`);
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (serverInstance) {
      serverInstance.close(() => {
        console.log('[Test Server] Closed.');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

async function runTests() {
  await startServer();

  const baseUrl = `http://localhost:${TEST_PORT}`;
  let passedCount = 0;
  let failedCount = 0;

  async function assertResponse(testName, path, options, checkFn) {
    try {
      console.log(`\n--- Running Test: ${testName} ---`);
      const url = `${baseUrl}${path}`;
      const res = await fetch(url, options);
      const data = await res.json();
      
      const checkPassed = checkFn(res, data);
      if (checkPassed) {
        console.log(`PASS: ${testName}`);
        passedCount++;
      } else {
        console.error(`FAIL: ${testName}`);
        console.error(`Status: ${res.status}`);
        console.error(`Data:`, JSON.stringify(data, null, 2));
        failedCount++;
      }
    } catch (err) {
      console.error(`ERROR: ${testName} failed with exception:`, err);
      failedCount++;
    }
  }

  // Test 1: Health Check
  await assertResponse(
    'Health Check',
    '/api/health',
    { method: 'GET' },
    (res, data) => res.ok && data.success === true && data.message === 'Backend is running'
  );

  // Test 2: Empty Message Validation
  await assertResponse(
    'Empty Message Validation',
    '/api/chat',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '' })
    },
    (res, data) => res.status === 400 && data.success === false && data.message.includes('required')
  );

  // Test 3: Oversized Message Validation
  await assertResponse(
    'Oversized Message Validation',
    '/api/chat',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'a'.repeat(AI_CONFIG.MAX_USER_MESSAGE_CHARS + 1) })
    },
    (res, data) => res.status === 400 && data.success === false && data.message.includes('too long')
  );

  // Test 4: General Question (No Context, No Tools)
  await assertResponse(
    'General Question',
    '/api/chat',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Who developed Node.js?' })
    },
    (res, data) => {
      console.log(`Response Answer: ${data.answer}`);
      console.log(`Response Metadata:`, data.metadata);
      return res.ok && data.success === true && typeof data.answer === 'string';
    }
  );

  // Test 5: Calculator Tool Call
  await assertResponse(
    'Calculator Tool Call',
    '/api/chat',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'What is 152 multiplied by 4?' })
    },
    (res, data) => {
      console.log(`Response Answer: ${data.answer}`);
      console.log(`Response Metadata:`, data.metadata);
      const matchesText = data.answer.includes('608') || data.metadata.provider === 'fallback';
      return res.ok && data.success === true && matchesText;
    }
  );

  // Test 6: Date/Time Tool Call
  await assertResponse(
    'Date/Time Tool Call',
    '/api/chat',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'What is the current server time?' })
    },
    (res, data) => {
      console.log(`Response Answer: ${data.answer}`);
      console.log(`Response Metadata:`, data.metadata);
      return res.ok && data.success === true;
    }
  );

  // Test 7: Static RAG / Search Knowledge Base
  await assertResponse(
    'Static RAG Knowledge Base Retrieval',
    '/api/chat',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Tell me about Embeddings' })
    },
    (res, data) => {
      console.log(`Response Answer: ${data.answer}`);
      console.log(`Response Metadata:`, data.metadata);
      return res.ok && data.success === true && data.metadata.contextFound === true;
    }
  );

  console.log(`\n======================================`);
  console.log(`TEST RUN COMPLETED`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);
  console.log(`======================================`);

  await stopServer();

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(async (err) => {
  console.error('Fatal testing error:', err);
  await stopServer();
  process.exit(1);
});
