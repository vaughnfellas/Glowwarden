// ============= index.js (main entry point) =============

// Global error handlers
process.on('unhandledRejection', (err) => console.error('Unhandled promise rejection:', err));
process.on('uncaughtException', (err) => console.error('Uncaught exception:', err));

import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';

import { CHANNELS } from './src/channels.js';
import { startHealthServer } from './src/health-server.js';
import { loadEvents } from './src/events/index.js';
import { config } from './src/config.js';
import { initVisitorDecreeService } from './src/services/visitor-decree-service.js';
import { initInviteRoleService } from './src/services/invite-role-service.js';
import { handleTrackedInviteJoin, cleanupExpiredInvites } from './src/services/invite-service.js';

// ✅ correct path (was './commands/index.js')
import { commands, loadCommands } from './src/commands/index.js';

// ❌ REMOVE: this would double-register handlers if it attaches listeners on import
// import './src/events/interaction-handler.js';

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

// Wire command & event routers
loadCommands(client);
loadEvents(client);

// Init services when the bot is ready (guild caches available)
client.once('ready', () => {
  initInviteRoleService(client);
  initVisitorDecreeService(client);

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
client.login(config.DISCORD_TOKEN);
