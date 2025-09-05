// src/roles.js - Discord Role ID Mapping and Role Utilities

// Role IDs - easy to update in one place
export const ROLES = {
    // Staff roles
    GLOWWARDEN: '1410458893624021024',       // Bot
    HIGH_PROPHET: '1409780436221038674',     // Admin (you)
    LORD_PROTECTOR: '1409783274649161819',   // Admin (hubby)
    THE_COURT: '1411438170943393913',        // Moderators
    
    // Final roles (combination of base + flair)
    RAINBOW_APOSTLE: '1409783897943969802',  // Veteran Queer
    RAINBOW_ALLY_LT: '1409812919356624936',  // Veteran Ally
    GLITTER_CRUSADER: '1409791924738457661', // Officer Queer
    BANNER_BEARER: '1409814598219075625',    // Officer Ally
    MYCELIOGLITTER: '1409814627738451989',   // Member Queer
    GLITTER_ALLY: '1409816151055401062',     // Member Ally
    
    // Flair roles
    LGBTQIA2S: '1410004001390461039',        // Queer flair
    TRANSGENDER: '1410004332249743380',      // Trans flair
    ALLY: '1410004337278849105',             // Ally flair
    
    // Base roles (from invites)
    VETERAN: '1410060754140266587',          // Base Veteran
    OFFICER: '1410060765385461832',          // Base Officer
    MEMBER: '1410060768174542898',           // Base Member
    
    // Special roles
    HOST: '1410629664522764318',             // VC host
    STRAY_SPORE: '1410351404211507270',      // Temp visitor
  };
  
  // Role name mapping (for display)
  export const ROLE_NAMES = {
    [ROLES.GLOWWARDEN]: 'Glowwarden',
    [ROLES.HIGH_PROPHET]: 'High Prophet',
    [ROLES.LORD_PROTECTOR]: 'Lord Protector',
    [ROLES.THE_COURT]: 'The Court',
    [ROLES.RAINBOW_APOSTLE]: 'Rainbow Apostle',
    [ROLES.RAINBOW_ALLY_LT]: 'Rainbow Ally Lieutenant',
    [ROLES.GLITTER_CRUSADER]: 'Glitter Crusader',
    [ROLES.BANNER_BEARER]: 'Banner Bearer',
    [ROLES.MYCELIOGLITTER]: 'Mycelioglitter',
    [ROLES.GLITTER_ALLY]: 'Glitter Ally',
    [ROLES.LGBTQIA2S]: 'LGBTQIA2S+',
    [ROLES.TRANSGENDER]: 'Transgender',
    [ROLES.ALLY]: 'Ally',
    [ROLES.VETERAN]: 'Veteran',
    [ROLES.OFFICER]: 'Officer',
    [ROLES.MEMBER]: 'Member',
    [ROLES.HOST]: 'Host',
    [ROLES.STRAY_SPORE]: 'Stray Spore',
  };
  
  // Role mappings for oath ceremony
  export const ROLE_MAPPINGS = {
    // Base role + flair = final role
    BASE_TO_FINAL: {
      // Member base role
      [`${ROLES.MEMBER}:lgbt`]: ROLES.MYCELIOGLITTER,
      [`${ROLES.MEMBER}:ally`]: ROLES.GLITTER_ALLY,
      
      // Officer base role
      [`${ROLES.OFFICER}:lgbt`]: ROLES.GLITTER_CRUSADER,
      [`${ROLES.OFFICER}:ally`]: ROLES.BANNER_BEARER,
      
      // Veteran base role
      [`${ROLES.VETERAN}:lgbt`]: ROLES.RAINBOW_APOSTLE,
      [`${ROLES.VETERAN}:ally`]: ROLES.RAINBOW_ALLY_LT,
    },
    
    // Flair roles
    FLAIR: {
      'lgbt': ROLES.LGBTQIA2S,
      'ally': ROLES.ALLY,
    },
    
    // Base roles (for checking)
    BASE_ROLES: [ROLES.MEMBER, ROLES.OFFICER, ROLES.VETERAN],
  };
  
  /**
   * Get the final role ID based on base role and flair
   * @param {string} baseRoleId - The base role ID
   * @param {string} flair - 'lgbt' or 'ally'
   * @returns {string|null} - The final role ID or null if not found
   */
  export function getFinalRoleId(baseRoleId, flair) {
    const key = `${baseRoleId}:${flair}`;
    return ROLE_MAPPINGS.BASE_TO_FINAL[key] || null;
  }
  
  /**
   * Get the flair role ID based on flair type
   * @param {string} flair - 'lgbt' or 'ally'
   * @returns {string|null} - The flair role ID or null if not found
   */
  export function getFlairRoleId(flair) {
    return ROLE_MAPPINGS.FLAIR[flair] || null;
  }
  
  /**
   * Get the display name for a role ID
   * @param {string} roleId - The role ID
   * @returns {string} - The role name or 'Unknown Role' if not found
   */
  export function getRoleName(roleId) {
    return ROLE_NAMES[roleId] || 'Unknown Role';
  }
  
  /**
   * Find the base role ID from a member's roles
   * @param {GuildMember} member - The Discord guild member
   * @returns {string|null} - The base role ID or null if not found
   */
  export function findBaseRole(member) {
    for (const roleId of ROLE_MAPPINGS.BASE_ROLES) {
      if (member.roles.cache.has(roleId)) {
        return roleId;
      }
    }
    return null;
  }
  
  /**
   * Find the highest priority role for a member from a list of role IDs
   * @param {GuildMember} member - The Discord guild member
   * @param {string[]} roleIds - Array of role IDs to check
   * @returns {string|null} - The highest priority role ID or null if none found
   */
  export function findHighestRole(member, roleIds) {
    for (const roleId of roleIds) {
      if (member.roles.cache.has(roleId)) {
        return roleId;
      }
    }
    return null;
  }
  
  /**
   * Get the display role for a member (for welcome messages)
   * @param {GuildMember} member - The Discord guild member
   * @returns {string} - The role name to display
   */
  export function getDisplayRole(member) {
    // Check final roles first (in order of priority)
    const finalRoles = [
      ROLES.HIGH_PROPHET,
      ROLES.LORD_PROTECTOR,
      ROLES.THE_COURT,
      ROLES.RAINBOW_APOSTLE,
      ROLES.RAINBOW_ALLY_LT,
      ROLES.GLITTER_CRUSADER,
      ROLES.BANNER_BEARER,
      ROLES.MYCELIOGLITTER,
      ROLES.GLITTER_ALLY
    ];
    
    const highestRole = findHighestRole(member, finalRoles);
    if (highestRole) {
      return getRoleName(highestRole);
    }
    
    // If no final role, check base roles
    const baseRole = findBaseRole(member);
    if (baseRole) {
      return getRoleName(baseRole);
    }
    
    // Default
    return 'Member';
  }

export const ROLE_COMPATIBILITY = {
  ROLE_LGBTQ: ROLES.LGBTQIA2S,
  ROLE_ALLY: ROLES.ALLY,
  ROLE_BASE_MEMBER: ROLES.MEMBER,
  ROLE_BASE_OFFICER: ROLES.OFFICER,
  ROLE_BASE_VETERAN: ROLES.VETERAN,
  ROLE_FINAL_MYCE: ROLES.MYCELIOGLITTER,
  ROLE_FINAL_GALLIES: ROLES.GLITTER_ALLY,
  ROLE_FINAL_GCRUS: ROLES.GLITTER_CRUSADER,
  ROLE_FINAL_BBEAR: ROLES.BANNER_BEARER,
  ROLE_FINAL_RAPO: ROLES.RAINBOW_APOSTLE,
  ROLE_FINAL_RALLYLT: ROLES.RAINBOW_ALLY_LT,
  ROLE_STRAY_SPORE_ID: ROLES.STRAY_SPORE,
  ROLE_HOST_ID: ROLES.HOST,
};
  