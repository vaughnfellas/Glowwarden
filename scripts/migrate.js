import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const sql = `
create extension if not exists pgcrypto;

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  class text,
  realm text,
  is_main boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists characters_user_id_idx on public.characters(user_id);

alter table public.characters enable row level security;
`;

try {
  await pool.query(sql);
  console.log('✅ Migration complete');
} catch (e) {
  console.error('❌ Migration failed:', e);
} finally {
  await pool.end();
}
