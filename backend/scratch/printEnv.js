import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const envPath = path.resolve(projectRoot, '.env');
console.log("Reading raw .env file directly:");
console.log(fs.readFileSync(envPath, 'utf8'));

console.log("\nAll process.env keys containing GITHUB, CONTEXT, KEY, or MCP:");
for (const key of Object.keys(process.env)) {
  if (key.includes('GITHUB') || key.includes('CONTEXT') || key.includes('KEY') || key.includes('MCP') || key.includes('LLM')) {
    console.log(`  ${key} = ${process.env[key] ? "[SET]" : "[EMPTY]"}`);
  }
}
