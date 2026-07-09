import { LocalGitProvider } from '../src/providers/localGitProvider.js';

async function main() {
  const provider = new LocalGitProvider('.');

  console.log("=== Testing getRecentCommits ===");
  const commits = await provider.getRecentCommits({ limit: 3 });
  console.log(`Retrieved ${commits.length} commits.`);
  for (const c of commits) {
    console.log(`- ${c.shortHash} by ${c.author} on ${c.date}: "${c.message}"`);
    console.log(`  Files changed (${c.filesChanged.length}):`, c.filesChanged.slice(0, 5));
  }

  if (commits.length === 0) {
    console.error("FAIL: No commits retrieved.");
    process.exit(1);
  }

  const testHash = commits[0].hash;
  console.log(`\n=== Testing inspectCommit on ${testHash} ===`);
  const details = await provider.inspectCommit(testHash);
  console.log(`Commit: ${details.hash} (${details.shortHash})`);
  console.log(`Author: ${details.author}`);
  console.log(`Date: ${details.date}`);
  console.log(`Message: ${details.message}`);
  console.log(`Files Changed (${details.filesChanged.length}):`, details.filesChanged);
  console.log(`Summary: ${details.diffSummary}`);
  console.log(`Diff Preview (first 500 chars):\n${details.diff.slice(0, 500)}...`);

  console.log("\nSTATUS: PASS");
  process.exit(0);
}

main().catch(err => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
