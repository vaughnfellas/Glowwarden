// src/events/voiceStateUpdate.js
import { Events } from 'discord.js';
import { config } from '../config.js';
import { createTempVCFor, tempOwners } from '../services/temp-vc-service.js';

export const name = Events.VoiceStateUpdate;
export const once = false;

export async function execute(oldState, newState) {
  // Ignore bot voice state changes
  if (newState.member?.user?.bot) return;

  const lobbyId = config.RENT_WAR_CHAMBER_VC_ID;

  // Joined the lobby
  if (newState.channelId === lobbyId && oldState.channelId !== lobbyId) {
    console.log(`${newState.member.user.tag} joined "Rent A War Chamber" lobby`);

    // FM = NOT Stray Spore
    if (!newState.member.roles.cache.has(config.ROLE_STRAY_SPORE_ID)) {
      // existing chamber?
      let existingChannelId = null;
      for (const [channelId, ownerId] of tempOwners.entries()) {
        if (ownerId === newState.member.id) { existingChannelId = channelId; break; }
      }

      if (existingChannelId) {
        const existing = newState.guild.channels.cache.get(existingChannelId);
        if (existing) {
          try {
            await newState.member.voice.setChannel(existing);
            console.log(`Moved ${newState.member.user.tag} to existing War Chamber: ${existing.name}`);
            // (Optional) refresh 24h invite here via your service
          } catch (e) {
            console.error('Failed to move member to existing chamber:', e);
          }
          return;
        } else {
          tempOwners.delete(existingChannelId);
        }
      }

      // create new chamber
      try {
        console.log(`Creating new War Chamber for ${newState.member.user.tag}`);
        await createTempVCFor(newState.member);
      } catch (e) {
        console.error('Failed to create War Chamber:', e);
      }
    } else {
      console.log(`${newState.member.user.tag} is a Stray Spore - ignoring lobby join`);
    }
  }
}
