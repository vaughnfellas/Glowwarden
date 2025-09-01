// ============= src/services/invite-service.js =============
import { ChannelType, PermissionFlagsBits, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { config } from '../config.js';
import { CHANNELS } from '../channels.js';

// Track invites with their intended roles
const inviteRoleMap = new Map(); // inviteCode -> { roleId, tier, createdBy, reason }

/**
 * Create invite with specific role assignment
 * @param {Object} options - Invite creation options
 * @param {Client} client - Discord client
 * @param {string} options.tier - 'stray', 'officer', or 'veteran'
 * @param {number} options.uses - Number of uses (default 1)
 * @param {string} options.createdBy - User ID who created the invite
 * @param {string} options.reason - Reason for invite
 * @returns {Promise<Object>} Invite object with metadata
 */
export async function createRoleInvite(client, { tier, uses = 1, createdBy, reason }) {
  const guild = client.guilds.cache.get(config.GUILD_ID);
  if (!guild) throw new Error('Guild not found');

  // Determine target channel and role
  let channelId, roleId, tierName;
  
  switch (tier) {
    case 'stray':
      channelId = CHANNELS.SPORE_BOX || config.SPORE_BOX_CHANNEL_ID;
      roleId = config.STRAY_SPORE_ROLE_ID;
      tierName = 'Stray Spore';
      break;
    case 'officer':
      channelId = CHANNELS.CHAMBER_OF_OATHS; // or wherever officers should land
      roleId = config.ROLE_BASE_OFFICER;
      tierName = 'Base Officer';
      break;
    case 'veteran':
      channelId = CHANNELS.CHAMBER_OF_OATHS; // or wherever veterans should land  
      roleId = config.ROLE_BASE_VETERAN;
      tierName = 'Base Veteran';
      break;
    default:
      throw new Error('Invalid tier specified');
  }

  const channel = guild.channels.cache.get(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error(`Target channel not found for ${tier}`);
  }

  const role = guild.roles.cache.get(roleId);
  if (!role) {
    throw new Error(`Target role not found for ${tier}`);
  }

  // Check permissions
  const me = await guild.members.fetchMe();
  const perms = channel.permissionsFor(me);
  if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.CreateInstantInvite])) {
    throw new Error(`Missing permissions in ${channel.name}`);
  }

  // Create the invite
  const invite = await channel.createInvite({
    maxAge: 86400, // 24 hours
    maxUses: uses,
    unique: true,
    reason: `${tierName} invite by ${createdBy} - ${reason}`,
  });

  // Store the role mapping
  inviteRoleMap.set(invite.code, {
    roleId,
    tier,
    tierName,
    createdBy,
    reason,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 86400000),
    uses
  });

  return {
    code: invite.code,
    url: invite.url,
    expiresAt: invite.expiresAt,
    maxUses: invite.maxUses,
    tier,
    tierName,
    roleId,
    roleName: role.name
  };
}

// Legacy function for backward compatibility
export async function createSporeBoxInvite(interaction, uses) {
  return createRoleInvite(interaction.client, {
    tier: 'stray',
    uses,
    createdBy: interaction.user.id,
    reason: 'Stray Spore recruitment'
  });
}

export async function sendInviteToUser(user, invite, uses) {
  try {
    const tierMessages = {
      stray: [
        `Here are your guest passes for **#spore-box** (valid 24h, **${uses}** uses):`,
        invite.url,
        '',
        '_Need a temp voice channel? Join *Sporehall* and I\'ll conjure one for you._',
      ],
      officer: [
        `Here is your **Officer** invitation to the Holy Gehy Empire (valid 24h, **${uses}** uses):`,
        invite.url,
        '',
        '_Welcome to the ranks, Officer. Your service is valued._',
      ],
      veteran: [
        `Here is your **Veteran** invitation to the Holy Gehy Empire (valid 24h, **${uses}** uses):`,
        invite.url,
        '',
        '_Welcome back, Veteran. Your experience guides us forward._',
      ]
    };

    const inviteData = inviteRoleMap.get(invite.code);
    const tier = inviteData?.tier || 'stray';
    const message = tierMessages[tier] || tierMessages.stray;

    await user.send(message.join('\n'));
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

    const inviteData = inviteRoleMap.get(invite.code);
    const tierName = inviteData?.tierName || 'Unknown';
    const expiresTs = Math.floor(Date.now() / 1000) + 86400;

    await log.send([
      `📜 **${tierName} Invite Created**`,
      `• By: ${interaction.user} (${interaction.user.tag})`,
      `• Uses: **${uses}**`,
      `• Link: ${invite.url}`,
      `• Expires: <t:${expiresTs}:R>`,
      `• Target Role: <@&${inviteData?.roleId}>`,
      `• Reason: ${inviteData?.reason || 'Not specified'}`,
    ].join('\n'));
  } catch (e) {
    console.error('Logging failed:', e);
  }
}

/**
 * Handle member join via tracked invite
 * @param {GuildMember} member - Member who joined
 * @param {string} inviteCode - Invite code they used
 */
export async function handleTrackedInviteJoin(member, inviteCode) {
  const inviteData = inviteRoleMap.get(inviteCode);
  if (!inviteData) return false; // Not one of our tracked invites

  try {
    const role = member.guild.roles.cache.get(inviteData.roleId);
    if (role && !member.roles.cache.has(role.id)) {
      await member.roles.add(role);
      console.log(`Auto-assigned ${inviteData.tierName} role to ${member.user.tag} via invite ${inviteCode}`);

      // Send appropriate welcome message
      const welcomeMessages = {
        stray: `🍄 **A new spore drifts in...** Welcome ${member}, you are now a **Stray Spore**!\n*Sign the decree with \`/decree\` to choose your path.*`,
        officer: `⚔️ **An Officer arrives!** Welcome ${member}, you carry the **Officer** mantle!\n*Proceed to the Chamber of Oaths when ready.*`,
        veteran: `🏆 **A Veteran returns!** Welcome ${member}, your **Veteran** status is recognized!\n*The Chamber of Oaths awaits your presence.*`
      };

      const targetChannelId = inviteData.tier === 'stray' 
        ? CHANNELS.SPORE_BOX 
        : CHANNELS.CHAMBER_OF_OATHS;
        
      const targetChannel = member.guild.channels.cache.get(targetChannelId);
      if (targetChannel) {
        const welcomeMsg = welcomeMessages[inviteData.tier] || welcomeMessages.stray;
        await targetChannel.send({ content: welcomeMsg });
      }

      return true;
    }
  } catch (error) {
    console.error('Failed to assign role via invite:', error);
  }
  
  return false;
}

/**
 * Get active tracked invites
 * @param {string} tier - Optional tier filter ('stray', 'officer', 'veteran')
 * @returns {Array} Array of active invite data
 */
export function getActiveTrackedInvites(tier = null) {
  const now = new Date();
  return Array.from(inviteRoleMap.values())
    .filter(invite => {
      const notExpired = invite.expiresAt > now;
      const tierMatch = !tier || invite.tier === tier;
      return notExpired && tierMatch;
    });
}

/**
 * Clean up expired invites
 */
export function cleanupExpiredInvites() {
  const now = new Date();
  for (const [code, data] of inviteRoleMap) {
    if (data.expiresAt <= now) {
      inviteRoleMap.delete(code);
    }
  }
}

/**
 * Revoke a tracked invite
 * @param {Client} client - Discord client
 * @param {string} inviteCode - Code to revoke
 * @param {string} revokedBy - User ID who revoked it
 */
export async function revokeTrackedInvite(client, inviteCode, revokedBy) {
  try {
    const guild = client.guilds.cache.get(config.GUILD_ID);
    const invite = await guild.invites.fetch(inviteCode);
    
    if (invite) {
      await invite.delete(`Revoked by ${revokedBy}`);
      inviteRoleMap.delete(inviteCode);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to revoke tracked invite:', error);
    return false;
  }
}

