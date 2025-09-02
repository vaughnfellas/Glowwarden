// src/commands/generate-invite.js
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('generate-invite')
  .setDescription('Create an invite link for a channel.')
  .addChannelOption((opt) =>
    opt
      .setName('channel')
      .setDescription('Channel to create the invite for')
      .addChannelTypes(
        ChannelType.GuildText,
        ChannelType.GuildVoice,
        ChannelType.GuildStageVoice,
        ChannelType.GuildForum,
        ChannelType.GuildAnnouncement
      )
      .setRequired(true)
  )
  .addIntegerOption((opt) =>
    opt
      .setName('maxuses')
      .setDescription('Max uses (default 1)')
      .setMinValue(0) // 0 = unlimited
  )
  .addIntegerOption((opt) =>
    opt
      .setName('expires')
      .setDescription('Expiration in minutes (default 60, max 7 days)')
      .setMinValue(0) // 0 = never expires
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.CreateInstantInvite);

export async function execute(interaction) {
  const channel = interaction.options.getChannel('channel', true);
  const maxUses = interaction.options.getInteger('maxuses') ?? 1;
  const expiresMinutes = interaction.options.getInteger('expires') ?? 60;

  // Cap to Discord’s max 7 days (604800s)
  const maxAgeSeconds =
    expiresMinutes === 0 ? 0 : Math.min(604800, expiresMinutes * 60);

  // Some channel types can’t have invites
  if (!('invites' in channel) || !channel.invites?.create) {
    return interaction.reply({
      content: 'That channel type cannot have invites.',
      ephemeral: true,
    });
  }

  try {
    const invite = await channel.invites.create({
      maxUses: Math.max(0, maxUses), // 0 = unlimited
      maxAge: maxAgeSeconds, // 0 = never expires
      temporary: false,
      unique: true,
      reason: `Requested by ${interaction.user.tag}`,
    });

    await interaction.reply({
      content: `Here’s your invite for ${channel}:\nhttps://discord.gg/${invite.code}`,
      ephemeral: true,
    });
  } catch (err) {
    console.error('Invite creation failed:', err);
    await interaction.reply({
      content:
        'I couldn’t create the invite. Do I have **Create Invite** and **View Channel** perms there?',
      ephemeral: true,
    });
  }
}
