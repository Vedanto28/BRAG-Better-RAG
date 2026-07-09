import { LocalGitProvider } from '../src/providers/localGitProvider.js';

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
process.exit(0);
