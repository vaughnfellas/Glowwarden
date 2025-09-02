// ============= src/services/temp-vc-service.js =============
import { ChannelType, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { CHANNELS } from '../channels.js';
import { config } from '../config.js';

// State tracking
export const tempOwners = new Map();
export const deleteTimers = new Map();
export const tempInvites = new Map(); // channelId -> invite data

let client;

export function initTempVCService(discordClient) {
  client = discordClient;
}

export function scheduleDeleteIfEmpty(channelId, guild) {
  const prev = deleteTimers.get(channelId);
  if (prev) clearTimeout(prev);

  const t = setTimeout(async () => {
    try {
      const ch = guild.channels.cache.get(channelId) || 
        (await guild.channels.fetch(channelId).catch(() => null));
      if (!ch || ch.type !== ChannelType.GuildVoice) return;

      if (ch.members.size === 0 && tempOwners.has(channelId)) {
        const ownerId = tempOwners.get(channelId);

        // Remove temp Host role on delete
        if (config.TEMP_HOST_ROLE_ID && ownerId) {
          try {
            const ownerMember = await guild.members.fetch(ownerId).catch(() => null);
            if (ownerMember?.roles.cache.has(config.TEMP_HOST_ROLE_ID)) {
              await ownerMember.roles.remove(config.TEMP_HOST_ROLE_ID);
            }
          } catch (e) {
            console.error('Remove Host role failed:', e);
          }
        }

        // Clean up invite tracking
        tempInvites.delete(channelId);

        await ch.delete('Temp VC empty past grace period');
        tempOwners.delete(channelId);
        deleteTimers.delete(channelId);
        console.log('🧹 Deleted empty temp VC:', channelId);
      }
    } catch (e) {
      console.error('Temp VC delete failed:', channelId, e);
    }
  }, config.TEMP_VC_DELETE_AFTER * 1000);

  deleteTimers.set(channelId, t);
}

export async function sweepTempRooms() {
  try {
    if (!config.GUILD_ID || !CHANNELS.BATTLEFRONT || !client) return;

    const guild = await client.guilds.fetch(config.GUILD_ID);
    const category = await guild.channels.fetch(CHANNELS.BATTLEFRONT).catch(() => null);

    if (!category) return;

    const children = category.children?.cache ?? 
      guild.channels.cache.filter(c => c.parentId === CHANNELS.BATTLEFRONT);

    for (const ch of children.values()) {
      if (ch.type !== ChannelType.GuildVoice) continue;
      if (ch.members.size > 0) continue;

      // Clean up tracking data
      if (tempOwners.has(ch.id)) {
        const ownerId = tempOwners.get(ch.id);
        if (ownerId && config.TEMP_HOST_ROLE_ID) {
          try {
            const owner = await guild.members.fetch(ownerId).catch(() => null);
            if (owner?.roles.cache.has(config.TEMP_HOST_ROLE_ID)) {
              await owner.roles.remove(config.TEMP_HOST_ROLE_ID);
            }
          } catch {}
        }

        tempOwners.delete(ch.id);
        tempInvites.delete(ch.id);
        const t = deleteTimers.get(ch.id);
        if (t) clearTimeout(t);
        deleteTimers.delete(ch.id);
      }

      try {
        await ch.delete('Periodic sweep: empty temp VC in Battlefront');
        console.log('🧹 Sweep deleted:', ch.id, ch.name);
      } catch (e) {
        console.error('Sweep delete failed:', ch.id, e);
      }
    }
  } catch (e) {
    console.error('Sweep error:', e);
  }
}

async function createAutoInvite(voiceChannel, member) {
  try {
    // Create a 24-hour invite directly to the voice channel
    const invite = await voiceChannel.createInvite({
      maxAge: 86400, // 24 hours
      maxUses: 0,    // Unlimited uses
      unique: true,
      reason: `Auto-generated Stray Spore invite for ${member.user.tag}'s War Chamber`,
    });

    // Store invite data
    tempInvites.set(voiceChannel.id, {
      code: invite.code,
      url: invite.url,
      ownerId: member.id,
      ownerTag: member.user.tag,
      ownerDisplayName: member.displayName,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000), // 24 hours from now
    });

    return invite;
  } catch (error) {
    console.error('Failed to create auto-invite for temp VC:', error);
    return null;
  }
}

async function postInviteMessage(voiceChannel, invite, member) {
  try {
    // Find or create the text channel for this voice channel
    // Discord automatically creates a text channel for voice channels in some configurations
    // but we need to handle this more explicitly
    
    const guild = voiceChannel.guild;
    const textChannelName = voiceChannel.name.toLowerCase().replace(/[^a-z0-9-]/g, '-') + '-text';
    
    // Look for existing text channel
    let textChannel = guild.channels.cache.find(ch => 
      ch.name === textChannelName && 
      ch.parentId === voiceChannel.parentId &&
      ch.type === ChannelType.GuildText
    );
    
    // Create text channel if it doesn't exist
    if (!textChannel) {
      textChannel = await guild.channels.create({
        name: textChannelName,
        type: ChannelType.GuildText,
        parent: voiceChannel.parentId,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: member.id, // Chamber owner
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageMessages,
            ],
          },
          {
            id: config.STRAY_SPORE_ROLE_ID, // Stray spores can see
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
          {
            id: guild.members.me.id, // Bot permissions
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageMessages,
            ],
          },
        ],
        reason: `Text channel for ${member.user.tag}'s War Chamber`,
      });
    }

    // Post the invite in the text channel
    const embed = new EmbedBuilder()
      .setTitle('🏰 War Chamber Ready!')
      .setDescription([
        `**${member.displayName}** has opened their War Chamber for guests!`,
        '',
        '**🔗 Stray Spore Invite:**',
        `\`\`\`${invite.url}\`\`\``,
        '',
        '**📋 Invite Details:**',
        `• **Expires:** <t:${Math.floor(Date.now() / 1000) + 86400}:R>`,
        '• **Uses:** Unlimited',
        '• **Role:** Stray Spore (auto-assigned)',
        '',
        '_Share this link with friends to bring them directly to your War Chamber! They\'ll automatically receive the Stray Spore role and land in your voice channel._',
      ].join('\n'))
      .setColor(0x8B4513)
      .setTimestamp()
      .setFooter({ text: 'Invite generated automatically' });

    const message = await textChannel.send({ embeds: [embed] });
    
    // Pin the message for easy access
    try {
      await message.pin();
    } catch (error) {
      console.log('Could not pin invite message:', error.message);
    }

    // Store reference to text channel for cleanup
    tempInvites.get(voiceChannel.id).textChannelId = textChannel.id;
    
    console.log(`🎫 Auto-created invite for ${member.user.tag}'s War Chamber: ${invite.code}`);
    return textChannel;
    
  } catch (error) {
    console.error('Failed to post invite message:', error);
    return null;
  }
}

export async function createTempVCFor(member) {
  const guild = member.guild;
  
  const name = (config.TEMP_VC_NAME_FMT || 'War Chamber — {user}')
    .replace('{user}', member.displayName);

  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.CreateInstantInvite],
    },
    {
      id: member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
        PermissionFlagsBits.Stream,
        PermissionFlagsBits.UseVAD,
        PermissionFlagsBits.MuteMembers,
        PermissionFlagsBits.DeafenMembers,
        PermissionFlagsBits.MoveMembers,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.CreateInstantInvite, // Allow owner to create invites
      ],
    },
    {
      id: config.STRAY_SPORE_ROLE_ID, // Stray spores can connect
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
        PermissionFlagsBits.UseVAD,
      ],
      deny: [PermissionFlagsBits.CreateInstantInvite],
    },
    {
      id: guild.members.me.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.MoveMembers,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.CreateInstantInvite,
      ],
    },
  ];

  const ch = await guild.channels.create({
    name,
    type: ChannelType.GuildVoice,
    parent: CHANNELS.BATTLEFRONT,
    userLimit: config.TEMP_VC_USER_LIMIT ?? undefined,
    permissionOverwrites: overwrites,
    reason: `Temp VC for ${member.user.tag}`,
  });

  tempOwners.set(ch.id, member.id);

  // Grant temp Host role
  if (config.TEMP_HOST_ROLE_ID) {
    try {
      await member.roles.add(config.TEMP_HOST_ROLE_ID);
    } catch (e) {
      console.error('Add Host role failed:', e);
    }
  }

  // AUTO-CREATE INVITE AND POST IT
  const invite = await createAutoInvite(ch, member);
  if (invite) {
    await postInviteMessage(ch, invite, member);
  }

  // Move member to new chamber
  try {
    await member.voice.setChannel(ch);
  } catch {}

  scheduleDeleteIfEmpty(ch.id, guild);

  console.log('🏛️ Created temp VC for', member.user.tag, '->', ch.name, `(${ch.id})`);
}

// Handle member join via temp VC invite
export async function handleTempVCInviteJoin(member, inviteCode) {
  // Find which temp VC this invite belongs to
  let targetChannelId = null;
  let inviteData = null;
  
  for (const [channelId, data] of tempInvites.entries()) {
    if (data.code === inviteCode) {
      targetChannelId = channelId;
      inviteData = data;
      break;
    }
  }
  
  if (!targetChannelId || !inviteData) return false;
  
  try {
    // Assign Stray Spore role
    if (config.STRAY_SPORE_ROLE_ID) {
      const role = member.guild.roles.cache.get(config.STRAY_SPORE_ROLE_ID);
      if (role && !member.roles.cache.has(role.id)) {
        await member.roles.add(role);
        console.log(`🍄 Auto-assigned Stray Spore role to ${member.user.tag} via War Chamber invite`);
      }
    }
    
    // Move them to the voice channel
    const voiceChannel = member.guild.channels.cache.get(targetChannelId);
    if (voiceChannel && voiceChannel.type === ChannelType.GuildVoice) {
      try {
        await member.voice.setChannel(voiceChannel);
      } catch (error) {
        console.log(`Could not move ${member.user.tag} to voice channel:`, error.message);
      }
    }
    
    // Send welcome message to the text channel
    if (inviteData.textChannelId) {
      const textChannel = member.guild.channels.cache.get(inviteData.textChannelId);
      if (textChannel) {
        textChannel.send(
          `🍄 **${member.displayName}** has joined **${inviteData.ownerDisplayName}**'s War Chamber as a Stray Spore!`
        ).catch(() => {});
      }
    }
    
    return true;
  } catch (error) {
    console.error('Failed to handle temp VC invite join:', error);
    return false;
  }
}

// Get invite info for a temp VC (useful for debugging/status)
export function getTempVCInviteInfo(channelId) {
  return tempInvites.get(channelId) || null;
}