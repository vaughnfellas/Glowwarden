// ============= index.js (main entry point) =============
import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { startHealthServer } from './health-server.js';
import { loadCommands } from './commands/index.js';
import { loadEvents } from './events/index.js';
import { config } from './config.js';
import { initInviteRoleService } from './services/invite-role-service.js';
import { initSporeBoxService } from './services/sporebox-service.js';

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

// Login
client.login(config.DISCORD_TOKEN);