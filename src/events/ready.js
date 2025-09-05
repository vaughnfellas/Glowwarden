// src/events/ready.js
import { Events, ActivityType, REST, Routes } from 'discord.js';
import { config } from '../config.js';
import { getAllCommandData } from '../commands/index.js';
import { initTempVCService, sweepTempRooms } from '../services/temp-vc-service.js';
import { initInviteRoleService } from '../services/invite-role-service.js';
import { ensureDecreeExists } from '../services/oath-service.js';

export const name = Events.ClientReady;
export const once = true;

export async function execute(client) {
  try {
    console.log(`Ready! Logged in as ${client.user.tag}`);

    // Presence
    try {
      client.user.setPresence({
        activities: [{ name: 'the Holy Gehy Empire', type: ActivityType.Watching }],
        status: 'online',
      });
      console.log('Bot presence set successfully');
    } catch (presenceError) {
      console.error('Error setting bot presence:', presenceError);
    }

    // Initialize services (single source of truth)
    try {
      console.log('Initializing temp VC service...');
      await initTempVCService(client);
      console.log('Temp VC service initialized successfully');
    } catch (tempVCError) {
      console.error('Error initializing temp VC service:', tempVCError);
    }

    try {
      console.log('Initializing invite role service...');
      await initInviteRoleService(client);
      console.log('Invite role service initialized successfully');
    } catch (inviteRoleError) {
      console.error('Error initializing invite role service:', inviteRoleError);
    }

    // Deploy slash commands (guild-scoped)
    try {
      console.log('Started refreshing application (/) commands.');
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

    // One-time startup tasks
    try {
      console.log('Starting periodic cleanup...');
      try {
        const result = await sweepTempRooms();
        console.log('Initial cleanup completed successfully');
        if (result?.cleaned) {
          console.log(`Temp room sweep completed. Cleaned up ${result.cleaned} channels.`);
        }
      } catch (initialCleanupError) {
        console.error('Error in initial cleanup:', initialCleanupError);
      }

      try {
        console.log('Ensuring Imperial Decree exists...');
        await ensureDecreeExists(client);
        console.log('Imperial Decree check complete');
      } catch (decreeError) {
        console.error('Error ensuring Imperial Decree exists:', decreeError);
      }

      // Periodic sweep loop (single)
      const sweepInterval = (config.SWEEP_INTERVAL_SEC || 600) * 1000;
      setInterval(async () => {
        try {
          const res = await sweepTempRooms();
          if (res?.cleaned) {
            console.log(`Temp room sweep completed. Cleaned up ${res.cleaned} channels.`);
          }
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
