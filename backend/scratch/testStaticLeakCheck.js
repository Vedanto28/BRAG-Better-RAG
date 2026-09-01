import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const currentFilePath = fileURLToPath(import.meta.url);
const scratchDir = path.dirname(currentFilePath);
const backendDir = path.resolve(scratchDir, '..');
const srcDir = path.resolve(backendDir, 'src');

function getAllJsFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllJsFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith('.js')) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

function runStaticLeakCheck() {
  console.log("==================================================");
  console.log("RUNNING GAP 1 STATIC CODEBASE LEAK-CHECK");
  console.log("==================================================\n");

  const filesToScan = [
    path.resolve(backendDir, 'server.js'),
    ...getAllJsFiles(srcDir)
  ];

  console.log(`Scanning ${filesToScan.length} backend source files for static credential leak patterns...\n`);

  const unsafePatterns = [
    // 1. Logging raw request or headers or body
    { regex: /console\.(log|error|warn|info|debug)\s*\(\s*.*?\breq\b(?![\w.\[\]]*?\.(?:query|params|url|method|id|path))\b/i, label: "Logging raw request object" },
    { regex: /console\.(log|error|warn|info|debug)\s*\(\s*.*?\breq\.headers\b/i, label: "Logging raw request headers" },
    { regex: /console\.(log|error|warn|info|debug)\s*\(\s*.*?\breq\.body\b(?![\w.\[\]]*?\.(?:message))\b/i, label: "Logging raw request body" },
    { regex: /console\.(log|error|warn|info|debug)\s*\(\s*.*?\buserCredentials\b/i, label: "Logging raw userCredentials object" },

    // 2. Stringifying raw request, headers, or body
    { regex: /JSON\.stringify\s*\(\s*.*?\breq\b(?![\w.\[\]]*?\.(?:query|params|url|method|id|path))\b/i, label: "JSON.stringify on raw request object" },
    { regex: /JSON\.stringify\s*\(\s*.*?\breq\.headers\b/i, label: "JSON.stringify on raw request headers" },
    { regex: /JSON\.stringify\s*\(\s*.*?\breq\.body\b(?![\w.\[\]]*?\.(?:message))\b/i, label: "JSON.stringify on raw request body" },
    { regex: /JSON\.stringify\s*\(\s*.*?\buserCredentials\b/i, label: "JSON.stringify on raw userCredentials object" },

    // 3. Direct unscrubbed key logging
    { regex: /console\.(log|error|warn|info|debug)\s*\(\s*.*?\b(overrideKey|apiKey|userKey|serverKey)\b(?![\w.\[\]]*?\.(?:length|source))\b/i, label: "Logging raw API key variable without redaction" }
  ];

  let violations = [];

  for (const filePath of filesToScan) {
    const relPath = path.relative(backendDir, filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      // Exclude comments
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

      for (const pattern of unsafePatterns) {
        if (pattern.regex.test(line)) {
          // Exceptions check (e.g. if explicitly guarded or checking source)
          if (line.includes('[Orchestrator] Attempting generation with provider:') && line.includes('source:')) {
            // Safe logging of source (source: user / server)
            continue;
          }
          if (line.includes('apiKey && errMessage.includes(apiKey)')) {
            // Guard line in error redaction
            continue;
          }
          violations.push({
            file: relPath,
            lineNum: idx + 1,
            lineText: trimmed,
            label: pattern.label
          });
        }
      }
    });
  }

  console.log(`Scan completed. Total violations found: ${violations.length}\n`);

  if (violations.length > 0) {
    console.error("❌ STATIC LEAK-CHECK FAILED. Violations detected:");
    violations.forEach(v => {
      console.error(` - [${v.file}:${v.lineNum}] ${v.label}: "${v.lineText}"`);
    });
    process.exit(1);
  } else {
    console.log("✅ STATIC LEAK-CHECK PASSED: No raw credentials, headers, request objects, or user keys are logged or serialized in backend source files.");
    process.exit(0);
  }
}

runStaticLeakCheck();
