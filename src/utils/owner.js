// src/utils/owner.js — Centralized ownership & permission helpers
import { PermissionFlagsBits, MessageFlags } from 'discord.js';
import { config } from '../config.js';
import { ROLES, getRoleName, getDisplayRole, findBaseRole } from '../roles.js';
import { tempOwners } from '../services/temp-vc-service.js';

/**
 * Returns true if the userId is listed as an owner.
 * Supports either config.OWNER_ID (single) or config.OWNER_IDS (comma-separated).
 * @param {string} userId
 * @returns {boolean}
 */
export function isOwner(userId) {
  const raw =
    (config?.OWNER_IDS ?? config?.OWNER_ID ?? '')
      .toString()
      .trim();

  if (!raw) return false;
  const owners = raw.split(',').map(s => s.trim()).filter(Boolean);
  return owners.includes(userId);
}

/**
 * Ephemerally denies non-owners; optionally allows Administrator fallback.
 * Returns true if the caller may proceed.
 * @param {import('discord.js').CommandInteraction | import('discord.js').Interaction} interaction
 * @param {{ allowAdminFallback?: boolean }} [opts]
 * @returns {Promise<boolean>}
 */
export async function checkOwnerPermission(interaction, { allowAdminFallback = true } = {}) {
  try {
    const isOwn = isOwner(interaction.user?.id ?? '');
    const isAdmin = allowAdminFallback
      ? Boolean(interaction.memberPermissions?.has?.(PermissionFlagsBits.Administrator))
      : false;

    if (isOwn || isAdmin) return true;

    const msg = 'Only the High Prophet may invoke this command.';
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
    }
  } catch (err) {
    // Last-resort guard to avoid throwing from a permission check
    // eslint-disable-next-line no-console
    console.error('checkOwnerPermission error:', err);
  }
  return false;
}

/**
 * True if a member has any base guild role and is NOT a Stray Spore.
 * @param {import('discord.js').GuildMember} member
 * @returns {boolean}
 */
export function isGuildMember(member) {
  try {
    const cache = member?.roles?.cache;
    if (!cache) return false;

    const baseRole = findBaseRole(member);
    const isStray = cache.has(ROLES.STRAY_SPORE);
    return Boolean(baseRole) && !isStray;
  } catch (error) {
    console.error('Error checking if member is guild member:', error);
    return false;
  }
}

/**
 * True if member is a Stray Spore.
 * @param {import('discord.js').GuildMember} member
 */
export function isStraySpore(member) {
  try {
    return Boolean(member?.roles?.cache?.has(ROLES.STRAY_SPORE));
  } catch (error) {
    console.error('Error checking if member is stray spore:', error);
    return false;
  }
}

/**
 * True if member is officer or veteran.
 * @param {import('discord.js').GuildMember} member
 */
export function isOfficerOrHigher(member) {
  try {
    const baseRole = findBaseRole(member);
    return baseRole === ROLES.OFFICER || baseRole === ROLES.VETERAN;
  } catch (error) {
    console.error('Error checking if member is officer or higher:', error);
    return false;
  }
}

/**
 * If user owns a temp VC, returns its channelId; else null.
 * @param {string} userId
 * @returns {string|null}
 */
export function getUserOwnedTempVC(userId) {
  try {
    for (const [channelId, ownerId] of tempOwners.entries()) {
      if (ownerId === userId) return channelId;
    }
    return null;
  } catch (error) {
    console.error('Error checking user owned temp VC:', error);
    return null;
  }
}

/**
 * True if a channelId refers to a temp VC.
 * @param {string} channelId
 */
export function isTempVC(channelId) {
  try {
    return tempOwners.has(channelId);
  } catch (error) {
    console.error('Error checking if channel is temp VC:', error);
    return false;
  }
}

/**
 * Gets the owner userId of a temp VC, if any.
 * @param {string} channelId
 * @returns {string|null}
 */
export function getTempVCOwner(channelId) {
  try {
    return tempOwners.get(channelId) || null;
  } catch (error) {
    console.error('Error getting temp VC owner:', error);
    return null;
  }
}

/**
 * Whether a member can use temp VC commands.
 * @param {import('discord.js').GuildMember} member
 * @returns {{allowed: boolean, reason?: string}}
 */
export function canUseTempVCCommands(member) {
  try {
    if (isGuildMember(member)) return { allowed: true };

    if (isStraySpore(member)) {
      return {
        allowed: false,
        reason:
          'This command is only available to guild members. Stray Spores should use the invite link provided by their host.',
      };
    }
    return {
      allowed: false,
      reason: 'You need to be a guild member to use this command.',
    };
  } catch (error) {
    console.error('Error checking temp VC command permissions:', error);
    return { allowed: false, reason: 'Error checking permissions.' };
  }
}

/**
 * Whether a member can manage a specific temp VC.
 * Officers/Veterans can manage any; owners can manage their own.
 * @param {import('discord.js').GuildMember} member
 * @param {string} channelId
 * @returns {{allowed: boolean, reason?: string}}
 */
export function canManageTempVC(member, channelId) {
  try {
    if (isOfficerOrHigher(member)) return { allowed: true };

    const owner = getTempVCOwner(channelId);
    if (owner && owner === member?.id) return { allowed: true };

    return { allowed: false, reason: 'You can only manage your own War Chamber.' };
  } catch (error) {
    console.error('Error checking temp VC management permissions:', error);
    return { allowed: false, reason: 'Error checking permissions.' };
  }
}

/**
 * Returns a normalized permission level string for a member.
 * @param {import('discord.js').GuildMember} member
 * @returns {'veteran'|'officer'|'member'|'stray_spore'|'none'}
 */
export function getUserPermissionLevel(member) {
  try {
    const cache = member?.roles?.cache;
    if (cache?.has(ROLES.STRAY_SPORE)) return 'stray_spore';
    const baseRole = findBaseRole(member);
    if (baseRole === ROLES.VETERAN) return 'veteran';
    if (baseRole === ROLES.OFFICER) return 'officer';
    if (baseRole === ROLES.MEMBER) return 'member';
    return 'none';
  } catch (error) {
    console.error('Error getting user permission level:', error);
    return 'none';
  }
}

/**
 * Pretty label for a permission level.
 * @param {'veteran'|'officer'|'member'|'stray_spore'|'none'} level
 * @returns {string}
 */
export function formatPermissionLevel(level) {
  const levels = {
    veteran: '🏆 Veteran',
    officer: '⭐ Officer',
    member: '🛡️ Member',
    stray_spore: '🌱 Stray Spore',
    none: '❓ Unknown',
  };
  return levels[level] ?? levels.none;
}
