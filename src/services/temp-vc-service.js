// src/services/temp-vc-service.js
import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { config } from '../config.js';
// import { supabase } from '../db.js'; // Uncomment when database integration is needed

// In-memory storage for temp VC owners (consider moving to database)
export const tempOwners = new Map(); // channelId -> ownerId

let client = null;

/**
 * Initialize the temp VC service
 * @param {Client} discordClient 
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function initTempVCService(discordClient) {
  try {
    client = discordClient;
    console.log('Temp VC service initialized successfully');
    return { ok: true };
  } catch (error) {
    console.error('Failed to initialize temp VC service:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Create a temporary voice channel for a member
 * @param {GuildMember} member 
 * @returns {Promise<{ok: boolean, channel?: GuildChannel, error?: string}>}
 */
export async function createTempVCFor(member) {
  try {
    if (!client) {
      return { ok: false, error: 'Temp VC service not initialized' };
    }

    const guild = member.guild;
    const battlefrontCategory = guild.channels.cache.get(config.BATTLEFRONT_CATEGORY_ID);
    
    if (!battlefrontCategory) {
      return { ok: false, error: 'Battlefront category not found' };
    }

    // Generate channel name
    const channelName = `War Chamber — ${member.displayName}`;
    
    // Create the voice channel
    const warChamber = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildVoice,
      parent: battlefrontCategory.id,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: [PermissionFlagsBits.Connect],
        },
        {
          id: member.id,
          allow: [
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.UseVAD,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageRoles,
          ],
        },
        // Allow guild members to connect (not Stray Spores)
        ...[config.ROLE_BASE_MEMBER, config.ROLE_BASE_OFFICER, config.ROLE_BASE_VETERAN]
          .filter(roleId => roleId) // Filter out undefined roles
          .map(roleId => ({
            id: roleId,
            allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.UseVAD],
          })),
      ],
    });

    // Track ownership
    tempOwners.set(warChamber.id, member.id);
    
    // Move the member to their new chamber
    try {
      await member.voice.setChannel(warChamber);
      console.log(`Created and moved ${member.user.tag} to War Chamber: ${warChamber.name}`);
    } catch (moveError) {
      console.error(`Failed to move ${member.user.tag} to new War Chamber:`, moveError);
      // Don't return error here as channel was created successfully
    }

    // Optional: Create 24h invite link
    try {
      const invite = await warChamber.createInvite({
        maxAge: 86400, // 24 hours
        maxUses: 0, // unlimited uses
        reason: `24h invite for ${member.displayName}'s War Chamber`
      });
      console.log(`Created 24h invite for War Chamber: ${invite.url}`);
    } catch (inviteError) {
      console.warn(`Failed to create invite for War Chamber ${warChamber.name}:`, inviteError);
    }

    return { ok: true, channel: warChamber };
    
  } catch (error) {
    console.error('Error creating temp VC:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Grant access to a member for a specific temp VC
 * @param {GuildMember} member 
 * @param {string} channelId 
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export async function grantAccessToMember(member, channelId) {
  try {
    const channel = member.guild.channels.cache.get(channelId);
    
    if (!channel) {
      return { success: false, message: 'War Chamber not found' };
    }

    if (!tempOwners.has(channelId)) {
      return { success: false, message: 'This is not a temporary War Chamber' };
    }

    // Grant permissions
    await channel.permissionOverwrites.create(member.id, {
      Connect: true,
      Speak: true,
      UseVAD: true,
    });

    console.log(`Granted access to ${member.user.tag} for War Chamber: ${channel.name}`);
    return { success: true };
    
  } catch (error) {
    console.error('Error granting access to member:', error);
    return { success: false, message: 'Failed to grant access' };
  }
}

/**
 * Check if a user owns a temp VC
 * @param {string} userId 
 * @returns {string|null} channelId if found, null otherwise
 */
export function getUserTempVC(userId) {
  try {
    for (const [channelId, ownerId] of tempOwners.entries()) {
      if (ownerId === userId) {
        return channelId;
      }
    }
    return null;
  } catch (error) {
    console.error('Error checking user temp VC:', error);
    return null;
  }
}

/**
 * Clean up empty temp rooms and stale data
 * @returns {Promise<{ok: boolean, cleaned: number, error?: string}>}
 */
export async function sweepTempRooms() {
  try {
    if (!client) {
      return { ok: false, error: 'Service not initialized', cleaned: 0 };
    }

    let cleanedCount = 0;
    const guild = client.guilds.cache.get(config.GUILD_ID);
    
    if (!guild) {
      return { ok: false, error: 'Guild not found', cleaned: 0 };
    }

    // Get all tracked temp channels
    const channelsToCheck = Array.from(tempOwners.keys());
    
    for (const channelId of channelsToCheck) {
      try {
        const channel = guild.channels.cache.get(channelId);
        
        // Channel doesn't exist anymore
        if (!channel) {
          tempOwners.delete(channelId);
          cleanedCount++;
          console.log(`Cleaned up stale temp owner entry for deleted channel ${channelId}`);
          continue;
        }

        // Channel is empty (no members)
        if (channel.members.size === 0) {
          try {
            await channel.delete('Empty temp War Chamber cleanup');
            tempOwners.delete(channelId);
            cleanedCount++;
            console.log(`Deleted empty temp War Chamber: ${channel.name}`);
          } catch (deleteError) {
            console.error(`Failed to delete empty War Chamber ${channelId}:`, deleteError);
          }
        }
        
      } catch (channelError) {
        console.error(`Error checking temp channel ${channelId}:`, channelError);
        // Remove from tracking if we can't access it
        tempOwners.delete(channelId);
        cleanedCount++;
      }
    }

    console.log(`Temp room sweep completed. Cleaned up ${cleanedCount} channels.`);
    return { ok: true, cleaned: cleanedCount };
    
  } catch (error) {
    console.error('Error in sweepTempRooms:', error);
    return { ok: false, error: error.message, cleaned: 0 };
  }
}

/**
 * Get statistics about temp VCs
 * @returns {{totalActive: number, owners: string[], channels: Array}}
 */
export function getTempVCStats() {
  try {
    if (!client) {
      return { totalActive: 0, owners: [], channels: [] };
    }

    const guild = client.guilds.cache.get(config.GUILD_ID);
    if (!guild) {
      return { totalActive: 0, owners: [], channels: [] };
    }

    const activeChannels = [];
    const ownerIds = [];

    for (const [channelId, ownerId] of tempOwners.entries()) {
      const channel = guild.channels.cache.get(channelId);
      if (channel) {
        activeChannels.push({
          id: channelId,
          name: channel.name,
          memberCount: channel.members.size,
          ownerId: ownerId
        });
        ownerIds.push(ownerId);
      }
    }

    return {
      totalActive: activeChannels.length,
      owners: ownerIds,
      channels: activeChannels
    };
  } catch (error) {
    console.error('Error getting temp VC stats:', error);
    return { totalActive: 0, owners: [], channels: [] };
  }
}

/**
 * Force cleanup of a specific temp VC (admin function)
 * @param {string} channelId 
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function forceCleanupTempVC(channelId) {
  try {
    if (!client) {
      return { ok: false, error: 'Service not initialized' };
    }

    const guild = client.guilds.cache.get(config.GUILD_ID);
    if (!guild) {
      return { ok: false, error: 'Guild not found' };
    }

    const channel = guild.channels.cache.get(channelId);
    
    if (channel) {
      await channel.delete('Force cleanup by admin');
    }
    
    tempOwners.delete(channelId);
    console.log(`Force cleaned up temp VC: ${channelId}`);
    
    return { ok: true };
    
  } catch (error) {
    console.error('Error force cleaning up temp VC:', error);
    return { ok: false, error: error.message };
  }
}