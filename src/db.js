// src/db.js
import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const isProduction = process.env.NODE_ENV === 'production';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  // Pool tuning (optional, keep if useful)
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

// Optional: quick connectivity check (logs at boot)
pool.connect()
  .then(client => client.query('SELECT NOW()').finally(() => client.release()))
  .then(res => console.log('✅ DB up. Time:', res.rows?.[0]?.now))
  .catch(err => {
    console.error('❌ DB connection failed:', err.message);
    console.error(err);
  });

// Primary query helper
export const query = (text, params) => pool.query(text, params);

// Back-compat facade so legacy `import { db }` still works
export const db = { query, pool };

// Graceful shutdown
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    console.log('🔄 Shutting down database pool...');
    try { await pool.end(); } finally { process.exit(0); }
  });
}
