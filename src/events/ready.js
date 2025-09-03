// src/events/ready.js
import { Events, ActivityType, REST, Routes } from 'discord.js';
import { config } from '../config.js';
import { getAllCommandData } from '../commands/index.js';
import { initTempVCService, sweepTempRooms } from '../services/temp-vc-service.js';
import { initInviteRoleService } from '../services/invite-role-service.js';

export const name = Events.ClientReady;
export const once = true;

export async function execute(client) {
  console.log(`Ready! Logged in as ${client.user.tag}`);

  // Set bot presence
  client.user.setPresence({
    activities: [{ name: 'the Holy Gehy Empire', type: ActivityType.Watching }],
    status: 'online',
  });

  // Initialize services
  try {
    console.log('Initializing temp VC service...');
    initTempVCService(client);
    
    console.log('Initializing invite role service...');
    initInviteRoleService(client);
  } catch (error) {
    console.error('Error initializing services:', error);
  }

  // Deploy slash commands
  try {
    console.log('Started refreshing application (/) commands.');
    
    // Get all command data from the index
    const commands = getAllCommandData();
    console.log(`Found ${commands.length} commands to deploy:`, commands.map(c => c.name));
    
    const rest = new REST().setToken(config.DISCORD_TOKEN);
    
    const result = await rest.put(
      Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID),
      { body: commands },
    );
    
    console.log(`Successfully reloaded ${result.length} application (/) commands.`);
  } catch (error) {
    console.error('Error refreshing application commands:', error);
  }

  // Start periodic cleanup
  try {
    console.log('Starting periodic cleanup...');
    
    // Initial cleanup
    await sweepTempRooms();
    
    // Set up periodic sweep
    setInterval(async () => {
      try {
        await sweepTempRooms();
      } catch (error) {
        console.error('Error in periodic sweep:', error);
      }
    }, (config.SWEEP_INTERVAL_SEC || 600) * 1000);
    
    console.log(`Periodic cleanup scheduled every ${config.SWEEP_INTERVAL_SEC || 600} seconds`);
  } catch (error) {
    console.error('Error setting up periodic cleanup:', error);
  }

  console.log('Bot fully initialized and ready!');
}