// src/commands/generate-invite.js
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
} from 'discord.js';
import { isOwner } from '../utils/owner.js';
import { config } from '../config.js';
import { InviteDB } from '../database/invites.js';

// In-memory map for fast lookups (loaded from DB on startup)
const dynamicInviteRoleMap = new Map();
export const getDynamicInviteMap = () => dynamicInviteRoleMap;

// Load mappings from DB on startup
export async function loadInviteMappingsFromDB() {
  try {
    const result = await InviteDB.getAllInviteMappings();
    if (!result.ok) {
      console.error('Failed to load invite mappings from database:', result.error);
      return false;
    }
    const mappings = result.data || [];
    mappings.forEach(mapping => {
      dynamicInviteRoleMap.set(mapping.invite_code, mapping.role_id);
    });
    console.log(`Loaded ${mappings.length} invite mappings from database`);
    return true;
  } catch (error) {
    console.error('Failed to load invite mappings from database:', error);
    return false;
  }
}

export const data = new SlashCommandBuilder()
  .setName('generate-invite')
  .setDescription('Create a role-specific invite link (Owner only)')
  .addStringOption(option =>
    option
      .setName('role')
      .setDescription('Which role to assign to new members')
      .setRequired(true)
      .addChoices(
        { name: 'Member', value: 'member' },
        { name: 'Officer', value: 'officer' },
        { name: 'Veteran', value: 'veteran' }
      )
  )
  .addIntegerOption(option =>
    option
      .setName('uses')
      .setDescription('Maximum uses (0 = unlimited)')
      .setRequired(false)
      .setMinValue(0)
      .setMaxValue(100)
  )
  .addIntegerOption(option =>
    option
      .setName('expires_days')
      .setDescription('Days until expiration (0 = never)')
      .setRequired(false)
      .setMinValue(0)
      .setMaxValue(30)
  )
  .addChannelOption(option =>
    option
      .setName('channel')
      .setDescription('Channel for the invite (defaults to current)')
      .setRequired(false)
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  // Check if user is owner
  if (!isOwner(interaction.user.id)) {
    return interaction.reply({
      content: '⚠️ Only High Prophets can generate role invites.',
      flags: MessageFlags.Ephemeral
    });
  }

  const roleType = interaction.options.getString('role', true);
  const channel = interaction.options.getChannel('channel') || interaction.channel;
  
  // Validate channel
  if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildVoice)) {
    return interaction.reply({
      content: '⚠️ Invalid channel. Please select a text or voice channel.',
      flags: MessageFlags.Ephemeral
    });
  }

  // Get role ID based on selection
  let roleId;
  let roleName;
  let defaultUses;
  let defaultExpireDays;

  switch (roleType) {
    case 'member':
      roleId = config.ROLE_BASE_MEMBER;
      roleName = 'Member';
      defaultUses = 0; // unlimited
      defaultExpireDays = 0; // never expires
      break;
    case 'officer':
      roleId = config.ROLE_BASE_OFFICER;
      roleName = 'Officer';
      defaultUses = 1;
      defaultExpireDays = 7;
      break;
    case 'veteran':
      roleId = config.ROLE_BASE_VETERAN;
      roleName = 'Veteran';
      defaultUses = 1;
      defaultExpireDays = 7;
      break;
    default:
      return interaction.reply({
        content: '⚠️ Invalid role selection.',
        flags: MessageFlags.Ephemeral
      });
  }

  if (!roleId) {
    return interaction.reply({
      content: `⚠️ ${roleName} role ID not configured in environment variables.`,
      flags: MessageFlags.Ephemeral
    });
  }

  // Check if role exists
  const role = interaction.guild.roles.cache.get(roleId);
  if (!role) {
    return interaction.reply({
      content: `⚠️ ${roleName} role not found in this server.`,
      flags: MessageFlags.Ephemeral
    });
  }

  // Get options or use defaults
  const maxUses = interaction.options.getInteger('uses') ?? defaultUses;
  const expireDays = interaction.options.getInteger('expires_days') ?? defaultExpireDays;
  
  const maxAgeSeconds = expireDays > 0 ? expireDays * 24 * 60 * 60 : 0;

  await interaction.deferReply({ ephemeral: true });

  try {
    // Create Discord invite
    const invite = await channel.createInvite({
      maxUses: maxUses,
      maxAge: maxAgeSeconds,
      temporary: false,
      unique: true,
      reason: `${roleName} invite created by ${interaction.user.tag}`,
    });

    let expiresAt = null;
    if (maxAgeSeconds > 0) {
      expiresAt = new Date(Date.now() + (maxAgeSeconds * 1000));
    }

    // Store in memory for fast access
    dynamicInviteRoleMap.set(invite.code, roleId);

    // Store in database
    const dbResult = await InviteDB.addInviteMapping(
      invite.code,
      roleId,
      interaction.user.id,
      interaction.guild.id,
      channel.id,
      expiresAt,
      maxUses,
      `${roleName} invite created by ${interaction.user.tag}`
    );

    if (!dbResult.ok) {
      console.error(`Failed to store invite mapping for ${invite.code}:`, dbResult.error);
      // Clean up Discord invite
      try {
        await invite.delete();
      } catch (deleteError) {
        console.error('Failed to clean up Discord invite:', deleteError);
      }
      dynamicInviteRoleMap.delete(invite.code);
      
      return interaction.editReply({
        content: `⚠️ Failed to save invite mapping to database: ${dbResult.error}. Invite not created.`,
      });
    }

    // Success response
    const responseLines = [
      `✅ **${roleName} Invite Created**`,
      ``,
      `**Invite Link:** https://discord.gg/${invite.code}`,
      `**Channel:** ${channel}`,
      `**Role:** ${role.name}`,
      `**Uses:** ${maxUses === 0 ? 'unlimited uses' : `${maxUses} use${maxUses !== 1 ? 's' : ''}`}`,
      `**Expiration:** ${maxAgeSeconds === 0 ? 'never expires' : `expires in ${expireDays} day${expireDays !== 1 ? 's' : ''}`}`,
      ``,
      `This invite will automatically assign the ${role.name} role to new members.`,
      `The mapping has been saved to the database and will persist across bot restarts.`
    ];

    await interaction.editReply({
      content: responseLines.join('\n'),
    });

    console.log(`Created ${roleName} invite: ${invite.code} -> ${role.name} (${roleId})`);

  } catch (err) {
    console.error(`Invite creation failed:`, err);
    await interaction.editReply({
      content: 'I couldn\'t create the invite. Do I have **Create Invite** and **View Channel** permissions in that channel?',
    });
  }
}