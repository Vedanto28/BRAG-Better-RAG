import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const execPromise = promisify(exec);
const currentFilePath = fileURLToPath(import.meta.url);
const scratchDir = path.dirname(currentFilePath);
const clonedReposDir = path.resolve(scratchDir, 'cloned_repos');

const repos = [
  { name: 'khaata-Kitab-', url: 'https://github.com/Vedanto28/khaata-Kitab-.git' },
  { name: 'CorpNest', url: 'https://github.com/Vedanto28/CorpNest.git' },
  { name: 'watchly.ai', url: 'https://github.com/Vedanto28/watchly.ai.git' },
  { name: 'express', url: 'https://github.com/expressjs/express.git' }
];

async function main() {
  if (!fs.existsSync(clonedReposDir)) {
    fs.mkdirSync(clonedReposDir, { recursive: true });
  }

  for (const repo of repos) {
    const destPath = path.join(clonedReposDir, repo.name);
    if (fs.existsSync(destPath)) {
      console.log(`Repository ${repo.name} already exists. Skipping clone.`);
      continue;
    }

    console.log(`Cloning ${repo.name} from ${repo.url}...`);
    try {
      // Clone only the latest commit to speed up cloning
      await execPromise(`git clone --depth 1 ${repo.url} "${destPath}"`);
      console.log(`Successfully cloned ${repo.name}`);
    } catch (err) {
      console.error(`Failed to clone ${repo.name}:`, err.message);
    }
  }
}

main().catch(console.error);
