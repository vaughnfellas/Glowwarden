// index.js (main entry point)
import { Events } from 'discord.js';

// Global error handlers - log but don't exit
process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

import { Client, GatewayIntentBits } from 'discord.js';
import { loadEvents } from './src/events/index.js';
import { config } from './src/config.js';
import { loadCommands } from './src/commands/index.js';
import { supabase } from './src/db.js';

function setupShutdown(client) {
  const shutdown = async (signal) => {
    console.log(`[SHUTDOWN] Received ${signal}, initiating graceful shutdown...`);
    try {
      if (typeof supabase.removeAllSubscriptions === 'function') {
        await supabase.removeAllSubscriptions();
      } else if (typeof supabase.removeAllChannels === 'function') {
        await supabase.removeAllChannels();
      } else {
        for (const ch of supabase.getChannels?.() || []) {
          await ch.unsubscribe?.();
        }
      }
      await client.destroy?.();
      console.log('[SHUTDOWN] Cleanup completed successfully');
    } catch (e) {
      console.error('[SHUTDOWN] Warning during cleanup:', e?.message ?? e);
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Validate token FIRST
const token = process.env.DISCORD_TOKEN || config.DISCORD_TOKEN;
console.log('[INIT] Token validation:', {
  exists: !!token,
  length: token?.length || 0,
  prefix: token?.substring(0, 10) || 'NONE'
});
if (!token) {
  console.error('[ERROR] No DISCORD_TOKEN found in environment or config');
  process.exit(1);
}

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites,
  ],
});

// Wiring & lifecycle
setupShutdown(client);
client.on('shardDisconnect', (event, id) => {
  console.warn(`[SHARD] Shard ${id} disconnected: ${event.code} ${event.reason || ''}`);
});
client.on('warn', (m) => console.warn('[DISCORD] Warning:', m));
client.on('error', (e) => console.error('[DISCORD] Error:', e));

console.log('[INIT] Loading commands...');
loadCommands(client);
console.log('[INIT] Loading events...');
loadEvents(client); // <-- ready handler will do the rest

// Login
console.log('[LOGIN] Attempting Discord login...');
const loginTimeout = setTimeout(() => {
  console.error('[LOGIN] Timeout after 30s - possible rate limit or network issue');
}, 30000);

client.login(token)
  .then(() => {
    clearTimeout(loginTimeout);
    console.log('[LOGIN] Request sent to Discord');
  })
  .catch(err => {
    clearTimeout(loginTimeout);
    console.error('[LOGIN] Failed:', {
      name: err.name,
      message: err.message,
      code: err.code,
      httpStatus: err.httpStatus
    });
  });

client.on('shardReady', (id) => console.log(`[SHARD] Shard ${id} ready`));
client.on('shardResume', (id, replayed) => console.log(`[SHARD] Shard ${id} resumed (replayed=${replayed})`));
