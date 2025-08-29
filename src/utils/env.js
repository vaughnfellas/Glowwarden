// ============= src/utils/env.js =============
import 'dotenv/config';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

export const ENV = {
  // Required
  TOKEN: requireEnv('DISCORD_TOKEN'),
  CLIENT_ID: requireEnv('CLIENT_ID'),
  SPORE_BOX_CHANNEL_ID: requireEnv('SPORE_BOX_CHANNEL_ID'),
  
  // Optional
  GUILD_ID: process.env.GUILD_ID, // optional for global deploy
  DEFAULT_USES: parseInt(process.env.DEFAULT_USES || '4', 10),
  MAX_USES: parseInt(process.env.MAX_USES || '10', 10),
  
  // Temp VCs
  LOBBY_VC_ID: process.env.LOBBY_VC_ID,
  TEMP_VC_CATEGORY_ID: process.env.TEMP_VC_CATEGORY_ID,
  TEMP_VC_NAME_FMT: process.env.TEMP_VC_NAME_FMT || 'War Chamber — {user}',
  TEMP_VC_DELETE_AFTER: Number(process.env.TEMP_VC_DELETE_AFTER || 300),
  TEMP_VC_USER_LIMIT: process.env.TEMP_VC_USER_LIMIT ? parseInt(process.env.TEMP_VC_USER_LIMIT, 10) : null,
  
  // Roles & Channels
  TEMP_HOST_ROLE_ID: process.env.TEMP_HOST_ROLE_ID,
  LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID,
  
  // Sweep
  SWEEP_CRON: process.env.SWEEP_CRON || '*/10 * * * *',
  
  // Server
  PORT: process.env.PORT || 3000,
};