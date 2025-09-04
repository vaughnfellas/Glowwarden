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
import { CHANNELS } from './src/channels.js';
import { loadEvents } from './src/events/index.js';
import { config } from './src/config.js';
import { tempInvites } from './src/services/temp-vc-service.js';
import { loadCommands } from './src/commands/index.js';
import { supabase } from './src/db.js';

function setupShutdown() {
  const shutdown = async (signal) => {
    console.log('🔄 Shutting down Supabase connections..');
    try {
      await supabase.removeAllSubscriptions?.();
    } catch (e) {
      console.error('Supabase shutdown warning:', e?.message ?? e);
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
setupShutdown();

// Validate token FIRST
const token = process.env.DISCORD_TOKEN || config.DISCORD_TOKEN;
console.log('Token validation:');
console.log('- Token exists:', !!token);
console.log('- Token length:', token?.length || 0);
console.log('- Token starts with:', token?.substring(0, 10) || 'NONE');

if (!token) {
  console.error('❌ No DISCORD_TOKEN found in environment or config');
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
  console.log(`✅ Ready as ${client.user.tag}`);
});

client.on('shardReady', (id) => {
  console.log(`🟢 Shard ${id} ready`);
});

client.on('shardResume', (id, replayed) => {
  console.log(`🔄 Shard ${id} resumed (replayed=${replayed})`);
});

client.on('shardDisconnect', (event, id) => {
  console.warn(`🟥 Shard ${id} disconnected: ${event.code} ${event.reason || ''}`);
});

client.on('warn', (m) => console.warn('⚠️ DJS warn:', m));
client.on('error', (e) => console.error('💥 DJS error:', e));

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
    console.log(`🧹 Cleaned up ${cleanedCount} expired invites`);
  }
}

// Reconnection function with exponential backoff
function attemptReconnect() {
  if (reconnectAttempts >= maxReconnectAttempts) {
    console.error(`❌ Maximum reconnection attempts (${maxReconnectAttempts}) reached. Giving up.`);
    return;
  }
  
  reconnectAttempts++;
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts + 2), 30 * 60 * 1000); // Between 8s and 30min
  
  console.log(`Attempting to reconnect to Discord (attempt ${reconnectAttempts}/${maxReconnectAttempts}) in ${delay/1000} seconds...`);
  
  // Clear any existing timeout
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }
  
  reconnectTimeout = setTimeout(() => {
    console.log('Reconnecting to Discord...');
    client.login(token)
      .then(() => {
        console.log('✅ Reconnection successful');
        reconnectAttempts = 0;
      })
      .catch(err => {
        console.error('❌ Reconnection failed:', err.message);
        attemptReconnect(); // Try again with increased backoff
      });
  }, delay);
}

// Wire command & event routers
console.log('Loading commands...');
loadCommands(client);
console.log('Loading events...');
loadEvents(client);

// Set up cleanup interval when ready (Fixed: removed duplicate event handler)
client.once(Events.ClientReady, () => {
  console.log(`🎯 Bot ready! Logged in as ${client.user.tag}`);
  
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
  console.error('⚠️ Discord login appears to be hanging (30 seconds with no response)');
  console.error('This could indicate rate limiting or network issues');
  // Don't attempt immediate reconnection - wait for disconnect event
}, 30000);

// Login with proper error handling
console.log('Attempting Discord login...');
client.login(token)
  .then(() => {
    clearTimeout(loginTimeout); // Clear the timeout on success
    console.log('✅ Login request sent to Discord');
  })
  .catch(err => {
    clearTimeout(loginTimeout); // Clear the timeout on error
    console.error('❌ Discord login failed:');
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    console.error('Error code:', err.code);
    console.error('HTTP status:', err.httpStatus);
    console.error('Full error:', JSON.stringify(err, null, 2));
    
    // Attempt reconnection after initial failure
    attemptReconnect();
  });

// Add connection debugging with reconnection logic
client.on('error', (error) => {
  console.error('Discord client error:', error);
});

client.on('disconnect', (event) => {
  console.error('Discord client disconnected:', event);
  
  // If we're disconnected (status 3), attempt reconnection with backoff
  if (client.ws.status === 3) {
    console.log('Discord connection in DISCONNECTED state, scheduling reconnection');
    attemptReconnect();
  }
});

client.on('reconnecting', () => {
  console.log('Discord client reconnecting...');
});

client.on('resume', () => {
  console.log('Discord client resumed');
  // Reset reconnection attempts on successful resume
  reconnectAttempts = 0;
});