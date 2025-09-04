// index.js (main entry point)
import { Events } from 'discord.js';

// Global error handlers - log but don't exit
process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection:', err);
  // Don't exit on errors to keep the service running
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  // Don't exit on errors to keep the service running
});

import { Client, GatewayIntentBits } from 'discord.js';
import { loadEvents } from './src/events/index.js';
import { config } from './src/config.js';
import { tempInvites } from './src/services/temp-vc-service.js';
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
        for (const ch of supabase.getChannels()) {
          await ch.unsubscribe?.();
        }
      }
      if (client?.destroy) {
        await client.destroy();
      }
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

// Track reconnection attempts
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
let reconnectTimeout = null;

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites,
  ],
});

// Fixed: Proper event handler syntax
client.once(Events.ClientReady, () => {
  console.log(`[READY] Bot ready as ${client.user.tag}`);
});

client.on('shardReady', (id) => {
  console.log(`[SHARD] Shard ${id} ready`);
});

client.on('shardResume', (id, replayed) => {
  console.log(`[SHARD] Shard ${id} resumed (replayed=${replayed})`);
});

// Set up shutdown handlers now that we have client
setupShutdown(client);

client.on('shardDisconnect', (event, id) => {
  console.warn(`[SHARD] Shard ${id} disconnected: ${event.code} ${event.reason || ''}`);
});

client.on('warn', (m) => console.warn('[DISCORD] Warning:', m));
client.on('error', (e) => console.error('[DISCORD] Error:', e));

// Function to clean up expired temp VC invites
function cleanupExpiredInvites() {
  const now = new Date();
  let cleanedCount = 0;
  for (const [channelId, inviteData] of tempInvites.entries()) {
    if (inviteData.expiresAt && inviteData.expiresAt < now) {
      tempInvites.delete(channelId);
      cleanedCount++;
    }
  }
  if (cleanedCount > 0) {
    console.log(`[CLEANUP] Removed ${cleanedCount} expired invites`);
  }
}

// Reconnection function with exponential backoff
function attemptReconnect() {
  if (reconnectAttempts >= maxReconnectAttempts) {
    console.error(`[RECONNECT] Maximum attempts (${maxReconnectAttempts}) reached`);
    return;
  }
  
  reconnectAttempts++;
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts + 2), 30 * 60 * 1000); // Between 8s and 30min
  
  console.log(`[RECONNECT] Attempt ${reconnectAttempts}/${maxReconnectAttempts} in ${delay/1000}s`);
  
  // Clear any existing timeout
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }
  
  reconnectTimeout = setTimeout(() => {
    console.log('Reconnecting to Discord...');
    client.login(token)
      .then(() => {
        console.log('[RECONNECT] Success');
        reconnectAttempts = 0;
      })
      .catch(err => {
        console.error('[RECONNECT] Failed:', err.message);
        attemptReconnect(); // Try again with increased backoff
      });
  }, delay);
}

// Wire command & event routers
console.log('[INIT] Loading commands...');
loadCommands(client);
console.log('[INIT] Loading events...');
loadEvents(client);

// Set up cleanup interval when ready (Fixed: removed duplicate event handler)
client.once(Events.ClientReady, () => {
  console.log(`[READY] Logged in as ${client.user.tag}`);
  
  // Reset reconnection attempts on successful connection
  reconnectAttempts = 0;
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  
  // Start periodic cleanup with a longer interval
  setInterval(() => {
    cleanupExpiredInvites();
  }, 60 * 60 * 1000); // 60 minutes
});

// Add login timeout detection
const loginTimeout = setTimeout(() => {
  console.error('[LOGIN] Timeout after 30s - possible rate limit or network issue');
  // Don't attempt immediate reconnection - wait for disconnect event
}, 30000);

// Login with proper error handling
console.log('[LOGIN] Attempting Discord login...');
client.login(token)
  .then(() => {
    clearTimeout(loginTimeout); // Clear the timeout on success
    console.log('[LOGIN] Request sent to Discord');
  })
  .catch(err => {
    clearTimeout(loginTimeout); // Clear the timeout on error
    console.error('[LOGIN] Failed:', {
      name: err.name,
      message: err.message,
      code: err.code,
      httpStatus: err.httpStatus
    });
    
    // Attempt reconnection after initial failure
    attemptReconnect();
  });

// Add connection debugging with reconnection logic
client.on('error', (error) => {
  console.error('[DISCORD] Client error:', error);
});

client.on('disconnect', (event) => {
  console.error('[DISCORD] Disconnected:', event);
  
  // If we're disconnected (status 3), attempt reconnection with backoff
  if (client.ws.status === 3) {
    console.log('[DISCORD] Connection lost, scheduling reconnection');
    attemptReconnect();
  }
});

client.on('reconnecting', () => {
  console.log('[DISCORD] Reconnecting...');
});

client.on('resume', () => {
  console.log('[DISCORD] Resumed');
  // Reset reconnection attempts on successful resume
  reconnectAttempts = 0;
});