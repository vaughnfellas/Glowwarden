// ============= src/commands/generate-invite.js =============
import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { config } from '../config.js';
import { createRoleInvite, logInviteCreation, getActiveTrackedInvites, revokeTrackedInvite } from '../services/invite-service.js';

export const data = new SlashCommandBuilder()
  .setName('generate-invite')
  .setDescription('Generate role-specific invite codes')
  .addSubcommand(subcommand =>
    subcommand
      .setName('stray')
      .setDescription('Generate Stray Spore invite(s)')
      .addIntegerOption(option =>
        option
          .setName('uses')
          .setDescription('Number of uses (1-50)')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(50)
      )
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription('Reason for this invite')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('officer')
      .setDescription('Generate Officer invite (Owner only)')
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription('Reason for this invite')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('veteran')
      .setDescription('Generate Veteran invite (Owner only)')
      .addStringOption(option =>
        option
          .setName('reason')
          .setDescription('Reason for this invite')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List all active role invites')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('revoke')
      .setDescription('Revoke a specific invite')
      .addStringOption(option =>
        option
          .setName('code')
          .setDescription('Invite code to revoke')
          .setRequired(true)
      )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  // Owner-only check for officer/veteran invites
  if ((subcommand === 'officer' || subcommand === 'veteran') && interaction.user.id !== config.OWNER_ID) {
    return interaction.reply({
      content: 'Only the server owner can generate Officer and Veteran invites.',
      ephemeral: true
    });
  }

  try {
    if (subcommand === 'stray') {
      const uses = interaction.options.getInteger('uses') || 1;
      const reason = interaction.options.getString('reason') || 'Stray Spore recruitment';
      
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
**Auto-assigns:** ${invite.roleName}
**Reason:** ${reason}

*New members will automatically receive the Stray Spore role.*
        `)
        .setTimestamp();

      await logInviteCreation(interaction.client, interaction, invite, uses);
      return interaction.editReply({ embeds: [embed] });

    } else if (subcommand === 'officer' || subcommand === 'veteran') {
      const reason = interaction.options.getString('reason') || `${subcommand} recruitment`;
      
      await interaction.deferReply({ ephemeral: true });
      
      const invite = await createRoleInvite(interaction.client, {
        tier: subcommand,
        uses: 1, // Single use for security
        createdBy: interaction.user.id,
        reason
      });
      
      const embed = new EmbedBuilder()
        .setColor(subcommand === 'officer' ? 0xFFD700 : 0x9932CC)
        .setTitle(`⚔️ **${invite.tierName} Invite Generated**`)
        .setDescription(`
**Invite Code:** \`${invite.code}\`
**Full URL:** ${invite.url}
**Uses:** 1 (Single use)
**Expires:** <t:${Math.floor(invite.expiresAt.getTime() / 1000)}:R>
**Auto-assigns:** ${invite.roleName}
**Reason:** ${reason}

*Send this privately to the intended recipient.*
        `)
        .setTimestamp();

      await logInviteCreation(interaction.client, interaction, invite, 1);
      return interaction.editReply({ embeds: [embed] });

    } else if (subcommand === 'list') {
      const activeInvites = getActiveTrackedInvites();
      
      if (activeInvites.length === 0) {
        return interaction.reply({ 
          content: '📋 No active role invites found.',
          ephemeral: true 
        });
      }

      const groupedInvites = {
        stray: activeInvites.filter(inv => inv.tier === 'stray'),
        officer: activeInvites.filter(inv => inv.tier === 'officer'),
        veteran: activeInvites.filter(inv => inv.tier === 'veteran')
      };

      const sections = [];
      for (const [tier, invites] of Object.entries(groupedInvites)) {
        if (invites.length > 0) {
          const list = invites.map(inv => 
            `\`${inv.code}\` (${inv.uses} uses) - Expires <t:${Math.floor(inv.expiresAt.getTime() / 1000)}:R>`
          ).join('\n');
          sections.push(`**${tier.toUpperCase()}:**\n${list}`);
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0x8B4513)
        .setTitle('📋 **Active Role Invites**')
        .setDescription(sections.join('\n\n') || 'No active invites')
        .setTimestamp()
        .setFooter({ text: `${activeInvites.length} total active invite(s)` });

      return interaction.reply({ embeds: [embed], ephemeral: true });

    } else if (subcommand === 'revoke') {
      const code = interaction.options.getString('code');
      
      await interaction.deferReply({ ephemeral: true });
      
      const success = await revokeTrackedInvite(interaction.client, code, interaction.user.id);
      
      if (success) {
        return interaction.editReply({ content: `✅ Invite \`${code}\` has been revoked.` });
      } else {
        return interaction.editReply({ content: `❌ Failed to revoke invite \`${code}\`. It may not exist or already be expired.` });
      }
    }

  } catch (error) {
    console.error('Generate invite command error:', error);
    const content = '❌ Something went wrong generating the invite.';
    
    if (interaction.deferred) {
      return interaction.editReply({ content });
    } else {
      return interaction.reply({ content, ephemeral: true });
    }
  }
}