// ============= index.js (main entry point) =============

// Add global error handlers at the very top
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  // Don't exit - just log the error
});

import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { CHANNELS } from './src/channels.js';
import { startHealthServer } from './src/health-server.js';
import { loadCommands } from './src/commands/index.js';
import { loadEvents } from './src/events/index.js';
import { config } from './src/config.js';
import { initVisitorDecreeService } from './src/services/visitor-decree-service.js';
import { initInviteRoleService } from './src/services/invite-role-service.js';
import { handleTrackedInviteJoin, cleanupExpiredInvites } from './src/services/invite-service.js';

// Import the consolidated interaction handler
import './src/events/interaction-handler.js';

// Start health server
startHealthServer();

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites, // ← Add this for invite tracking
  ],
});

// Load commands and events
loadCommands(client);
loadEvents(client); // Keep this if you have other events

// Initialize services before login
initInviteRoleService(client);
initVisitorDecreeService(client);

// Set up periodic cleanup of expired invites (every 30 minutes)
setInterval(() => {
  cleanupExpiredInvites();
  console.log('Cleaned up expired tracked invites');
}, 30 * 60 * 1000);

// Login
client.login(config.DISCORD_TOKEN);