// ============= src/events/ready.js =============
import { Events, ActivityType } from 'discord.js';
import { config } from '../config.js';
import { sweepTempRooms, initTempVCService } from '../services/temp-vc-service.js';
import { initInviteRoleService } from '../services/invite-role-service.js';
import { initSporeBoxService } from '../services/sporebox-service.js'

export const name = Events.ClientReady;
export const once = true;

export async function execute(client) {
  console.log(`✅ Logged in as ${client.user.tag}`);

  initInviteRoleService(client);
  initSporeBoxService(client)
  // Presence (customize or env-drive below)
  client.user.setPresence({
    activities: [{ name: 'the Chamber of Oaths', type: ActivityType.Watching }],
    status: 'online',
  });

  // Initialize services
  initTempVCService(client);

  // Startup sweep
  await sweepTempRooms();

  // Schedule periodic sweeps (with a safe default)
  const sweepMs = Math.max(60_000, Number(config.SWEEP_INTERVAL_SEC) * 1000 || 600_000);
  setInterval(sweepTempRooms, sweepMs);
}
