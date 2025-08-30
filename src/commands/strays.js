// ============= src/commands/strays.js =============
import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { config } from '../config.js';
import { createSporeBoxInvite, sendInviteToUser, logInviteCreation } from '../services/invite-service.js';

export const data = new SlashCommandBuilder()
  .setName('strays')
  .setDescription('Generate guest passes for #spore-box')
  .addIntegerOption(option =>
    option.setName('count')
      .setDescription(`Number of uses (1-${config.MAX_USES})`)
      .setMinValue(1)
      .setMaxValue(config.MAX_USES)
  );

export async function execute(interaction) {
  console.log('↪ /strays received from', interaction.user.tag);

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  } catch {}

  const requested = interaction.options.getInteger('count') ?? config.DEFAULT_USES;
  const uses = Math.min(Math.max(requested, 1), config.MAX_USES);

  try {
    const invite = await createSporeBoxInvite(interaction, uses);

    // RP flourish
    try {
      await interaction.channel?.send(
        `🌿 ${interaction.user} loosens a spore-satchel; **${uses}** guest passes swirl into being.`
      );
    } catch {}

    // Send DM
    const dmSent = await sendInviteToUser(interaction.user, invite, uses);

    if (dmSent) {
      await interaction.editReply('✉️ Your passes have been sent to your DMs.');
    } else {
      await interaction.editReply(
        `⚠️ I couldn't DM you (privacy settings). Here's your invite (only you can see this):\n${invite.url}`
      );
    }

    // Log
    await logInviteCreation(interaction.client, interaction, invite, uses);

  } catch (err) {
    console.error('Invite error:', err);
    try {
      await interaction.editReply(`⛔ ${err.message || 'Could not create invite (check bot perms).'}`);
    } catch {}
  }
}