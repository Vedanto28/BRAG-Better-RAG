import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import fs from 'node:fs';

const currentFilePath = fileURLToPath(import.meta.url);
const scratchDir = path.dirname(currentFilePath);
const projectRoot = path.resolve(scratchDir, '..', '..');

const rootEnvPath = path.resolve(projectRoot, '.env');
const backendEnvPath = path.resolve(projectRoot, 'backend', '.env');
dotenv.config({ path: backendEnvPath });
dotenv.config({ path: rootEnvPath });

// Ensure we use real LLM
delete process.env.MOCK_LLM;
delete process.env.TEST_GEMINI_FAIL_ALL;
delete process.env.TEST_OPENAI_FAIL_ALL;
process.env.LLM_PROVIDER = 'gemini';

// Import app
import app from '../server.js';

const TEST_PORT = 5020;
let serverInstance;

function startServer() {
  return new Promise((resolve) => {
    process.env.PORT = TEST_PORT;
    serverInstance = app.listen(TEST_PORT, () => {
      console.log(`[QA Test Server] Started on port ${TEST_PORT}`);
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (serverInstance) {
      serverInstance.close(() => {
        console.log('[QA Test Server] Stopped.');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

const clonedReposDir = path.resolve(scratchDir, 'cloned_repos');

const testCases = [
  // 1. khaata-Kitab-
  {
    repo: 'khaata-Kitab-',
    category: 'Repository Investigation',
    query: "Explain the folder structure and find any authentication middleware files in the khaata-Kitab- repository."
  },
  {
    repo: 'khaata-Kitab-',
    category: 'GitHub Investigation',
    query: "List the recent commits in the khaata-Kitab- repository and check who authored them."
  },
  {
    repo: 'khaata-Kitab-',
    category: 'Runtime Investigation',
    query: "If a user reports that a billing button does nothing and a 'failed network request' error shows in the browser console, how would we trace this using Chrome DevTools?"
  },
  {
    repo: 'khaata-Kitab-',
    category: 'Documentation Investigation',
    query: "Check if the codebase uses Next.js App Router or Express, and verify if the middleware pattern matches the official documentation guidelines from Context7."
  },
  {
    repo: 'khaata-Kitab-',
    category: 'Compound Investigation',
    query: "Trace how authentication is verified, check recent git changes, check if there are browser console logs, and verify if the implementation follows official docs guidelines."
  },

  // 2. CorpNest
  {
    repo: 'CorpNest',
    category: 'Repository Investigation',
    query: "Trace the API routes and locate where the main server or routing logic is set up in CorpNest."
  },
  {
    repo: 'CorpNest',
    category: 'GitHub Investigation',
    query: "Summarize recent development and inspect the commits on GitHub for the CorpNest repository."
  },
  {
    repo: 'CorpNest',
    category: 'Runtime Investigation',
    query: "If CorpNest fails to render with a blank React page and console logs throw a hydration warning, explain what steps we take using Chrome DevTools MCP tools to inspect it."
  },
  {
    repo: 'CorpNest',
    category: 'Documentation Investigation',
    query: "Identify the database/ORM used in CorpNest (e.g. Prisma or Mongoose) and verify if the connection pooling setup conforms to official documentation."
  },
  {
    repo: 'CorpNest',
    category: 'Compound Investigation',
    query: "Explain why corporate database connection fails and whether the connection verification code follows official recommended practices."
  },

  // 3. watchly.ai
  {
    repo: 'watchly.ai',
    category: 'Repository Investigation',
    query: "Find where configuration, environment variables, or database schemas are defined in the watchly.ai repository."
  },
  {
    repo: 'watchly.ai',
    category: 'GitHub Investigation',
    query: "Compare branches or inspect recent commits on GitHub to find what changed in the watchly.ai repository."
  },
  {
    repo: 'watchly.ai',
    category: 'Runtime Investigation',
    query: "If a monitoring page freezes or has slow rendering, explain how to analyze network requests or console errors using Chrome DevTools."
  },
  {
    repo: 'watchly.ai',
    category: 'Documentation Investigation',
    query: "Verify whether the state management or API design in watchly.ai matches recommended patterns from official React or Express docs."
  },
  {
    repo: 'watchly.ai',
    category: 'Compound Investigation',
    query: "The watchly dashboard fails to load. Investigate the codebase, check recent commits, inspect browser console logs, and cross-reference with official Next.js documentation to suggest a fix."
  },

  // 4. express (unfamiliar public repo)
  {
    repo: 'express',
    category: 'Generalization Investigation',
    query: "Explain the router folder structure in the express repository, check recent GitHub commits, and confirm if router middleware usage matches official Express documentation."
  }
];

async function main() {
  await startServer();
  const results = [];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const repoPath = path.join(clonedReposDir, tc.repo);

    console.log(`\n==================================================`);
    console.log(`[QA CASE ${i + 1}/${testCases.length}] Repo: ${tc.repo} | Category: ${tc.category}`);
    console.log(`Query: "${tc.query}"`);
    console.log(`Setting REPO_ROOT_PATH to: ${repoPath}`);
    console.log(`==================================================`);

    // Override the environment variable dynamically
    process.env.REPO_ROOT_PATH = repoPath;

    // Reset providers so they inspect the new repo path remote origin or files
    // In our backend, the providers are singletons, so we want them to clear cached repo info.
    const { default: gitHubProvider } = await import('../src/services/gitHubMcpProvider.js');
    const { default: internalMcpProvider } = await import('../src/services/internalMcpProvider.js');
    await gitHubProvider.reset();
    await internalMcpProvider.reset();

    const startTime = Date.now();

    try {
      const res = await fetch(`http://localhost:${TEST_PORT}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: tc.query })
      });

      const latency = Date.now() - startTime;
      const data = await res.json();

      if (!res.ok) {
        console.error(`FAIL: HTTP ${res.status}`, data);
        results.push({
          case: i + 1,
          repo: tc.repo,
          category: tc.category,
          query: tc.query,
          success: false,
          error: data,
          latency
        });
      } else {
        console.log(`SUCCESS in ${latency}ms`);
        console.log(`Mode: ${data.metadata.mode}`);
        console.log(`Provider: ${data.metadata.provider}`);
        console.log(`Tools Used: ${JSON.stringify(data.metadata.toolsUsed)}`);
        
        results.push({
          case: i + 1,
          repo: tc.repo,
          category: tc.category,
          query: tc.query,
          success: true,
          answer: data.answer,
          metadata: data.metadata,
          latency
        });
      }
    } catch (err) {
      const latency = Date.now() - startTime;
      console.error(`ERROR:`, err);
      results.push({
        case: i + 1,
        repo: tc.repo,
        category: tc.category,
        query: tc.query,
        success: false,
        error: err.message || err,
        latency
      });
    }

    // Cooling off period to prevent API rate limits
    if (i < testCases.length - 1) {
      const coolMs = 25000;
      console.log(`Waiting ${coolMs / 1000}s for rate limits cooling...`);
      await new Promise(r => setTimeout(r, coolMs));
    }
  }

  // Write results to json
  const resultsPath = path.join(scratchDir, 'qa_validation_results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\nWritten results to: ${resultsPath}`);

  await stopServer();
}

main().catch(async (err) => {
  console.error("Fatal error:", err);
  await stopServer();
});
