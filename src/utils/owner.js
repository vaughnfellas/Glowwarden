// src/utils/owner.js - Centralized permission and ownership checks
import { config } from '../config.js';
import { tempOwners } from '../services/temp-vc-service.js';

/**
 * Check if a member is a guild member (not a Stray Spore)
 * @param {GuildMember} member 
 * @returns {boolean}
 */
export function isGuildMember(member) {
  try {
    // Check if member has any of the base guild roles
    const guildRoles = [
      config.ROLE_BASE_MEMBER,
      config.ROLE_BASE_OFFICER, 
      config.ROLE_BASE_VETERAN
    ].filter(roleId => roleId); // Filter out undefined roles

    return guildRoles.some(roleId => member.roles.cache.has(roleId)) &&
           !member.roles.cache.has(config.ROLE_STRAY_SPORE_ID);
  } catch (error) {
    console.error('Error checking if member is guild member:', error);
    return false;
  }
}

/**
 * Check if a member is a Stray Spore
 * @param {GuildMember} member 
 * @returns {boolean}
 */
export function isStraySpore(member) {
  try {
    return member.roles.cache.has(config.ROLE_STRAY_SPORE_ID);
  } catch (error) {
    console.error('Error checking if member is stray spore:', error);
    return false;
  }
}

/**
 * Check if a member is an officer or higher
 * @param {GuildMember} member 
 * @returns {boolean}
 */
export function isOfficerOrHigher(member) {
  try {
    return member.roles.cache.has(config.ROLE_BASE_OFFICER) || 
           member.roles.cache.has(config.ROLE_BASE_VETERAN);
  } catch (error) {
    console.error('Error checking if member is officer or higher:', error);
    return false;
  }
}

/**
 * Check if a user owns a temp VC
 * @param {string} userId 
 * @returns {string|null} channelId if owned, null otherwise
 */
export function getUserOwnedTempVC(userId) {
  try {
    for (const [channelId, ownerId] of tempOwners.entries()) {
      if (ownerId === userId) {
        return channelId;
      }
    }
    return null;
  } catch (error) {
    console.error('Error checking user owned temp VC:', error);
    return null;
  }
}

/**
 * Check if a channel is a temp VC
 * @param {string} channelId 
 * @returns {boolean}
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
 * Get the owner of a temp VC
 * @param {string} channelId 
 * @returns {string|null} ownerId if found, null otherwise
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
 * Check if a member can use temp VC commands
 * @param {GuildMember} member 
 * @returns {{allowed: boolean, reason?: string}}
 */
export function canUseTempVCCommands(member) {
  try {
    if (isGuildMember(member)) {
      return { allowed: true };
    }
    
    if (isStraySpore(member)) {
      return { 
        allowed: false, 
        reason: 'This command is only available to guild members. Stray Spores should use the invite link provided by their host.' 
      };
    }
    
    return { 
      allowed: false, 
      reason: 'You need to be a guild member to use this command.' 
    };
  } catch (error) {
    console.error('Error checking temp VC command permissions:', error);
    return { allowed: false, reason: 'Error checking permissions.' };
  }
}

/**
 * Check if a member can manage a specific temp VC
 * @param {GuildMember} member 
 * @param {string} channelId 
 * @returns {{allowed: boolean, reason?: string}}
 */
export function canManageTempVC(member, channelId) {
  try {
    // Officers and veterans can manage any temp VC
    if (isOfficerOrHigher(member)) {
      return { allowed: true };
    }
    
    // Owner can manage their own temp VC
    const owner = getTempVCOwner(channelId);
    if (owner === member.id) {
      return { allowed: true };
    }
    
    return { 
      allowed: false, 
      reason: 'You can only manage your own War Chamber.' 
    };
  } catch (error) {
    console.error('Error checking temp VC management permissions:', error);
    return { allowed: false, reason: 'Error checking permissions.' };
  }
}

/**
 * Get user permission level
 * @param {GuildMember} member 
 * @returns {'veteran'|'officer'|'member'|'stray_spore'|'none'}
 */
export function getUserPermissionLevel(member) {
  try {
    if (member.roles.cache.has(config.ROLE_BASE_VETERAN)) {
      return 'veteran';
    }
    if (member.roles.cache.has(config.ROLE_BASE_OFFICER)) {
      return 'officer';
    }
    if (member.roles.cache.has(config.ROLE_BASE_MEMBER)) {
      return 'member';
    }
    if (member.roles.cache.has(config.ROLE_STRAY_SPORE_ID)) {
      return 'stray_spore';
    }
    return 'none';
  } catch (error) {
    console.error('Error getting user permission level:', error);
    return 'none';
  }
}

/**
 * Format permission level for display
 * @param {string} level 
 * @returns {string}
 */
export function formatPermissionLevel(level) {
  const levels = {
    'veteran': '🏆 Veteran',
    'officer': '⭐ Officer', 
    'member': '🛡️ Member',
    'stray_spore': '🌱 Stray Spore',
    'none': '❓ Unknown'
  };
  return levels[level] || levels.none;
}