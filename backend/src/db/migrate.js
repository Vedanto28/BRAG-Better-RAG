import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  console.log('[DB Migration] Running schema migrations...');
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    console.log(`[DB Migration] Applying ${file}...`);
    const sqlContent = fs.readFileSync(filePath, 'utf8');

    // Execute statements in the migration file
    await query(sqlContent);
    console.log(`[DB Migration] Successfully applied ${file}`);
  }
  console.log('[DB Migration] All migrations complete.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[DB Migration] Migration failed:', err);
      process.exit(1);
    });
}
