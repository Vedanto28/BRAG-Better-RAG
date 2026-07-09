import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LocalRepoProvider } from '../src/providers/localRepoProvider.js';

const currentFilePath = fileURLToPath(import.meta.url);
const scratchDir = path.dirname(currentFilePath);
// Project root is 2 levels up from backend/scratch/
const projectRoot = path.resolve(scratchDir, '..', '..');

// 1. Point REPO_ROOT_PATH at this project's own repo
process.env.REPO_ROOT_PATH = projectRoot;
console.log(`Setting REPO_ROOT_PATH to: ${process.env.REPO_ROOT_PATH}\n`);

async function runTests() {
  try {
    const provider = new LocalRepoProvider(process.env.REPO_ROOT_PATH);

    // 2. Calls listFiles() (for listRepositoryFiles) and prints the top-level result
    console.log("==================================================");
    console.log("Test 1: listFiles() on repository root (top-level)");
    console.log("==================================================");
    const files = await provider.listFiles("");
    console.log(JSON.stringify(files, null, 2));
    console.log("\n");

    // 3. Calls searchCode("app.listen") and prints matches
    console.log("==================================================");
    console.log("Test 2: searchCode(\"app.listen\")");
    console.log("==================================================");
    const searchResult = await provider.searchCode("app.listen");
    console.log(JSON.stringify(searchResult, null, 2));
    console.log("\n");

    // 4. Calls readFile() on one real file and prints content
    console.log("==================================================");
    console.log("Test 3: readFile() on backend/server.js");
    console.log("==================================================");
    const fileContent = await provider.readFile("backend/server.js");
    console.log(fileContent);
    console.log("\n");

    // 5. Test safety requirement: Path traversal attempt
    console.log("==================================================");
    console.log("Test 4: Path traversal safety check (should fail)");
    console.log("==================================================");
    try {
      await provider.readFile("../../../any_external_file.txt");
      console.error("FAIL: Path traversal check did not throw an error.");
    } catch (error) {
      console.log(`PASS: Correctly rejected path traversal: ${error.message}`);
    }
    console.log("\n");

    // 6. Test safety requirement: Ignored directory check
    console.log("==================================================");
    console.log("Test 5: Ignored directory safety check (should fail)");
    console.log("==================================================");
    try {
      await provider.listFiles(".git");
      console.error("FAIL: Ignored directory check did not throw an error.");
    } catch (error) {
      console.log(`PASS: Correctly rejected access to ignored directory: ${error.message}`);
    }
    console.log("\n");

  } catch (err) {
    console.error("Error running test suite:", err);
    process.exit(1);
  }
}

runTests();
