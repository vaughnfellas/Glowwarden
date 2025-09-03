// ============= src/config.js =============
import 'dotenv/config';
import { CHANNELS } from './channels.js';

const toBool = (v, d = false) => {
  if (v === undefined || v === null || v === '') return d;
  const s = String(v).toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'on';
};
const toInt = (v, d) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
};
const snowflake = v => (v && /^\d{17,20}$/.test(String(v))) ? String(v) : '';

function parseInviteRoleMap(s) {
  const map = {};
  if (!s) return map;
  for (const pair of s.split(',').map(x => x.trim()).filter(Boolean)) {
    const [code, role] = pair.split(':').map(x => x.trim());
    if (code && snowflake(role)) map[code] = role;
  }
  return map;
}

export const config = {
  // Core env
  DISCORD_TOKEN: process.env.DISCORD_TOKEN || '',
  CLIENT_ID: process.env.CLIENT_ID || '',
  GUILD_ID: snowflake(process.env.GUILD_ID),
  BOT_USER_ID: snowflake(process.env.BOT_USER_ID),

  // Owner IDs
  OWNER_IDS: process.env.OWNER_IDS?.split(',').map(id => id.trim()) || [],
  OWNER_ID: process.env.OWNER_IDS?.split(',')[0]?.trim() || '',

  // Core channels - prefer .env, fallback to channels.js
  DECREE_CHANNEL_ID: process.env.DECREE_CHANNEL_ID || CHANNELS.CHAMBER_OF_OATHS,
  LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID || CHANNELS.HALL_OF_RECORDS,
  
  // Temp VC settings - use spec naming with fallbacks
  RENT_WAR_CHAMBER_VC_ID: process.env.RENT_WAR_CHAMBER_VC_ID || process.env.LOBBY_VC_ID || CHANNELS.RENT_A_WAR_CHAMBER,
  BATTLEFRONT_CATEGORY_ID: process.env.BATTLEFRONT_CATEGORY_ID || process.env.TEMP_VC_CATEGORY_ID || CHANNELS.BATTLEFRONT,
  EMPTY_MINUTES: toInt(process.env.EMPTY_MINUTES, 5),
  
  // Server settings
  PORT: toInt(process.env.PORT, 3000),
  TEMP_VC_DELETE_AFTER: toInt(process.env.TEMP_VC_DELETE_AFTER, 300), // 5 minutes
  TEMP_VC_USER_LIMIT: toInt(process.env.TEMP_VC_USER_LIMIT, 0) || undefined,
  TEMP_VC_NAME_FMT: process.env.TEMP_VC_NAME_FMT || 'War Chamber — {user}',
  SWEEP_INTERVAL_SEC: toInt(process.env.SWEEP_INTERVAL_SEC, 600),

  // Role IDs - use spec naming
  ROLE_HOST_ID: snowflake(process.env.TEMP_HOST_ROLE_ID), // Temp host role
  TEMP_HOST_ROLE_ID: snowflake(process.env.TEMP_HOST_ROLE_ID), // Keep backward compatibility
  ROLE_STRAY_SPORE_ID: snowflake(process.env.STRAY_SPORE_ROLE_ID),
  STRAY_SPORE_ROLE_ID: snowflake(process.env.STRAY_SPORE_ROLE_ID), // Keep backward compatibility
  
  // Base roles
  ROLE_BASE_MEMBER: snowflake(process.env.ROLE_BASE_MEMBER),
  ROLE_BASE_OFFICER: snowflake(process.env.ROLE_BASE_OFFICER),
  ROLE_BASE_VETERAN: snowflake(process.env.ROLE_BASE_VETERAN),

  // Final roles
  ROLE_FINAL_MYCE: snowflake(process.env.ROLE_FINAL_MYCE),
  ROLE_FINAL_GALLIES: snowflake(process.env.ROLE_FINAL_GALLIES),
  ROLE_FINAL_GCRUS: snowflake(process.env.ROLE_FINAL_GCRUS),
  ROLE_FINAL_BBEAR: snowflake(process.env.ROLE_FINAL_BBEAR),
  ROLE_FINAL_RAPO: snowflake(process.env.ROLE_FINAL_RAPO),
  ROLE_FINAL_RALLYLT: snowflake(process.env.ROLE_FINAL_RALLYLT),

  // Flair roles
  ROLE_LGBTQ: snowflake(process.env.ROLE_LGBTQ),
  ROLE_ALLY: snowflake(process.env.ROLE_ALLY),

  // Ceremony settings
  CEREMONY_REMOVE_BASE_ON_FINAL: toBool(process.env.CEREMONY_REMOVE_BASE_ON_FINAL, true),

  // Invite → role mapping
  INVITE_ROLE_MAP: parseInviteRoleMap(process.env.INVITE_ROLE_MAP),
  INVITE_DEFAULT_ROLE_ID: snowflake(process.env.INVITE_DEFAULT_ROLE_ID),

  // Legacy settings
  MAX_USES: toInt(process.env.MAX_USES, 10),
  DEFAULT_USES: toInt(process.env.DEFAULT_USES, 4),
};

// Validation and warnings
console.log('=== Config Validation ===');
console.log('GUILD_ID:', config.GUILD_ID || '❌ MISSING');
console.log('BOT_USER_ID:', config.BOT_USER_ID || '❌ MISSING');
console.log('RENT_WAR_CHAMBER_VC_ID:', config.RENT_WAR_CHAMBER_VC_ID || '❌ MISSING');
console.log('BATTLEFRONT_CATEGORY_ID:', config.BATTLEFRONT_CATEGORY_ID || '❌ MISSING');
console.log('ROLE_HOST_ID:', config.ROLE_HOST_ID || '❌ MISSING');
console.log('ROLE_STRAY_SPORE_ID:', config.ROLE_STRAY_SPORE_ID || '❌ MISSING');
console.log('========================');