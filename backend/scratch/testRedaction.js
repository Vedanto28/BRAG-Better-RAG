import { LocalGitProvider } from '../src/providers/localGitProvider.js';
import { redactSensitiveData } from '../src/services/agentOrchestrator.js';

const provider = new LocalGitProvider('.');

const testDiff = `
diff --git a/server.js b/server.js
--- a/server.js
+++ b/server.js
@@ -10,3 +10,3 @@
-const JWT_SECRET = "super-secret-original";
+const JWT_SECRET = "super-secret-new-value";
-const dbPassword = 'oldPassword123!';
+const dbPassword = 'newPassword456!';
-const apiKey = "key-abcd-1234";
+const apiKey = "key-efgh-5678";
-const sessionToken = 'token_original_val';
+const sessionToken = 'token_new_val';
+const normalCodeLine = "someNormalValue";
`;

console.log("=== ORIGINAL DIFF ===");
console.log(testDiff);

console.log("\n=== REDACTED DIFF ===");
const redacted = provider._redactSecrets(testDiff);
console.log(redacted);

// Validations
if (redacted.includes("super-secret-new-value")) {
  console.error("FAIL: JWT_SECRET not redacted");
  process.exit(1);
}
if (redacted.includes("newPassword456!")) {
  console.error("FAIL: dbPassword not redacted");
  process.exit(1);
}
if (redacted.includes("key-efgh-5678")) {
  console.error("FAIL: apiKey not redacted");
  process.exit(1);
}
if (redacted.includes("token_new_val")) {
  console.error("FAIL: sessionToken not redacted");
  process.exit(1);
}
if (!redacted.includes("someNormalValue")) {
  console.error("FAIL: normalCodeLine was modified incorrectly");
  process.exit(1);
}

console.log("\nSTATUS: PASS");

console.log("\n=== HOLISTIC REDACTION (AgentOrchestrator) ===");
const fakeRepoRoot = process.cwd();
const windowsRoot = fakeRepoRoot.replace(/\//g, '\\');
const mockFinalAnswer = `
I found a GitHub PR containing this token: token="super_secret_github_token_12345".
The console logs in Chrome DevTools showed: API_KEY: 'live_browser_key_9876543210'.
Context7 docs snippet had a mock credential: db_password = "mock_pass_from_docs_56789".
Also, the error originated at ${fakeRepoRoot}/src/some/file.js.
On Windows it looks like ${windowsRoot}\\src\\other\\file.js.
`;

console.log("Original Final Answer:\n", mockFinalAnswer);
const holisticRedacted = redactSensitiveData(mockFinalAnswer);
console.log("Redacted Final Answer:\n", holisticRedacted);

if (holisticRedacted.includes("super_secret_github_token_12345")) {
  console.error("FAIL: Holistic GitHub token not redacted");
  process.exit(1);
}
if (holisticRedacted.includes("live_browser_key_9876543210")) {
  console.error("FAIL: Holistic browser key not redacted");
  process.exit(1);
}
if (holisticRedacted.includes("mock_pass_from_docs_56789")) {
  console.error("FAIL: Holistic docs pass not redacted");
  process.exit(1);
}
if (holisticRedacted.includes(fakeRepoRoot) || holisticRedacted.includes(windowsRoot)) {
  console.error("FAIL: Absolute paths not redacted");
  process.exit(1);
}
if (!holisticRedacted.includes("[REPO_ROOT]/src/some/file.js") && !holisticRedacted.includes("[REPO_ROOT]\\src\\other\\file.js")) {
  console.error("FAIL: Absolute paths not correctly replaced with [REPO_ROOT]");
  process.exit(1);
}

console.log("\nHOLISTIC STATUS: PASS");
process.exit(0);
