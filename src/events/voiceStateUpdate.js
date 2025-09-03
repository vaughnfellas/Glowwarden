// src/events/voiceStateUpdate.js
import { Events } from 'discord.js';
import { config } from '../config.js';
import { createTempVCFor } from '../services/temp-vc-service.js';
import { tempOwners } from '../services/temp-vc-service.js';

export const name = Events.VoiceStateUpdate;
export const once = false;

export async function execute(oldState, newState) {
  // Ignore bot voice state changes
  if (newState.member.user.bot) return;

  const lobbyId = config.LOBBY_VC_ID;
  
  // Check if user joined the lobby VC
  if (newState.channelId === lobbyId && oldState.channelId !== lobbyId) {
    // Check if user is not a Stray Spore (i.e., is a Full Member)
    if (!newState.member.roles.cache.has(config.STRAY_SPORE_ROLE_ID)) {
      console.log(`${newState.member.user.tag} joined lobby - creating War Chamber`);
      
      // Check if user already has an active chamber
      let existingChannelId = null;
      for (const [channelId, ownerId] of tempOwners.entries()) {
        if (ownerId === newState.member.id) {
          existingChannelId = channelId;
          break;
        }
      }
      
      if (existingChannelId) {
        // User already has a chamber, move them there
        const existingChannel = newState.guild.channels.cache.get(existingChannelId);
        if (existingChannel) {
          try {
            await newState.member.voice.setChannel(existingChannel);
            console.log(`Moved ${newState.member.user.tag} to their existing War Chamber`);
          } catch (error) {
            console.error('Failed to move member to existing chamber:', error);
          }
          return;
        } else {
          // Channel no longer exists, remove from tracking
          tempOwners.delete(existingChannelId);
        }
      }
      
      // Create a new chamber for the user
      try {
        await createTempVCFor(newState.member);
      } catch (error) {
        console.error('Failed to create War Chamber:', error);
      }
    } else {
      console.log(`${newState.member.user.tag} is a Stray Spore - not creating War Chamber`);
    }
  }
}
