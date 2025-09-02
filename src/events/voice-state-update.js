// ============= src/events/voice-state-update.js =============
import { CHANNELS } from '../channels.js';
import { config } from '../config.js';
import { createTempVCFor, scheduleDeleteIfEmpty, tempOwners } from '../services/temp-vc-service.js';
import { Events } from 'discord.js';

export const name = Events.VoiceStateUpdate;
export async function execute(oldState, newState) {
  // Join-to-create trigger
  if (!oldState.channelId && newState.channelId === CHANNELS.RENT_A_WAR_CHAMBER) {
    try {
      await createTempVCFor(newState.member);
    } catch (e) {
      console.error('Temp VC create failed:', e);
    }
  }

  // Handle leaving temp channels
  if (oldState.channelId && tempOwners.has(oldState.channelId)) {
    const ownerId = tempOwners.get(oldState.channelId);
    
    // If the owner left their own temp VC, remove Host role
    if (ownerId && oldState.member?.id === ownerId && config.TEMP_HOST_ROLE_ID) {
      try {
        await oldState.member.roles.remove(config.TEMP_HOST_ROLE_ID);
        console.log(`🎭 Removed Host role from ${oldState.member.user.tag} (left own VC)`);
      } catch (e) {
        console.error('Failed to remove Host role:', e);
      }
    }
    
    // Schedule deletion check regardless of who left
    scheduleDeleteIfEmpty(oldState.channelId, oldState.guild);
  }

  // Handle joining temp channels (cancel deletion timer if someone joins)
  if (newState.channelId && tempOwners.has(newState.channelId)) {
    scheduleDeleteIfEmpty(newState.channelId, newState.guild);
  }
}