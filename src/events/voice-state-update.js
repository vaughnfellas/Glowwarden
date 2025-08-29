// ============= src/events/voice-state-update.js =============
import { config } from '../config.js';
import { createTempVCFor, scheduleDeleteIfEmpty, tempOwners } from '../services/temp-vc-service.js';

export const name = 'voiceStateUpdate';

export async function execute(oldState, newState) {
  // Join-to-create trigger
  if (!oldState.channelId && newState.channelId === config.LOBBY_VC_ID) {
    try {
      await createTempVCFor(newState.member);
    } catch (e) {
      console.error('Temp VC create failed:', e);
    }
  }

  // Handle leaving temp channels
  if (oldState.channelId && tempOwners.has(oldState.channelId)) {
    const ownerId = tempOwners.get(oldState.channelId);
    if (ownerId && oldState.member?.id === ownerId && config.TEMP_HOST_ROLE_ID) {
      try {
        await oldState.member.roles.remove(config.TEMP_HOST_ROLE_ID);
      } catch {}
    }
    scheduleDeleteIfEmpty(oldState.channelId, oldState.guild);
  }

  // Handle joining temp channels
  if (newState.channelId && tempOwners.has(newState.channelId)) {
    scheduleDeleteIfEmpty(newState.channelId, newState.guild);
  }
}
