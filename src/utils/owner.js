// ============= src/utils/owner.js =============
import { MessageFlags } from 'discord.js';

export function isOwner(userId) {
  const ownerIds = process.env.OWNER_IDS?.split(',').map(id => id.trim()) || [];
  return ownerIds.includes(String(userId));
}

export async function checkOwnerPermission(interaction) {
  if (!isOwner(interaction.user.id)) {
    await interaction.reply({
      content: '❌ This command is restricted to server owners only.',
      flags: MessageFlags.Ephemeral
    });
    return false;
  }
  return true;
}