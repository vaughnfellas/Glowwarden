// ============= index.js (main entry point) =============

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
import { startHealthServer } from './src/health-server.js';
import { loadEvents } from './src/events/index.js';
import { config } from './src/config.js';
import { tempInvites } from './src/services/temp-vc-service.js';
import { commands, loadCommands } from './src/commands/index.js';

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

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites,
  ],
});

// Add debug logging to see connection attempts
client.on('debug', (info) => {
  if (info.includes('Heartbeat') || info.includes('Session') || info.includes('Ready') || 
      info.includes('Connect') || info.includes('Gateway')) {
    console.log(`Discord debug: ${info}`);
  }
});

// Expose command map for /glowwarden help
client.commands = commands;

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

// Wire command & event routers
console.log('Loading commands...');
loadCommands(client);
console.log('Loading events...');
loadEvents(client);

// Set up cleanup interval when ready
client.once('ready', () => {
  console.log(`🎯 Bot ready! Logged in as ${client.user.tag}`);
  
  // Start periodic cleanup
  setInterval(() => {
    cleanupExpiredInvites();
  }, 30 * 60 * 1000); // 30 minutes
});

// Add a periodic check to see if the bot is actually connected
setInterval(() => {
  const status = client.ws.status; // 0 = READY, other values indicate issues
  const readyAt = client.readyAt ? new Date(client.readyAt).toISOString() : 'Not ready';
  console.log(`Bot status check - WS Status: ${status}, Ready since: ${readyAt}`);
}, 60000); // Check every minute

// Start health server (for Render keepalive)
console.log('Starting health server...');
startHealthServer();

// Add login timeout detection
const loginTimeout = setTimeout(() => {
  console.error('⚠️ Discord login appears to be hanging (30 seconds with no response)');
  console.error('This could indicate rate limiting or network issues');
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
    // Don't exit process to keep health server running
  });

// Add connection debugging
client.on('error', (error) => {
  console.error('Discord client error:', error);
});

client.on('disconnect', (event) => {
  console.error('Discord client disconnected:', event);
});

client.on('reconnecting', () => {
  console.log('Discord client reconnecting...');
});

client.on('resume', () => {
  console.log('Discord client resumed');
});
