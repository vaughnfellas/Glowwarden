// src/services/temp-vc-service.js
import { 
  ChannelType, 
  PermissionFlagsBits, 
  EmbedBuilder, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { CHANNELS } from '../channels.js';
import { config } from '../config.js';
import { isOwner } from '../utils/owner.js';

// State tracking
export const tempOwners = new Map();
export const deleteTimers = new Map();
export const tempInvites = new Map(); // channelId -> invite data
export const pendingNameSetups = new Set(); // userId -> true (users who need to set name)

let client;

export function initTempVCService(discordClient) {
  client = discordClient;
  // Expose tempInvites on the client for invite tracking
  client.tempInvites = tempInvites;
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
    
    // Optional: Clean up orphaned Stray Spore roles
    await sweepOrphanedStraySpores(guild);
    
  } catch (e) {
    console.error('Sweep error:', e);
  }
}

// Optional: Remove Stray Spore role from users who aren't in any temp VC
async function sweepOrphanedStraySpores(guild) {
  try {
    // Get all active temp VCs
    const activeVCs = new Set();
    for (const [channelId] of tempOwners.entries()) {
      activeVCs.add(channelId);
    }
    
    // Get all members with Stray Spore role
    const straySporeRole = guild.roles.cache.get(config.STRAY_SPORE_ROLE_ID);
    if (!straySporeRole) return;
    
    // Fetch all members with the role
    const members = await guild.members.fetch();
    const straySpores = members.filter(m => 
      m.roles.cache.has(config.STRAY_SPORE_ROLE_ID) && 
      !m.user.bot
    );
    
    // Check each Stray Spore
    for (const [memberId, member] of straySpores) {
      // Skip if they're in a temp VC
      if (member.voice.channelId && activeVCs.has(member.voice.channelId)) {
        continue;
      }
      
      // Skip if they're a guild member (has any base role)
      if (member.roles.cache.has(config.ROLE_BASE_MEMBER) ||
          member.roles.cache.has(config.ROLE_BASE_OFFICER) ||
          member.roles.cache.has(config.ROLE_BASE_VETERAN)) {
        continue;
      }
      
      // If they're not in any temp VC and not a guild member, remove the role
      // Only do this for members who haven't been active in the last 24 hours
      const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
      if (member.joinedTimestamp < twentyFourHoursAgo) {
        try {
          await member.roles.remove(config.STRAY_SPORE_ROLE_ID);
          console.log(`Removed orphaned Stray Spore role from ${member.user.tag}`);
        } catch (error) {
          console.error(`Failed to remove Stray Spore role from ${member.user.tag}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Failed to sweep orphaned Stray Spores:', error);
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
        '**Note:** Guild members can find your chamber using `/vc goto host:${member.displayName}`'
      ].join('\n'))
      .setColor(0x8B4513)
      .setTimestamp();

    await member.send({ embeds: [dmEmbed] });
    console.log(`Sent War Chamber invite DM to ${member.user.tag}`);
  } catch (error) {
    console.error('Failed to send invite DM:', error);
  }
}

// New function to post invite to voice channel chat
async function postInviteToVoiceChat(voiceChannel, invite, member) {
  try {
    // Create message with instructions
    const message = [
      `**${member.displayName}'s War Chamber is Open!**`,
      '',
      '**For the Host:**',
      '• Your invite link has been sent to your DMs',
      '• Share that link with friends outside the guild',
      '• They\'ll get Stray Spore role automatically',
      '• They\'ll be moved to your War Chamber',
      '',
      '**For Guild Members:**',
      `• Use \`/vc goto host:${member.displayName}\` to join this chamber`,
      '',
      '**Stray Spore Invite:**',
      `${invite.url}`,
      '',
      '_This invite expires in 24 hours and gives unlimited uses._',
      '',
      '**New Stray Spores:** Use `/addalt` to set your WoW character name'
    ].join('\n');

    // Send to voice channel chat
    await voiceChannel.send(message);
    
    console.log(`Posted invite info to voice channel chat for ${member.user.tag}`);
    return true;
  } catch (error) {
    console.error('Failed to post invite message to voice chat:', error);
    return false;
  }
}

export async function createTempVCFor(member) {
  const guild = member.guild;
  
  const name = (config.TEMP_VC_NAME_FMT || 'War Chamber – {user}')
    .replace('{user}', member.displayName);

  // Check if user is in the OWNER_IDS list
  const isHighProphet = isOwner(member.id);
  
  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.Connect, 
        PermissionFlagsBits.CreateInstantInvite
      ],
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
        PermissionFlagsBits.SendMessages, // For voice chat
        // Only High Prophets (owners defined in OWNER_IDS) can create invites
        ...(isHighProphet ? [PermissionFlagsBits.CreateInstantInvite] : [])
      ],
    },
    {
      id: config.STRAY_SPORE_ROLE_ID, // Stray spores can connect
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
        PermissionFlagsBits.UseVAD,
        PermissionFlagsBits.SendMessages, // For voice chat
      ],
      deny: [PermissionFlagsBits.CreateInstantInvite],
    },
    {
      id: guild.members.me.id, // Bot permissions
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.MoveMembers,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.CreateInstantInvite, // Bot needs this to create invites
        PermissionFlagsBits.SendMessages, // For voice chat
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

  // AUTO-CREATE INVITE - Only the bot creates invites
  const invite = await createAutoInvite(ch, member);
  if (invite) {
    // Send DM to host with their invite
    await sendInviteDM(member, invite, ch);
    // Post instructions in voice channel chat
    await postInviteToVoiceChat(ch, invite, member);
  }

  // Move member to new chamber
  try {
    await member.voice.setChannel(ch);
  } catch (e) {
    console.log('Could not auto-move member to new chamber:', e.message);
  }

  scheduleDeleteIfEmpty(ch.id, guild);

  console.log('Created temp VC for', member.user.tag, '->', ch.name, `(${ch.id})`);
  
  return ch;
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
        console.log(`Auto-assigned Stray Spore role to ${member.user.tag} via War Chamber invite`);
        
        // Mark this user as needing to set their name
        pendingNameSetups.add(member.id);
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
    
    // Send welcome message to the voice channel
    if (voiceChannel) {
      voiceChannel.send(
        `**${member.displayName}** has joined **${inviteData.ownerDisplayName}**'s War Chamber as a Stray Spore! Welcome!`
      ).catch(() => {});
    }

    // Send character name modal to new Stray Spore
    try {
      await sendCharacterNameDM(member);
    } catch (error) {
      console.log('Could not send character name DM to new Stray Spore:', error.message);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to handle temp VC invite join:', error);
    return false;
  }
}

// Send DM with character name setup instructions
async function sendCharacterNameDM(member) {
  try {
    const nameButton = new ButtonBuilder()
      .setCustomId(`setname`)
      .setLabel('Set WoW Character Name')
      .setStyle(ButtonStyle.Success);

    const buttonRow = new ActionRowBuilder().addComponents(nameButton);

    const dmEmbed = new EmbedBuilder()
      .setTitle('Welcome, Stray Spore!')
      .setDescription([
        'Welcome to the guild! As a Stray Spore, please set your WoW character name.',
        '',
        'Click the button below to set your character name:',
      ].join('\n'))
      .setColor(0x9ACD32);

    await member.send({ 
      embeds: [dmEmbed],
      components: [buttonRow]
    });
    console.log(`Sent character setup DM to ${member.user.tag}`);
  } catch (error) {
    console.error('Failed to send character setup DM:', error);
  }
}

// Create the character name modal
export function createCharacterNameModal() {
  const modal = new ModalBuilder()
    .setCustomId('character_name_modal')
    .setTitle('Set WoW Character Name');

  const nameInput = new TextInputBuilder()
    .setCustomId('character_name')
    .setLabel('Enter your WoW character name')
    .setPlaceholder('e.g. Thrall')
    .setMinLength(2)
    .setMaxLength(24)
    .setRequired(true)
    .setStyle(TextInputStyle.Short);

  const actionRow = new ActionRowBuilder().addComponents(nameInput);
  modal.addComponents(actionRow);

  return modal;
}

// Handle character name submission
export async function handleCharacterNameSubmit(interaction) {
  try {
    const characterName = interaction.fields.getTextInputValue('character_name');
    
    // Validate character name
    if (!/^[A-Za-z\s'-]{2,24}$/.test(characterName)) {
      return interaction.reply({
        content: 'Invalid character name. Please use only letters, spaces, apostrophes, and hyphens.',
        ephemeral: true
      });
    }
    
    // Set the nickname
    await interaction.member.setNickname(characterName, 'Stray Spore character name setup');
    
    // Remove from pending setups
    pendingNameSetups.delete(interaction.user.id);
    
    return interaction.reply({
      content: `✅ Your nickname has been set to **${characterName}**!`,
      ephemeral: true
    });
  } catch (error) {
    console.error('Failed to set character name:', error);
    return interaction.reply({
      content: 'Failed to set your nickname. Please try again later or contact a guild officer.',
      ephemeral: true
    });
  }
}

// Get invite info for a temp VC
export function getTempVCInviteInfo(channelId) {
  return tempInvites.get(channelId) || null;
}

// Grant access to existing guild member
export async function grantAccessToMember(member, channelId) {
  try {
    // Assign Stray Spore role if they don't have it
    if (config.STRAY_SPORE_ROLE_ID && !member.roles.cache.has(config.STRAY_SPORE_ROLE_ID)) {
      await member.roles.add(config.STRAY_SPORE_ROLE_ID);
      console.log(`Granted Stray Spore role to ${member.user.tag} via access button`);
    }
    
    // Get the channel
    const channel = member.guild.channels.cache.get(channelId);
    if (!channel) {
      return { success: false, message: 'War Chamber not found.' };
    }
    
    // If they're in voice, move them
    if (member.voice.channelId) {
      try {
        await member.voice.setChannel(channel);
        return { 
          success: true, 
          message: `You now have access to the War Chamber! You've been moved to ${channel.name}.` 
        };
      } catch (error) {
        return { 
          success: true, 
          message: `You now have access to the War Chamber! Join voice and use /vc to move there.` 
        };
      }
    } else {
      return { 
        success: true, 
        message: `You now have access to the War Chamber! Join voice and use /vc to move there.` 
      };
    }
  } catch (error) {
    console.error('Failed to grant access:', error);
    return { success: false, message: 'Failed to grant access. Please try again later.' };
  }
}
