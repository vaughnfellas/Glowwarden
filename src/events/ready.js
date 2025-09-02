// ============= src/events/ready.js =============
import { Events, ActivityType } from 'discord.js';
import { config } from '../config.js';
import { sweepTempRooms, initTempVCService } from '../services/temp-vc-service.js';
import { initInviteRoleService } from '../services/invite-role-service.js';

export const name = Events.ClientReady;
export const once = true;

export async function execute(client) {
  try {
    console.log(`✅ Logged in as ${client.user.tag}`);

    // Services with proper error handling
    try {
      console.log('Initializing invite role service...');
      initInviteRoleService(client);
      console.log('✅ Invite role service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize invite role service:', error);
      // Continue execution even if this service fails
    }

    try {
      console.log('Initializing temp VC service...');
      initTempVCService(client);
      console.log('✅ Temp VC service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize temp VC service:', error);
      // Continue execution even if this service fails
    }
    
    // Presence
    try {
      client.user.setPresence({
        activities: [{ name: 'the Chamber of Oaths', type: ActivityType.Watching }],
        status: 'online',
      });
      console.log('✅ Set bot presence');
    } catch (error) {
      console.error('❌ Failed to set presence:', error);
    }

    // Startup sweep + schedule
    try {
      await sweepTempRooms();
      const sweepMs = Math.max(60_000, Number(config.SWEEP_INTERVAL_SEC) * 1000 || 600_000);
      setInterval(sweepTempRooms, sweepMs);
      console.log(`✅ Scheduled temp room sweeps every ${sweepMs/1000} seconds`);
    } catch (error) {
      console.error('❌ Failed to set up room sweeping:', error);
    }
    
    console.log('✅ Ready event completed successfully');
  } catch (error) {
    console.error('❌ Critical error in ready event:', error);
  }
}
