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
import { initInviteRoleService } from './src/services/invite-role-service.js';
import { initSporeBoxService } from './src/services/sporebox-service.js';
import { initVisitorDecreeService } from './src/services/visitor-decree-service.js';

// Start health server
startHealthServer();

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

// Load commands and events
loadCommands(client);
loadEvents(client);

// Initialize services before login
initInviteRoleService(client);
initSporeBoxService(client);
initVisitorDecreeService(client);

// Login
client.login(config.DISCORD_TOKEN);