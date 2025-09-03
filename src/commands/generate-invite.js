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

// In-memory invite role map for quick lookups
const dynamicInviteRoleMap = new Map();

// Export the map so invite-role-service can access it
export const getDynamicInviteMap = () => dynamicInviteRoleMap;

// Load all invite mappings from database on startup
export async function loadInviteMappingsFromDB() {
  try {
    const mappings = await InviteDB.getAllInviteMappings();
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
  .setDescription('Create a role-specific invite link (High Prophet only)')
  .addStringOption(opt =>
    opt
      .setName('role')
      .setDescription('Role to assign to users who join with this invite')
      .setRequired(true)
      .addChoices(
        { name: 'Member', value: 'member' },
        { name: 'Officer', value: 'officer' },
        { name: 'Veteran', value: 'veteran' }
      )
  )
  .addIntegerOption(opt =>
    opt
      .setName('uses')
      .setDescription('Max uses (0 = unlimited)')
      .setMinValue(0)
      .setRequired(false)
  )
  .addIntegerOption(opt =>
    opt
      .setName('expires')
      .setDescription('Expiration in days (0 = never expires)')
      .setMinValue(0)
      .setRequired(false)
  )
  .addChannelOption(opt =>
    opt
      .setName('channel')
      .setDescription('Channel to create the invite for (defaults to Chamber of Oaths)')
      .addChannelTypes(
        ChannelType.GuildText,
        ChannelType.GuildVoice
      )
      .setRequired(false)
  );

export async function execute(interaction) {
  // Check if user is a High Prophet
  if (!isOwner(interaction.user.id)) {
    return interaction.reply({
      content: '❌ Only High Prophets can generate role invites.',
      flags: MessageFlags.Ephemeral
    });
  }

  const roleType = interaction.options.getString('role');
  const maxUses = interaction.options.getInteger('uses') ?? 1;
  const expireDays = interaction.options.getInteger('expires') ?? 7;
  
  // Default to Chamber of Oaths if no channel specified
  let channel = interaction.options.getChannel('channel');
  if (!channel) {
    channel = interaction.guild.channels.cache.get(config.DECREE_CHANNEL_ID);
    if (!channel) {
      return interaction.reply({
        content: '❌ Chamber of Oaths channel not found. Please specify a channel.',
        flags: MessageFlags.Ephemeral
      });
    }
  }

  // Map role type to actual role ID
  let roleId;
  let roleName;
  switch (roleType) {
    case 'member':
      roleId = config.ROLE_BASE_MEMBER;
      roleName = 'Member';
      break;
    case 'officer':
      roleId = config.ROLE_BASE_OFFICER;
      roleName = 'Officer';
      break;
    case 'veteran':
      roleId = config.ROLE_BASE_VETERAN;
      roleName = 'Veteran';
      break;
    default:
      return interaction.reply({
        content: '❌ Invalid role type selected.',
        flags: MessageFlags.Ephemeral
      });
  }

  if (!roleId) {
    return interaction.reply({
      content: `❌ Role ID for ${roleName} not configured in environment variables.`,
      flags: MessageFlags.Ephemeral
    });
  }

  // Convert days to seconds for Discord API
  const maxAgeSeconds = expireDays === 0 ? 0 : expireDays * 86400; // 86400 seconds = 1 day

  try {
    // Create the invite
    const invite = await channel.createInvite({
      maxUses: maxUses, // 0 = unlimited
      maxAge: maxAgeSeconds, // 0 = never expires
      temporary: false,
      unique: true,
      reason: `${roleName} invite created by ${interaction.user.tag}`,
    });

    // Calculate expiration date for database
    let expiresAt = null;
    if (maxAgeSeconds > 0) {
      expiresAt = new Date(Date.now() + (maxAgeSeconds * 1000));
    }

    // Store the invite code -> role mapping in our dynamic map
    dynamicInviteRoleMap.set(invite.code, roleId);

    // Store in database for persistence
    await InviteDB.addInviteMapping(
      invite.code,
      roleId,
      interaction.user.id,
      expiresAt,
      maxUses
    );

    // Format expiration text
    let expirationText;
    if (maxAgeSeconds === 0) {
      expirationText = "never expires";
    } else {
      expirationText = `expires in ${expireDays} day${expireDays !== 1 ? 's' : ''}`;
    }

    // Format uses text
    let usesText;
    if (maxUses === 0) {
      usesText = "unlimited uses";
    } else {
      usesText = `${maxUses} use${maxUses !== 1 ? 's' : ''}`;
    }

    await interaction.reply({
      content: [
        `✅ **${roleName} Invite Created**`,
        ``,
        `**Invite Link:** https://discord.gg/${invite.code}`,
        `**Channel:** ${channel}`,
        `**Role:** ${roleName}`,
        `**Uses:** ${usesText}`,
        `**Expiration:** ${expirationText}`,
        ``,
        `This invite will automatically assign the ${roleName} role to new members.`,
        `The mapping has been saved to the database and will persist across bot restarts.`
      ].join('\n'),
      ephemeral: true,
    });
  } catch (err) {
    console.error('Invite creation failed:', err);
    await interaction.reply({
      content: 'I couldn\'t create the invite. Do I have **Create Invite** and **View Channel** permissions?',
      ephemeral: true,
    });
  }
}
