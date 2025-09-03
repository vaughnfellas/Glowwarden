import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

// Supabase requires proper SSL configuration
const isProduction = process.env.NODE_ENV === 'production';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  // Add connection limits for better stability
  max: 20, // Maximum connections in pool
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 2000, // Fail fast if can't connect within 2 seconds
});

// Test connection on startup
pool.connect()
  .then(client => {
    console.log('✅ Database connected successfully');
    return client.query('SELECT NOW()');
  })
  .then(result => {
    console.log('📅 Database time:', result.rows[0].now);
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
    console.error('Full error:', err);
  })
  .finally(() => {
    // Don't close the pool here, just the test client
  });

export const query = (text, params) => pool.query(text, params);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🔄 Shutting down database pool...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🔄 Shutting down database pool...');
  await pool.end();
  process.exit(0);
});