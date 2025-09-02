// ============= src/commands/vc-status.js =============
import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { tempOwners, tempInvites, getTempVCInviteInfo } from '../services/temp-vc-service.js';
import { config } from '../config.js';
import { CHANNELS } from '../channels.js';

export const data = new SlashCommandBuilder()
  .setName('vc-status')
  .setDescription('Show status of active War Chambers and their invites');

export async function execute(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const category = guild.channels.cache.get(CHANNELS.BATTLEFRONT);
    
    if (!category) {
      return interaction.editReply('❌ Battlefront category not found.');
    }

    // Get all temp VCs in the battlefront
    const tempVCs = guild.channels.cache.filter(ch => 
      ch.parentId === CHANNELS.BATTLEFRONT && 
      ch.type === 0 && // GuildVoice
      tempOwners.has(ch.id)
    );

    if (tempVCs.size === 0) {
      return interaction.editReply('📭 No active War Chambers found.');
    }

    const embed = new EmbedBuilder()
      .setTitle('🏰 Active War Chambers')
      .setColor(0x8B4513)
      .setTimestamp();

    let description = [];
    let totalGuests = 0;

    for (const [channelId, channel] of tempVCs) {
      const ownerId = tempOwners.get(channelId);
      const inviteInfo = tempInvites.get(channelId);
      const memberCount = channel.members.size;
      totalGuests += memberCount;

      try {
        const owner = await guild.members.fetch(ownerId).catch(() => null);
        const ownerName = owner ? owner.displayName : 'Unknown';
        
        let vcInfo = [`**${channel.name}**`];
        vcInfo.push(`👑 Host: ${ownerName}`);
        vcInfo.push(`👥 Members: ${memberCount}`);
        
        if (inviteInfo) {
          const expiresTimestamp = Math.floor(inviteInfo.expiresAt.getTime() / 1000);
          vcInfo.push(`🎫 Invite: \`${inviteInfo.code}\``);
          vcInfo.push(`⏰ Expires: <t:${expiresTimestamp}:R>`);
        } else {
          vcInfo.push(`❌ No auto-invite found`);
        }
        
        description.push(vcInfo.join('\n'));
      } catch (error) {
        description.push(`**${channel.name}** - Error loading info`);
      }
    }

    embed.setDescription(description.join('\n\n'));
    embed.setFooter({ 
      text: `${tempVCs.size} active chambers • ${totalGuests} total guests` 
    });

    // Add field with user's own chamber info if they have one
    const userOwnedVC = tempVCs.find(ch => tempOwners.get(ch.id) === interaction.user.id);
    if (userOwnedVC) {
      const inviteInfo = tempInvites.get(userOwnedVC.id);
      if (inviteInfo) {
        embed.addFields({
          name: '🎯 Your Chamber Invite',
          value: `\`\`\`${inviteInfo.url}\`\`\``,
          inline: false
        });
      }
    }

    return interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    console.error('VC status command error:', error);
    return interaction.editReply('❌ Something went wrong checking War Chamber status.');
  }
}