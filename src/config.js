// src/config.js
// ESM-friendly config loader with env normalization + validation
import 'dotenv/config';
import { ROLES, ROLE_COMPATIBILITY } from './roles.js';

const bool = (v, d = false) => {
  if (v == null) return d;
  const s = String(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'y';
};
const num = (v, d) => (v == null || v === '' || Number.isNaN(Number(v)) ? d : Number(v));
const list = (v) => (v ? String(v).split(/[,\s]+/).filter(Boolean) : []);

// Base config with environment variables
const baseConfig = {
  // Core Discord
  CLIENT_ID: process.env.CLIENT_ID,
  BOT_USER_ID: process.env.BOT_USER_ID,
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  GUILD_ID: process.env.GUILD_ID,
  OWNER_IDS: list(process.env.OWNER_IDS),
  ROLE_LORD_PROTECTOR_ID: process.env.ROLE_LORD_PROTECTOR_ID,
  // Channels / Categories
  LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID,
  DECREE_CHANNEL_ID: process.env.DECREE_CHANNEL_ID,
  RENT_WAR_CHAMBER_VC_ID: process.env.RENT_WAR_CHAMBER_VC_ID,
  BATTLEFRONT_CATEGORY_ID: process.env.BATTLEFRONT_CATEGORY_ID,

  // Roles (base/flair/final)
  ROLE_LGBTQ: process.env.ROLE_LGBTQ,
  ROLE_ALLY: process.env.ROLE_ALLY,
  ROLE_BASE_MEMBER: process.env.ROLE_BASE_MEMBER,
  ROLE_BASE_OFFICER: process.env.ROLE_BASE_OFFICER,
  ROLE_BASE_VETERAN: process.env.ROLE_BASE_VETERAN,

  ROLE_FINAL_MYCE: process.env.ROLE_FINAL_MYCE,
  ROLE_FINAL_GALLIES: process.env.ROLE_FINAL_GALLIES,
  ROLE_FINAL_GCRUS: process.env.ROLE_FINAL_GCRUS,
  ROLE_FINAL_BBEAR: process.env.ROLE_FINAL_BBEAR,
  ROLE_FINAL_RAPO: process.env.ROLE_FINAL_RAPO,
  ROLE_FINAL_RALLYLT: process.env.ROLE_FINAL_RALLYLT,

  // Temp VC roles (normalize to names your code expects)
  ROLE_STRAY_SPORE_ID: process.env.STRAY_SPORE_ROLE_ID,
  ROLE_HOST_ID: process.env.TEMP_HOST_ROLE_ID,
  HOST_ALERT_ROLE_ID: process.env.HOST_ALERT_ROLE_ID,

  // Temp VC settings
  EMPTY_MINUTES: num(process.env.EMPTY_MINUTES, 2),
  DEFAULT_USES: num(process.env.DEFAULT_USES, 0),
  MAX_USES: num(process.env.MAX_USES, 0),
  TEMP_VC_NAME_FMT: process.env.TEMP_VC_NAME_FMT || 'War Chamber --- {user}',
  TEMP_VC_DELETE_AFTER: num(process.env.TEMP_VC_DELETE_AFTER, 300),
  TEMP_VC_USER_LIMIT: num(process.env.TEMP_VC_USER_LIMIT, 0),
  SWEEP_INTERVAL_SEC: num(process.env.SWEEP_INTERVAL_SEC, 600),

  CEREMONY_REMOVE_BASE_ON_FINAL: bool(process.env.CEREMONY_REMOVE_BASE_ON_FINAL, false),
  PUBLIC_ACK: bool(process.env.PUBLIC_ACK, false),

  NODE_ENV: process.env.NODE_ENV || 'development',

  // Supabase (primary database)
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,

  // Legacy PostgreSQL (deprecated - remove if not used elsewhere)
  DATABASE_URL: process.env.DATABASE_URL,
};

// Merge with role compatibility layer for backward compatibility
export const config = {
  ...baseConfig,
  ...ROLE_COMPATIBILITY
};

// Required environment variables for core functionality
const REQUIRED = [
  'DISCORD_TOKEN',
  'CLIENT_ID',
  'GUILD_ID',
  'RENT_WAR_CHAMBER_VC_ID',
  'BATTLEFRONT_CATEGORY_ID',
  'SUPABASE_URL',           // Required for database
  'SUPABASE_SERVICE_KEY',   // Required for database
];

const missing = REQUIRED.filter((k) => !config[k]);
if (missing.length) {
  console.error('[config] Missing required env keys:', missing.join(', '));
  console.error('\n💡 Make sure you have set up your Supabase project and added these to your .env file:');
  console.error('SUPABASE_URL=https://your-project.supabase.co');
  console.error('SUPABASE_SERVICE_KEY=your-service-role-key');
  
  // Fail fast in production; continue in dev if you prefer
  if (config.NODE_ENV !== 'development') {
    process.exit(1);
  }
}

// Validate Supabase URL format
if (config.SUPABASE_URL && !config.SUPABASE_URL.includes('supabase.co')) {
  console.warn('⚠️ SUPABASE_URL doesn\'t look like a valid Supabase URL');
}

console.log('📋 Config loaded:');
console.log('- Environment:', config.NODE_ENV);
console.log('- Discord Token:', config.DISCORD_TOKEN ? '✅ Present' : '❌ Missing');
console.log('- Supabase URL:', config.SUPABASE_URL ? '✅ Present' : '❌ Missing');
console.log('- Supabase Service Key:', config.SUPABASE_SERVICE_KEY ? '✅ Present' : '❌ Missing');
