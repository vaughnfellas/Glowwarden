// ============= src/services/invite-service.js =============
import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { config } from '../config.js';

export async function createSporeBoxInvite(interaction, uses) {
  const spore = await interaction.client.channels.fetch(config.SPORE_BOX_CHANNEL_ID);
  if (!spore || spore.type !== ChannelType.GuildText) {
    throw new Error(`I can't find *#spore-box*. Check \`SPORE_BOX_CHANNEL_ID\` in your .env.`);
  }

  const me = await interaction.guild.members.fetchMe();
  const perms = spore.permissionsFor(me);
  if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.CreateInstantInvite])) {
    throw new Error('I need *Create Invite* (and View) in *#spore-box*.');
  }

  return await spore.createInvite({
    maxAge: 86400, // 24h
    maxUses: uses,
    unique: true,
    reason: `Strays by ${interaction.user.tag} (${interaction.user.id})`,
  });
}

export async function sendInviteToUser(user, invite, uses) {
  try {
    await user.send([
      `Here are your guest passes for **#spore-box** (valid 24h, **${uses}** uses):`,
      invite.url,
      '',
      '_Need a temp voice channel? Join *Sporehall* and I\'ll conjure one for you._',
    ].join('\n'));
    return true;
  } catch {
    return false;
  }
}

export async function logInviteCreation(client, interaction, invite, uses) {
  if (config.LOG_CHANNEL_ID === '0') return;

  try {
    const log = await client.channels.fetch(config.LOG_CHANNEL_ID).catch(() => null);
    if (!log?.isTextBased()) return;

    const expiresTs = Math.floor(Date.now() / 1000) + 86400;
    await log.send([
      `📜 **Strays Issued**`,
      `• By: ${interaction.user} (${interaction.user.tag})`,
      `• Uses: **${uses}**`,
      `• Link: ${invite.url}`,
      `• Expires: <t:${expiresTs}:R>`,
      `• Channel: <#${config.SPORE_BOX_CHANNEL_ID}>`,
    ].join('\n'));
  } catch (e) {
    console.error('Logging failed:', e);
  }
}