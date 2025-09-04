// src/events/ready.js
import { Events, ActivityType, REST, Routes } from 'discord.js';
import { config } from '../config.js';
import { getAllCommandData } from '../commands/index.js';
import { initTempVCService, sweepTempRooms } from '../services/temp-vc-service.js';
import { initInviteRoleService } from '../services/invite-role-service.js';

export const name = Events.ClientReady;
export const once = true;

export async function execute(client) {
  try {
    console.log(`Ready! Logged in as ${client.user.tag}`);

    // Set bot presence
    try {
      client.user.setPresence({
        activities: [{ name: 'the Holy Gehy Empire', type: ActivityType.Watching }],
        status: 'online',
      });
      console.log('Bot presence set successfully');
    } catch (presenceError) {
      console.error('Error setting bot presence:', presenceError);
    }

    // Initialize services
    const serviceErrors = [];
    
    try {
      console.log('Initializing temp VC service...');
      await initTempVCService(client);
      console.log('Temp VC service initialized successfully');
    } catch (tempVCError) {
      console.error('Error initializing temp VC service:', tempVCError);
      serviceErrors.push('TempVC');
    }
    
    try {
      console.log('Initializing invite role service...');
      await initInviteRoleService(client);
      console.log('Invite role service initialized successfully');
    } catch (inviteRoleError) {
      console.error('Error initializing invite role service:', inviteRoleError);
      serviceErrors.push('InviteRole');
    }

    if (serviceErrors.length > 0) {
      console.warn(`Some services failed to initialize: ${serviceErrors.join(', ')}`);
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
    } catch (commandError) {
      console.error('Error refreshing application commands:', commandError);
      console.error('Bot will continue running, but commands may not be available');
    }

    // Start periodic cleanup
    try {
      console.log('Starting periodic cleanup...');
      
      // Initial cleanup
      try {
        await sweepTempRooms();
        console.log('Initial cleanup completed successfully');
      } catch (initialCleanupError) {
        console.error('Error in initial cleanup:', initialCleanupError);
      }
      
      // Set up periodic sweep
      const sweepInterval = (config.SWEEP_INTERVAL_SEC || 600) * 1000;
      setInterval(async () => {
        try {
          await sweepTempRooms();
          console.log('Periodic cleanup completed');
        } catch (periodicCleanupError) {
          console.error('Error in periodic sweep:', periodicCleanupError);
        }
      }, sweepInterval);
      
      console.log(`Periodic cleanup scheduled every ${config.SWEEP_INTERVAL_SEC || 600} seconds`);
    } catch (cleanupError) {
      console.error('Error setting up periodic cleanup:', cleanupError);
      console.warn('Periodic cleanup disabled - manual cleanup may be required');
    }

    console.log('Bot fully initialized and ready!');
    
  } catch (criticalError) {
    console.error('Critical error in ready event:', criticalError);
    console.error('Bot may not function properly');
  }
}