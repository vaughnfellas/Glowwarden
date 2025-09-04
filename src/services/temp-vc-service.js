// src/services/temp-vc-service.js
import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { config } from '../config.js';
import { supabase } from '../db.js';

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
    
    // Load existing temp VCs from database on startup
    await loadTempVCsFromDatabase();
    
    console.log('Temp VC service initialized successfully');
    return { ok: true };
  } catch (error) {
    console.error('Failed to initialize temp VC service:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Load existing temp VCs from database
 */
async function loadTempVCsFromDatabase() {
  try {
    const { data: tempVCs, error } = await supabase
      .from('temp_voice_channels')
      .select('*')
      .gt('expires_at', new Date().toISOString());

    if (error) {
      console.error('Error loading temp VCs from database:', error);
      return;
    }

    if (tempVCs) {
      for (const vc of tempVCs) {
        tempOwners.set(vc.channel_id, vc.owner_id);
      }
      console.log(`Loaded ${tempVCs.length} active temp VCs from database`);
    }
  } catch (error) {
    console.error('Failed to load temp VCs from database:', error);
  }
}

/**
 * Get temp invites from database
 * @returns {Promise<Map>}
 */
export async function getTempInvites() {
  try {
    const { data: invites, error } = await supabase
      .from('temp_voice_channels')
      .select('*')
      .not('invite_code', 'is', null)
      .gt('expires_at', new Date().toISOString());

    if (error) {
      console.error('Error getting temp invites:', error);
      return new Map();
    }

    const tempInvites = new Map();
    if (invites) {
      for (const invite of invites) {
        tempInvites.set(invite.channel_id, {
          code: invite.invite_code,
          expires: new Date(invite.expires_at).getTime(),
          ownerId: invite.owner_id
        });
      }
    }

    return tempInvites;
  } catch (error) {
    console.error('Failed to get temp invites:', error);
    return new Map();
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

    // Track ownership in memory
    tempOwners.set(warChamber.id, member.id);
    
    // Create 24h invite link
    let inviteCode = null;
    try {
      const invite = await warChamber.createInvite({
        maxAge: 86400, // 24 hours
        maxUses: 0, // unlimited uses
        reason: `24h invite for ${member.displayName}'s War Chamber`
      });
      
      inviteCode = invite.code;
      console.log(`Created 24h invite for War Chamber: ${invite.url}`);
    } catch (inviteError) {
      console.warn(`Failed to create invite for War Chamber ${warChamber.name}:`, inviteError);
    }

    // Store in database
    const expiresAt = new Date(Date.now() + 86400000); // 24 hours from now
    try {
      const { error: dbError } = await supabase
        .from('temp_voice_channels')
        .insert({
          channel_id: warChamber.id,
          owner_id: member.id,
          guild_id: guild.id,
          channel_name: channelName,
          invite_code: inviteCode,
          expires_at: expiresAt.toISOString(),
          created_at: new Date().toISOString()
        });

      if (dbError) {
        console.error('Failed to save temp VC to database:', dbError);
      }
    } catch (dbError) {
      console.error('Database error when creating temp VC:', dbError);
    }

    // Move the member to their new chamber
    try {
      await member.voice.setChannel(warChamber);
      console.log(`Created and moved ${member.user.tag} to War Chamber: ${warChamber.name}`);
    } catch (moveError) {
      console.error(`Failed to move ${member.user.tag} to new War Chamber:`, moveError);
      // Don't return error here as channel was created successfully
    }

    return { ok: true, channel: warChamber };
    
  } catch (error) {
    console.error('Error creating temp VC:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Handle a member joining via a temp VC invite
 * @param {GuildMember} member 
 * @param {string} inviteCode 
 * @returns {Promise<boolean>}
 */
export async function handleTempVCInviteJoin(member, inviteCode) {
  try {
    if (!client) {
      console.error('Temp VC service not initialized');
      return false;
    }

    // Find the channel with this invite code in database
    const { data: tempVC, error } = await supabase
      .from('temp_voice_channels')
      .select('*')
      .eq('invite_code', inviteCode)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !tempVC) {
      console.log(`No active temp VC found for invite code: ${inviteCode}`);
      return false;
    }

    const guild = member.guild;
    const channel = guild.channels.cache.get(tempVC.channel_id);
    
    if (!channel) {
      console.log(`Temp VC channel ${tempVC.channel_id} not found, cleaning up from database`);
      await supabase
        .from('temp_voice_channels')
        .delete()
        .eq('channel_id', tempVC.channel_id);
      tempOwners.delete(tempVC.channel_id);
      return false;
    }

    // Assign Stray Spore role
    const straySporeRole = guild.roles.cache.get(config.STRAY_SPORE_ROLE_ID);
    if (straySporeRole) {
      try {
        await member.roles.add(straySporeRole);
        console.log(`Assigned Stray Spore role to ${member.user.tag} via temp VC invite`);
      } catch (roleError) {
        console.error(`Failed to assign Stray Spore role to ${member.user.tag}:`, roleError);
      }
    }

    // Grant access to the War Chamber
    try {
      await channel.permissionOverwrites.create(member.id, {
        Connect: true,
        Speak: true,
        UseVAD: true,
      });
      console.log(`Granted War Chamber access to ${member.user.tag} for ${channel.name}`);
    } catch (permError) {
      console.error(`Failed to grant War Chamber access to ${member.user.tag}:`, permError);
    }

    return true;
    
  } catch (error) {
    console.error('Error handling temp VC invite join:', error);
    return false;
  }
}

/**
 * Check if an invite code is a temp VC invite
 * @param {string} code 
 * @returns {Promise<boolean>}
 */
export async function isWarChamberInvite(code) {
  try {
    const { data: tempVC, error } = await supabase
      .from('temp_voice_channels')
      .select('channel_id')
      .eq('invite_code', code)
      .gt('expires_at', new Date().toISOString())
      .single();

    return !error && tempVC !== null;
  } catch (error) {
    console.error('Error checking if invite is War Chamber invite:', error);
    return false;
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

    // Get all temp VCs from database
    const { data: tempVCs, error } = await supabase
      .from('temp_voice_channels')
      .select('*');

    if (error) {
      console.error('Error fetching temp VCs for cleanup:', error);
      return { ok: false, error: error.message, cleaned: 0 };
    }

    for (const tempVC of tempVCs || []) {
      try {
        const channel = guild.channels.cache.get(tempVC.channel_id);
        const isExpired = new Date(tempVC.expires_at) < new Date();
        
        // Channel doesn't exist anymore or is expired
        if (!channel || isExpired) {
          await supabase
            .from('temp_voice_channels')
            .delete()
            .eq('channel_id', tempVC.channel_id);
          
          tempOwners.delete(tempVC.channel_id);
          cleanedCount++;
          
          if (channel && isExpired) {
            try {
              await channel.delete('Expired temp War Chamber cleanup');
              console.log(`Deleted expired temp War Chamber: ${channel.name}`);
            } catch (deleteError) {
              console.error(`Failed to delete expired War Chamber ${tempVC.channel_id}:`, deleteError);
            }
          } else {
            console.log(`Cleaned up stale temp VC entry for deleted channel ${tempVC.channel_id}`);
          }
          continue;
        }

        // Channel is empty (no members)
        if (channel.members.size === 0) {
          try {
            await channel.delete('Empty temp War Chamber cleanup');
            await supabase
              .from('temp_voice_channels')
              .delete()
              .eq('channel_id', tempVC.channel_id);
            
            tempOwners.delete(tempVC.channel_id);
            cleanedCount++;
            console.log(`Deleted empty temp War Chamber: ${channel.name}`);
          } catch (deleteError) {
            console.error(`Failed to delete empty War Chamber ${tempVC.channel_id}:`, deleteError);
          }
        }
        
      } catch (channelError) {
        console.error(`Error checking temp channel ${tempVC.channel_id}:`, channelError);
        // Remove from database and tracking if we can't access it
        await supabase
          .from('temp_voice_channels')
          .delete()
          .eq('channel_id', tempVC.channel_id);
        tempOwners.delete(tempVC.channel_id);
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
 * @returns {Promise<{totalActive: number, owners: string[], channels: Array}>}
 */
export async function getTempVCStats() {
  try {
    if (!client) {
      return { totalActive: 0, owners: [], channels: [] };
    }

    const guild = client.guilds.cache.get(config.GUILD_ID);
    if (!guild) {
      return { totalActive: 0, owners: [], channels: [] };
    }

    // Get active temp VCs from database
    const { data: tempVCs, error } = await supabase
      .from('temp_voice_channels')
      .select('*')
      .gt('expires_at', new Date().toISOString());

    if (error) {
      console.error('Error getting temp VC stats:', error);
      return { totalActive: 0, owners: [], channels: [] };
    }

    const activeChannels = [];
    const ownerIds = [];

    for (const tempVC of tempVCs || []) {
      const channel = guild.channels.cache.get(tempVC.channel_id);
      if (channel) {
        activeChannels.push({
          id: tempVC.channel_id,
          name: channel.name,
          memberCount: channel.members.size,
          ownerId: tempVC.owner_id,
          inviteCode: tempVC.invite_code,
          inviteExpires: new Date(tempVC.expires_at).getTime()
        });
        ownerIds.push(tempVC.owner_id);
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
    
    // Remove from database
    await supabase
      .from('temp_voice_channels')
      .delete()
      .eq('channel_id', channelId);
    
    tempOwners.delete(channelId);
    console.log(`Force cleaned up temp VC: ${channelId}`);
    
    return { ok: true };
    
  } catch (error) {
    console.error('Error force cleaning up temp VC:', error);
    return { ok: false, error: error.message };
  }
}