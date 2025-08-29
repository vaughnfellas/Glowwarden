// ============= index.js (main entry point) =============
import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { startHealthServer } from './health-server.js';
import { loadCommands } from './commands/index.js';
import { loadEvents } from './events/index.js';
import { config } from './config.js';

// Start health server
startHealthServer();

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// Load commands and events
loadCommands(client);
loadEvents(client);

// Login
client.login(config.TOKEN);