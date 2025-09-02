// ============= src/services/temp-vc-service.js =============
import { ChannelType, PermissionFlagsBits, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
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
              console.log(`Host role removed from ${ownerMember.user.tag} (VC deleted)`);
            }
          } catch (e) {
            console.error('Remove Host role failed:', e);
          }
        }

        // Clean up associated text channel
        const inviteData = tempInvites.get(channelId);
        if (inviteData?.textChannelId) {
          try {
            const textChannel = guild.channels.cache.get(inviteData.textChannelId);
            if (textChannel) {
              await textChannel.delete('War Chamber closed - cleaning up text channel');
              console.log(`Deleted associated text channel: ${textChannel.name}`);
            }
          } catch (e) {
            console.error('Failed to delete associated text channel:', e);
          }
        }

        // Clean up invite tracking
        tempInvites.delete(channelId);

        await ch.delete('Temp VC empty past grace period');
        tempOwners.delete(channelId);
        deleteTimers.delete(channelId);
        console.log('Deleted empty temp VC:', channelId);
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
              console.log(`Host role removed from ${owner.user.tag} (sweep cleanup)`);
            }
          } catch {}
        }

        // Clean up associated text channel
        const inviteData = tempInvites.get(ch.id);
        if (inviteData?.textChannelId) {
          try {
            const textChannel = guild.channels.cache.get(inviteData.textChannelId);
            if (textChannel) {
              await textChannel.delete('Periodic sweep: War Chamber closed');
              console.log(`Sweep deleted text channel: ${textChannel.name}`);
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
        console.log('Sweep deleted:', ch.id, ch.name);
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

    console.log(`Auto-created War Chamber invite for ${member.user.tag}: ${invite.code}`);
    return invite;
  } catch (error) {
    console.error('Failed to create auto-invite for temp VC:', error);
    return null;
  }
}

async function sendInviteDM(member, invite, voiceChannel) {
  try {
    const dmEmbed = new EmbedBuilder()
      .setTitle('Your War Chamber is Ready!')
      .setDescription([
        `**${member.displayName}**, your War Chamber has been created!`,
        '',
        '**Stray Spore Invite Link:**',
        `\`\`\`${invite.url}\`\`\``,
        '',
        '**How to Use:**',
        '• Share this link with friends outside the guild',
        '• They\'ll get Stray Spore role automatically',
        '• They\'ll be moved to your War Chamber',
        '• Invite expires in 24 hours',
        '',
        '**Note:** Guild members can find your chamber using `/vc host:${member.displayName}`'
      ].join('\n'))
      .setColor(0x8B4513)
      .setTimestamp();

    await member.send({ embeds: [dmEmbed] });
    console.log(`Sent War Chamber invite DM to ${member.user.tag}`);
  } catch (error) {
    console.error('Failed to send invite DM:', error);
  }
}

async function postInviteMessage(voiceChannel, invite, member) {
  try {
    const guild = voiceChannel.guild;
    const textChannelName = voiceChannel.name.toLowerCase().replace(/[^a-z0-9-]/g, '-') + '-text';
    
    // Create text channel
    const textChannel = await guild.channels.create({
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

    // Post the invite with instructions
    const embed = new EmbedBuilder()
      .setTitle('War Chamber Invite Instructions')
      .setDescription([
        `**${member.displayName}** has opened their War Chamber!`,
        '',
        '**For the Host:**',
        '• Your invite link has been sent to your DMs',
        '• Share that link with friends outside the guild',
        '• They\'ll get Stray Spore role and join this chamber',
        '',
        '**For Guild Members:**',
        `• Use \`/vc host:${member.displayName}\` to join this chamber`,
        '• No invite link needed for guild members',
        '',
        '**Stray Spore Invite:**',
        `\`\`\`${invite.url}\`\`\``,
        '',
        '_This invite expires in 24 hours and gives unlimited uses._',
      ].join('\n'))
      .setColor(0x8B4513)
      .setTimestamp();

    const message = await textChannel.send({ embeds: [embed] });
    
    try {
      await message.pin();
    } catch (error) {
      console.log('Could not pin invite message:', error.message);
    }

    // Store reference to text channel for cleanup
    tempInvites.get(voiceChannel.id).textChannelId = textChannel.id;
    
    return textChannel;
    
  } catch (error) {
    console.error('Failed to post invite message:', error);
    return null;
  }
}

export async function createTempVCFor(member) {
  const guild = member.guild;
  
  const name = (config.TEMP_VC_NAME_FMT || 'War Chamber – {user}')
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
        PermissionFlagsBits.CreateInstantInvite,
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
      console.log(`Granted Host role to ${member.user.tag}`);
    } catch (e) {
      console.error('Add Host role failed:', e);
    }
  }

  // AUTO-CREATE INVITE
  const invite = await createAutoInvite(ch, member);
  if (invite) {
    // Send DM to host with their invite
    await sendInviteDM(member, invite, ch);
    // Post instructions in text channel
    await postInviteMessage(ch, invite, member);
  }

  // Move member to new chamber
  try {
    await member.voice.setChannel(ch);
  } catch (e) {
    console.log('Could not auto-move member to new chamber:', e.message);
  }

  scheduleDeleteIfEmpty(ch.id, guild);

  console.log('Created temp VC for', member.user.tag, '->', ch.name, `(${ch.id})`);
}

// Handle member join via temp VC invite - now includes character name modal for Stray Spores
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
        console.log(`Auto-assigned Stray Spore role to ${member.user.tag} via War Chamber invite`);
      }
    }
    
    // Move them to the voice channel if they're in voice
    const voiceChannel = member.guild.channels.cache.get(targetChannelId);
    if (voiceChannel && voiceChannel.type === ChannelType.GuildVoice && member.voice.channelId) {
      try {
        await member.voice.setChannel(voiceChannel);
        console.log(`Moved ${member.user.tag} to War Chamber via invite`);
      } catch (error) {
        console.log(`Could not move ${member.user.tag} to voice channel:`, error.message);
      }
    }
    
    // Send welcome message to the text channel
    if (inviteData.textChannelId) {
      const textChannel = member.guild.channels.cache.get(inviteData.textChannelId);
      if (textChannel) {
        textChannel.send(
          `**${member.displayName}** has joined **${inviteData.ownerDisplayName}**'s War Chamber as a Stray Spore! Welcome!`
        ).catch(() => {});
      }
    }

    // Send character name modal to new Stray Spore
    try {
      await sendCharacterNameModal(member);
    } catch (error) {
      console.log('Could not send character modal to new Stray Spore:', error.message);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to handle temp VC invite join:', error);
    return false;
  }
}

async function sendCharacterNameModal(member) {
  // We'll trigger this via DM with a button since we can't force a modal on guild join
  // Let's send them a DM with instructions and a way to set their character name
  try {
    const dmEmbed = new EmbedBuilder()
      .setTitle('Welcome, Stray Spore!')
      .setDescription([
        'Welcome to the guild! As a Stray Spore, you can set your WoW character name.',
        '',
        'To set your character name, use this command in any channel:',
        '`/addalt`',
        '',
        'This will let you register your character and set your nickname.',
      ].join('\n'))
      .setColor(0x9ACD32);

    await member.send({ embeds: [dmEmbed] });
    console.log(`Sent character setup instructions to ${member.user.tag}`);
  } catch (error) {
    console.error('Failed to send character setup DM:', error);
  }
}

// Get invite info for a temp VC
export function getTempVCInviteInfo(channelId) {
  return tempInvites.get(channelId) || null;
}