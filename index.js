// ============= index.js (main entry point) =============
// index.js – must be first lines
import dotenv from 'dotenv';
dotenv.config({ path: '.env', override: true });
// Global error handlers
process.on('unhandledRejection', (err) => console.error('Unhandled promise rejection:', err));
process.on('uncaughtException', (err) => console.error('Uncaught exception:', err));

import { Client, GatewayIntentBits } from 'discord.js';

import { CHANNELS } from './src/channels.js';
import { startHealthServer } from './src/health-server.js';
import { loadEvents } from './src/events/index.js';
import { config } from './src/config.js';
import { tempInvites } from './src/services/temp-vc-service.js';

// ✅ correct path (was './commands/index.js')
import { commands, loadCommands } from './src/commands/index.js';

// Create Discord client FIRST
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites, // needed for invite tracking
  ],
});

// Expose command map for /glowwarden help
client.commands = commands;

// Function to clean up expired temp VC invites
function cleanupExpiredInvites() {
  const now = new Date();
  for (const [channelId, inviteData] of tempInvites.entries()) {
    if (inviteData.expiresAt && inviteData.expiresAt < now) {
      tempInvites.delete(channelId);
      console.log(`🧹 Cleaned up expired invite for channel ${channelId}`);
    }
  }
}

// Wire command & event routers
loadCommands(client);
loadEvents(client);

// Init services and cleanup when the bot is ready (guild caches available)
client.once('ready', () => {
  // periodic cleanup of expired invites
  setInterval(() => {
    cleanupExpiredInvites();
    console.log('Cleaned up expired tracked invites');
  }, 30 * 60 * 1000);

  console.log(`Logged in as ${client.user.tag}`);
});

// Start health server (for Render keepalive)
startHealthServer();

// Login
// Login (read directly from env and fail loudly)
 const token = process.env.DISCORD_TOKEN;
 if (!token) {
   console.error('❌ No DISCORD_TOKEN in env. Add it in Render → Environment.');
   process.exit(1);
 }
 client.login(token).catch(err => {
   console.error('❌ Login failed:', err);
   process.exit(1);
 });