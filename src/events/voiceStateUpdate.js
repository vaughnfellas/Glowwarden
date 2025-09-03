// src/events/voiceStateUpdate.js
import { Events } from 'discord.js';
import { config } from '../config.js';
import { createTempVCFor, tempOwners } from '../services/temp-vc-service.js';

export const name = Events.VoiceStateUpdate;
export const once = false;

export async function execute(oldState, newState) {
  // Ignore bot voice state changes
  if (newState.member.user.bot) return;

  const lobbyId = config.RENT_WAR_CHAMBER_VC_ID; // Use spec-compliant variable name
  
  // Check if user joined the "Rent A War Chamber" lobby VC
  if (newState.channelId === lobbyId && oldState.channelId !== lobbyId) {
    console.log(`${newState.member.user.tag} joined "Rent A War Chamber" lobby`);
    
    // Check if user is NOT a Stray Spore (i.e., is a Full Member)
    if (!newState.member.roles.cache.has(config.ROLE_STRAY_SPORE_ID)) {
      console.log(`${newState.member.user.tag} is a Full Member - processing War Chamber creation`);
      
      // Check if user already has an active chamber
      let existingChannelId = null;
      for (const [channelId, ownerId] of tempOwners.entries()) {
        if (ownerId === newState.member.id) {
          existingChannelId = channelId;
          break;
        }
      }
      
      if (existingChannelId) {
        // User already has a chamber, move them there and refresh invite
        const existingChannel = newState.guild.channels.cache.get(existingChannelId);
        if (existingChannel) {
          try {
            await newState.member.voice.setChannel(existingChannel);
            console.log(`Moved ${newState.member.user.tag} to their existing War Chamber: ${existingChannel.name}`);
            
            // TODO: Refresh the 24h invite (DM + post again as per spec)
            // This should be implemented in temp-vc-service.js
            
          } catch (error) {
            console.error('Failed to move member to existing chamber:', error);
          }
          return;
        } else {
          // Channel no longer exists, remove from tracking
          console.log(`Removing stale chamber tracking for ${existingChannelId}`);
          tempOwners.delete(existingChannelId);
        }
      }
      
      // Create a new War Chamber for the user
      try {
        console.log(`Creating new War Chamber for ${newState.member.user.tag}`);
        await createTempVCFor(newState.member);
      } catch (error) {
        console.error('Failed to create War Chamber:', error);
      }
    } else {
      console.log(`${newState.member.user.tag} is a Stray Spore - ignoring lobby join`);
    }
  }
}