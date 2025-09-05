// src/services/temp-vc-service.js
import { ChannelType, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { config } from '../config.js';
import { ROLES, getRoleName, getDisplayRole, findBaseRole } from '../roles.js';
import { supabase } from '../db.js';

// In-memory storage for temp VC owners
export const tempOwners = new Map(); // channelId -> ownerId

let client = null;
let _tempVCServiceInit = false;

export async function initTempVCService(discordClient) {
  if (_tempVCServiceInit) {
    console.warn('initTempVCService called more than once; ignoring.');
    return;
  }
  _tempVCServiceInit = true;

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
        ...[ROLES.MEMBER, ROLES.OFFICER, ROLES.VETERAN]
          .filter(roleId => roleId)
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
    let inviteUrl = null;
    try {
      const invite = await warChamber.createInvite({
        maxAge: 86400, // 24 hours
        maxUses: 0, // unlimited uses
        reason: `24h invite for ${member.displayName}'s War Chamber`
      });
      
      inviteCode = invite.code;
      inviteUrl = invite.url;
      console.log(`Created 24h invite for War Chamber: ${inviteUrl}`);
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
    }

    // Post invite in the channel if we created one
    if (inviteCode && inviteUrl) {
      try {
        const embed = new EmbedBuilder()
          .setTitle('War Chamber Ready!')
          .setDescription([
            `Welcome to your private War Chamber, ${member.displayName}!`,
            '',
            '**Invite Your Allies:**',
            `Share this invite link: ${inviteUrl}`,
            '',
            '**Features:**',
            '• 24-hour access for you and invited members',
            '• You can manage permissions and kick members',
            '• Automatically cleaned up when empty',
            '',
            '**Need Help?**',
            'Use `/vc` commands to manage your War Chamber.'
          ].join('\n'))
          .setColor(0x8B4513)
          .setTimestamp();

        await warChamber.send({ embeds: [embed] });
        console.log(`Posted invite info in War Chamber: ${warChamber.name}`);
      } catch (postError) {
        console.error(`Failed to post invite in War Chamber ${warChamber.name}:`, postError);
      }
    }

    // Send DM to the owner
    try {
      const dmEmbed = new EmbedBuilder()
        .setTitle('Your War Chamber is Ready!')
        .setDescription([
          `Your War Chamber **${channelName}** has been created successfully!`,
          '',
          inviteUrl ? `**Invite Link:** ${inviteUrl}` : '**Invite:** Failed to create invite link',
          `**Channel:** ${warChamber}`,
          `**Valid For:** 24 hours`,
          '',
          '**What you can do:**',
          '• Invite friends using the link above',
          '• Manage permissions for specific users',
          '• Use `/vc` commands for additional control',
          '',
          '**Note:** Your War Chamber will be automatically deleted when empty or after 24 hours.',
        ].join('\n'))
        .setColor(0x8B4513)
        .setTimestamp();

      await member.send({ embeds: [dmEmbed] });
      console.log(`Sent War Chamber DM to ${member.user.tag}`);
    } catch (dmError) {
      console.warn(`Failed to send War Chamber DM to ${member.user.tag}:`, dmError);
    }

    return { ok: true, channel: warChamber, invite: inviteUrl };
    
  } catch (error) {
    console.error('Error creating temp VC:', error);
    return { ok: false, error: error.message };
  }
}

export async function handleTempVCInviteJoin(member, inviteCode) {
  try {
    if (!client) {
      console.error('Temp VC service not initialized');
      return { ok: false, error: 'Service not initialized' };
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
      return { ok: false, error: 'Temp VC not found or expired' };
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
      return { ok: false, error: 'War Chamber no longer exists' };
    }

    // Assign Stray Spore role
    const straySporeRole = guild.roles.cache.get(ROLES.STRAY_SPORE);
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

    return { ok: true };
    
  } catch (error) {
    console.error('Error handling temp VC invite join:', error);
    return { ok: false, error: error.message };
  }
}

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

export async function grantAccessToMember(member, channelId) {
  try {
    const channel = member.guild.channels.cache.get(channelId);
    
    if (!channel) {
      return { success: false, message: 'War Chamber not found' };
    }

    if (!tempOwners.has(channelId)) {
      return { success: false, message: 'This is not a temporary War Chamber' };
    }

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

export async function getTempVCStats() {
  try {
    if (!client) {
      return { totalActive: 0, owners: [], channels: [] };
    }

    const guild = client.guilds.cache.get(config.GUILD_ID);
    if (!guild) {
      return { totalActive: 0, owners: [], channels: [] };
    }

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