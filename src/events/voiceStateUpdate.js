// src/events/voiceStateUpdate.js
import { Events } from 'discord.js';
import { config } from '../config.js';
import { createTempVCFor, tempOwners } from '../services/temp-vc-service.js';

export const name = Events.VoiceStateUpdate;
export const once = false;

export async function execute(oldState, newState) {
  try {
    // Ignore bot voice state changes
    if (newState.member?.user?.bot) return;

    const lobbyId = config.RENT_WAR_CHAMBER_VC_ID;

    // Joined the lobby
    if (newState.channelId === lobbyId && oldState.channelId !== lobbyId) {
      try {
        console.log(`${newState.member.user.tag} joined "Rent A War Chamber" lobby`);

        // FM = NOT Stray Spore
        if (!newState.member.roles.cache.has(config.ROLE_STRAY_SPORE_ID)) {
          // Check for existing chamber
          let existingChannelId = null;
          for (const [channelId, ownerId] of tempOwners.entries()) {
            if (ownerId === newState.member.id) { 
              existingChannelId = channelId; 
              break; 
            }
          }

          if (existingChannelId) {
            try {
              const existing = newState.guild.channels.cache.get(existingChannelId);
              if (existing) {
                try {
                  await newState.member.voice.setChannel(existing);
                  console.log(`Moved ${newState.member.user.tag} to existing War Chamber: ${existing.name}`);
                  // (Optional) refresh 24h invite here via your service
                } catch (moveError) {
                  console.error(`Failed to move member ${newState.member.user.tag} to existing chamber:`, moveError);
                }
                return;
              } else {
                // Channel doesn't exist anymore, clean up
                tempOwners.delete(existingChannelId);
                console.log(`Cleaned up stale temp owner entry for channel ${existingChannelId}`);
              }
            } catch (channelError) {
              console.error(`Error handling existing chamber for ${newState.member.user.tag}:`, channelError);
              // Continue to create new chamber
            }
          }

          // Create new chamber
          try {
            console.log(`Creating new War Chamber for ${newState.member.user.tag}`);
            await createTempVCFor(newState.member);
          } catch (createError) {
            console.error(`Failed to create War Chamber for ${newState.member.user.tag}:`, createError);
          }
        } else {
          console.log(`${newState.member.user.tag} is a Stray Spore - ignoring lobby join`);
        }
      } catch (lobbyError) {
        console.error(`Error processing lobby join for ${newState.member.user.tag}:`, lobbyError);
      }
    }
    
    // Handle other voice state changes if needed
    // This is where you could add cleanup logic for empty temp channels, etc.
    
  } catch (error) {
    console.error('Critical error in voiceStateUpdate:', error);
    console.error('Old State:', {
      channelId: oldState.channelId,
      member: oldState.member?.user?.tag || 'Unknown'
    });
    console.error('New State:', {
      channelId: newState.channelId,
      member: newState.member?.user?.tag || 'Unknown'
    });
  }
}