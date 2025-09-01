// ============= src/commands/strays.js =============
import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { config } from '../config.js';
import { createRoleInvite, sendInviteToUser, logInviteCreation } from '../services/invite-service.js';

export const data = new SlashCommandBuilder()
  .setName('strays')
  .setDescription('Generate Stray Spore invites for your friends')
  .addIntegerOption(option =>
    option
      .setName('uses')
      .setDescription('Number of uses (default 4, max 10)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(10)
  )
  .addStringOption(option =>
    option
      .setName('reason')
      .setDescription('Reason for this invite')
      .setRequired(false)
  );

export async function execute(interaction) {
  const uses = interaction.options.getInteger('uses') || 4; // Default 4, matching WoW group size
  const reason = interaction.options.getString('reason') || `Stray recruitment by ${interaction.user.tag}`;

  try {
    await interaction.deferReply({ ephemeral: true });
    
    const invite = await createRoleInvite(interaction.client, {
      tier: 'stray',
      uses,
      createdBy: interaction.user.id,
      reason
    });
    
    const embed = new EmbedBuilder()
      .setColor(0x8B4513)
      .setTitle('🍄 **Stray Spore Invite Generated**')
      .setDescription(`
**Invite Code:** \`${invite.code}\`
**Full URL:** ${invite.url}
**Uses:** ${invite.maxUses}
**Expires:** <t:${Math.floor(invite.expiresAt.getTime() / 1000)}:R>

*Share this with friends! They'll automatically become Stray Spores when they join.*
      `)
      .setTimestamp()
      .setFooter({ text: 'Perfect for dungeon groups!' });

    await logInviteCreation(interaction.client, interaction, invite, uses);
    return interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Strays command error:', error);
    return interaction.editReply({ 
      content: '❌ Something went wrong generating your Stray invite.' 
    });
  }
}