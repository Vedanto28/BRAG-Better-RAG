import pg from 'pg';
import dns from 'dns';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const resolver = new dns.promises.Resolver();
try {
  resolver.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

let pool = null;
let resolvedHostConfig = null;

async function getPoolConfig() {
  if (resolvedHostConfig) return resolvedHostConfig;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return null;
  }

  try {
    const url = new URL(connectionString);
    const originalHostname = url.hostname;

    let targetHost = originalHostname;
    try {
      const addresses = await resolver.resolve4(originalHostname);
      if (addresses && addresses.length > 0) {
        targetHost = addresses[0];
      }
    } catch (dnsErr) {
      // Fallback to original hostname if custom resolver fails
    }

    resolvedHostConfig = {
      host: targetHost,
      port: parseInt(url.port || '5432', 10),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, '') || 'neondb',
      ssl: {
        rejectUnauthorized: false,
        servername: originalHostname
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

    return resolvedHostConfig;
  } catch (err) {
    console.error('[DB] Error parsing DATABASE_URL:', err.message);
    return null;
  }
}

export async function getPool() {
  if (!pool) {
    const config = await getPoolConfig();
    if (!config) {
      console.warn('[DB] DATABASE_URL not configured. Operating in fallback mode.');
      return null;
    }

    pool = new Pool(config);

    pool.on('error', (err) => {
      console.error('[DB] Unexpected error on idle pool client:', err.message || err);
    });
  }

  return pool;
}

/**
 * Execute a parameterized query against PostgreSQL.
 * @param {string} text SQL statement
 * @param {any[]} [params] Parameter array
 * @returns {Promise<pg.QueryResult>}
 */
export async function query(text, params = []) {
  const p = await getPool();
  if (!p) {
    return { rows: [], rowCount: 0 };
  }
  const start = Date.now();
  try {
    const res = await p.query(text, params);
    const duration = Date.now() - start;
    if (process.env.DEBUG_DB) {
      console.log('[DB] executed query', { text: text.slice(0, 50), duration, rows: res.rowCount });
    }
    return res;
  } catch (err) {
    console.error('[DB] Query execution error:', { text: text.slice(0, 80), error: err.message });
    throw err;
  }
}

/**
 * Check connectivity to PostgreSQL.
 * @returns {Promise<boolean>}
 */
export async function checkDbHealth() {
  try {
    const res = await query('SELECT 1 as health_check');
    return res.rows?.length > 0;
  } catch (err) {
    return false;
  }
}
