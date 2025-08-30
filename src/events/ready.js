// ============= src/events/ready.js =============
import { Events } from 'discord.js';
import { config } from '../config.js';
import { sweepTempRooms, initTempVCService } from '../services/temp-vc-service.js';

export const name = Events.ClientReady;
export const once = true;

export async function execute(client) {
  console.log(`✅ Logged in as ${client.user.tag}`);
  
  // Initialize services
  initTempVCService(client);
  
  // Startup sweep
  await sweepTempRooms();
  
  // Schedule periodic sweeps
  setInterval(sweepTempRooms, config.SWEEP_INTERVAL_SEC * 1000);
}
