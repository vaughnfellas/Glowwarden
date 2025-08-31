// ============= src/services/invite-service.js =============
import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { CHANNELS } from '../../channels.js';

export async function createSporeBoxInvite(interaction, uses) {
  const spore = await interaction.client.channels.fetch(CHANNELS.SPORE_BOX);
  
  if (!spore || spore.type !== ChannelType.GuildText) {
    throw new Error(`I can't find *#spore-box*. Check \`SPORE_BOX\` in channels.js.`);
  }

  const me = await interaction.guild.members.fetchMe();
  const perms = channel.permissionsFor(me);
  
  if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.CreateInstantInvite])) {
    throw new Error('I need *Create Invite* (and View) in *#spore-box*.');
  }

  return await channel.createInvite({
    maxAge: 86400, // 24 hours
    maxUses: uses,
    unique: true,
    reason: `Strays by ${interaction.user.tag} (${interaction.user.id})`,
  });
}

/**
 * Validates that a channel is the spore-box channel
 * @param {import('discord.js').BaseChannel} channel - Channel to validate
 * @returns {boolean} True if channel is the spore-box
 */
export function isSporeBoxChannel(channel) {
  return channel?.id === config.SPORE_BOX_CHANNEL_ID && channel.type === ChannelType.GuildText;
}

/**
 * Validates bot permissions for spore-box channel operations
 * @param {import('discord.js').Guild} guild - Discord guild
 * @param {import('discord.js').TextChannel} channel - Channel to check permissions for
 * @returns {Promise<boolean>} True if bot has required permissions
 */
export async function validateSporeBoxPermissions(guild, channel) {
  const me = await guild.members.fetchMe();
  const perms = channel.permissionsFor(me);
  
  return perms?.has([
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.CreateInstantInvite
  ]) ?? false;
}