// src/services/invite-role-service.js
import { Events, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { CHANNELS } from '../channels.js';
import { ROLES, getRoleName, getDisplayRole, findBaseRole } from '../roles.js';
import { handleTempVCInviteJoin, isWarChamberInvite } from './temp-vc-service.js';
import { getDynamicInviteMap, loadInviteMappingsFromDB } from '../commands/generate-invite.js';
import { InviteDB } from '../database/invites.js';
import { supabase } from '../db.js';

// Grace period for invite cleanup (30 minutes)
const CLEANUP_GRACE_MS = 30 * 60 * 1000;


// Grace deletion queue (in-memory)
const pendingDeleteUntil = new Map(); // invite_code -> epochMillis

// Cache of guild invites for delta detection
const cache = new Map(); // guildId -> Map<code, uses>

// Refresh guild invite cache
async function refreshGuildInvites(guild) {
  try {
    const invites = await guild.invites.fetch();
    const map = new Map();
    
    if (invites) {
      for (const invite of invites.values()) {
        map.set(invite.code, invite.uses ?? 0);
      }
    }
    
    // Include vanity URL if exists
    if (guild.vanityURLCode) {
      try {
        const vanity = await guild.fetchVanityData();
        if (vanity?.code) {
          map.set(vanity.code, vanity.uses ?? 0);
        }
      } catch (vanityError) {
        console.warn('Failed to fetch vanity data:', vanityError);
      }
    }
    
    cache.set(guild.id, map);
    return map;
  } catch (error) {
    console.error('Failed to refresh guild invites:', error);
    return new Map();
  }
}

// Detect which invite was used by comparing before/after
function diffUsedInvite(oldMap, newMap) {
  // Check for increased usage
  for (const [code, uses] of newMap.entries()) {
    const before = oldMap.get(code) ?? 0;
    if ((uses ?? 0) > before) {
      return code;
    }
  }
  
  // Check for disappeared single-use invites
  for (const code of oldMap.keys()) {
    if (!newMap.has(code)) {
      return code;
    }
  }
  
  return null;
}

// Queue an invite for grace deletion
function queueGraceDelete(code, reason = 'missing') {
  if (!code) return;
  const until = Date.now() + CLEANUP_GRACE_MS;
  pendingDeleteUntil.set(code, until);
  console.log(`Grace delete queued for ${code} until ${new Date(until).toISOString()} (${reason})`);
}

// Process grace deletion queue
async function sweepGraceDeletesNow() {
  const now = Date.now();
  const toDelete = [];
  
  for (const [code, until] of pendingDeleteUntil.entries()) {
    if (until <= now) {
      toDelete.push(code);
      pendingDeleteUntil.delete(code);
    }
  }
  
  if (!toDelete.length) return;
  
  try {
    const { error } = await supabase
      .from('invite_mappings')
      .delete()
      .in('invite_code', toDelete);
      
    if (error) throw error;
    
    // Also remove from memory
    const dynamicMap = getDynamicInviteMap();
    toDelete.forEach(code => dynamicMap.delete(code));
    
    console.log(`🧹 Grace sweep removed ${toDelete.length} invite mappings`);
  } catch (error) {
    console.error('Grace sweep DB delete failed:', error);
    // Re-queue for later attempt
    const retryUntil = now + 10 * 60 * 1000; // 10 minutes
    for (const code of toDelete) {
      pendingDeleteUntil.set(code, retryUntil);
    }
  }
}


// Check if role is a base guild role
function isBaseRole(roleId) {
  return roleId === ROLES.MEMBER ||
         roleId === ROLES.OFFICER ||
         roleId === ROLES.VETERAN;
}

// Start the oath ceremony for a new member
async function startOathCeremony(member, roleId) {
  try {
    console.log(`Starting oath ceremony for ${member.user.tag} with role ${roleId}`);
    
    // Get the oath channel
    const oathChannel = member.guild.channels.cache.get(CHANNELS.CHAMBER_OF_OATHS);
    if (!oathChannel?.isTextBased()) {
      console.error('Oath channel not found or not text-based');
      return false;
    }
    
        // Mention the user in the oath channel
    await oathChannel.send({
      content: `Welcome <@${member.id}>! Please complete your oath ceremony by clicking the buttons on the pinned Imperial Decree message above.`
    });
    
    console.log(`Oath ceremony started for ${member.user.tag}`);
    return true;
  } catch (error) {
    console.error(`Error starting oath ceremony for ${member.user.tag}:`, error);
    return false;
  }
}

// Mark an invite as successfully assigned (remove from grace queue but keep the mapping)
async function markAssigned(code) {
  if (pendingDeleteUntil.has(code)) {
    try {
      // Instead of deleting the mapping, we just remove it from the pending delete queue
      pendingDeleteUntil.delete(code);
      console.log(`Removed ${code} from grace deletion queue after successful assignment`);
    } catch (error) {
      console.error(`Failed to mark ${code} as assigned:`, error);
    }
  }
}

// Main role assignment logic
async function assignRoleForCode(member, code) {
  console.log(`Attempting to assign role for code: ${code || 'unknown'}`);

  // 1. Handle temp VC / War Chamber invites
  if (code && code !== '__default__') {
    try {
      const isWar = await isWarChamberInvite(code);
      if (isWar) {
        console.log(`Processing War Chamber invite: ${code}`);
        const success = await handleTempVCInviteJoin(member, code);
        if (success) {
          return { assigned: true, type: 'temp_vc', roleId: ROLES.STRAY_SPORE };
        }
        return { assigned: false, type: 'temp_vc', error: 'War Chamber join failed' };
      }
    } catch (error) {
      console.error('Error checking War Chamber invite:', error);
    }
  }

  // 2. Handle database mappings (primary path)
  if (code && code !== '__default__') {
    try {
      console.log(`Checking database for invite mapping: ${code}`);
      const result = await InviteDB.getInviteMapping(code);
      
      if (result.ok && result.data) {
        const mapping = result.data;
        
        // Validate invite is still usable
        const validation = await InviteDB.validateInvite(code);
        if (!validation.valid) {
          console.log(`Invite ${code} validation failed: ${validation.reason}`);
          return { assigned: false, type: 'mapping', error: validation.reason };
        }

        const roleId = mapping.role_id;
        if (!roleId) {
          console.error('No role_id found in invite mapping');
          return { assigned: false, type: 'mapping', error: 'No role specified for this invite' };
        }

        const role = member.guild.roles.cache.get(roleId);
        if (!role) {
          console.error(`Role ${roleId} not found in guild`);
          return { assigned: false, type: 'mapping', error: 'Role not found' };
        }

        try {
          await member.roles.add(role);
          console.log(`Assigned role ${role.name} to ${member.user.tag}`);

          // Increment usage tracking
          try {
            const inc = await InviteDB.incrementInviteUsage(code);
            if (!inc.ok) {
              console.error('Failed to increment invite usage:', inc.error);
            }
          } catch (incErr) {
            console.error('Increment invite usage error:', incErr);
          }

          // Remove from grace deletion queue if present
          if (pendingDeleteUntil.has(code)) {
            await markAssigned(code);
          }

          // Start oath ceremony for base roles
          if (isBaseRole(roleId)) {
            await startOathCeremony(member, roleId);
            return { assigned: true, type: 'member_oath', roleId };
          }
          
          return { assigned: true, type: 'db_mapping', roleId };
        } catch (error) {
          console.error('Failed to assign role from database mapping:', error);
          return { assigned: false, type: 'mapping', error: error.message };
        }
      } else {
        console.log(`No database mapping found for code: ${code}`);
      }
    } catch (error) {
      console.error('Error checking database for invite mapping:', error);
    }
  }

  // 3. Handle in-memory dynamic mappings
  const dynamicMap = getDynamicInviteMap();
  if (code && code !== '__default__' && dynamicMap.has(code)) {
    const roleId = dynamicMap.get(code);
    const role = member.guild.roles.cache.get(roleId);
    
    if (!role) {
      console.error(`Role ${roleId} not found in guild (dynamic mapping)`);
      return { assigned: false, type: 'mapping', error: 'Role not found' };
    }
    
    try {
      await member.roles.add(role);
      console.log(`Assigned role ${role.name} to ${member.user.tag} via dynamic mapping`);
      
      if (isBaseRole(roleId)) {
        await startOathCeremony(member, roleId);
        return { assigned: true, type: 'member_oath', roleId };
      }
      
      return { assigned: true, type: 'dynamic_mapping', roleId };
    } catch (error) {
      console.error('Failed to assign role from dynamic mapping:', error);
      return { assigned: false, type: 'mapping', error: error.message };
    }
  }

  // 4. Fallback to default role
  const defaultRoleId = ROLES.MEMBER; // Default to member role
  if (!defaultRoleId) {
    console.log('No default role configured');
    return { assigned: false, type: 'none' };
  }

  const defaultRole = member.guild.roles.cache.get(defaultRoleId);
  if (!defaultRole) {
    console.error(`Default role ${defaultRoleId} not found in guild`);
    return { assigned: false, type: 'mapping', error: 'Default role not found' };
  }

  try {
    await member.roles.add(defaultRole);
    console.log(`Assigned default role ${defaultRole.name} to ${member.user.tag}`);
    
    if (isBaseRole(defaultRoleId)) {
      await startOathCeremony(member, defaultRoleId);
      return { assigned: true, type: 'member_oath', roleId: defaultRoleId };
    }
    
    return { assigned: true, type: 'default_role', roleId: defaultRoleId };
  } catch (error) {
    console.error('Failed to assign default role:', error);
    return { assigned: false, type: 'mapping', error: error.message };
  }
}

// Initialize the invite role service
let _inviteRoleServiceInit = false;
export function initInviteRoleService(client) {
  if (_inviteRoleServiceInit) {
    console.warn('initInviteRoleService called more than once; ignoring.');
    return;
  }
  _inviteRoleServiceInit = true;

  client.on(Events.ClientReady, async () => {
    try {
      console.log('Starting invite role service initialization...');

      // Load mappings from database
      await loadInviteMappingsFromDB();
      
      // Clean expired invites
      const cleanupResult = await InviteDB.cleanupExpiredInvites();
      if (cleanupResult.ok && cleanupResult.data.cleanedCount > 0) {
        console.log(`Cleaned ${cleanupResult.data.cleanedCount} expired invites`);
      }

      // Refresh invite caches for all guilds
      for (const guild of client.guilds.cache.values()) {
        await refreshGuildInvites(guild);
      }
      
      console.log('Invite role service initialized');

    } catch (error) {
      console.error('Failed to initialize invite role service:', error);
    }
  });

  // Handle invite creation
  client.on(Events.InviteCreate, (invite) => {
    const guild = invite.guild;
    if (!guild) return;
    
    const map = cache.get(guild.id) ?? new Map();
    map.set(invite.code, invite.uses ?? 0);
    cache.set(guild.id, map);
    console.log(`Invite created: ${invite.code} with ${invite.uses ?? 0} uses`);
  });

  // Handle invite deletion
  client.on(Events.InviteDelete, async (invite) => {
    const code = invite?.code;
    const guild = invite.guild;

    if (guild) {
      const map = cache.get(guild.id) ?? new Map();
      if (code) map.delete(code);
      cache.set(guild.id, map);
    }

    if (!code) return;

    const res = await InviteDB.getInviteMapping(code);
    if (!res.ok || !res.data) return;

    const row = res.data;
    const now = Math.floor(Date.now() / 1000);
    const exhausted = row.max_uses > 0 && row.current_uses >= row.max_uses;
    const expired = !!row.expires_at && now >= row.expires_at;

    if (exhausted || expired) {
      console.log(`[InvDelete] ${code} removed by Discord (exhausted/expired). Leaving final removal to Janitor.`);
    } else {
      console.warn(`[InvDelete] ${code} deleted early by Discord; keeping mapping for nightly reconciliation`);
    }
  });

  // Handle member join
  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      console.log(`New member joined: ${member.user.tag}`);
      const guild = member.guild;
      const me = guild.members.me;
      const canManageGuild = me?.permissions?.has(PermissionFlagsBits.ManageGuild);

      let code = null;
      
      if (canManageGuild) {
        const before = cache.get(guild.id) ?? await refreshGuildInvites(guild);
        const after = await refreshGuildInvites(guild);
        code = diffUsedInvite(before, after);
      }
      
      console.log(`Detected invite code: ${code || 'unknown'}`);

      const result = await assignRoleForCode(member, code || '__default__');

      // Log to hall of records
      const logChannel = guild.channels.cache.get(CHANNELS.HALL_OF_RECORDS);
      if (logChannel?.isTextBased()) {
        let logMessage;
        
        if (result.type === 'temp_vc') {
          logMessage = `War Chamber ${member} joined via invite \`${code}\` -> auto-assigned Stray Spore <@&${result.roleId}>`;
        } else if (result.type === 'member_oath') {
          logMessage = `New Member ${member} joined via \`${code}\` -> assigned <@&${result.roleId}> and started oath ceremony`;
        } else if (code) {
          logMessage = `${member} joined via \`${code}\`${result.assigned ? ` -> role <@&${result.roleId}>` : ' (no role assigned)'}`;
        } else {
          logMessage = `${member} joined (invite unknown)${result.assigned ? ` -> default <@&${result.roleId}>` : ' (no role assigned)'}`;
        }
        
        if (result.error) {
          logMessage += ` [Error: ${result.error}]`;
        }
        
        await logChannel.send(logMessage).catch(console.error);
      }

      // Remove from grace queue if successful DB mapping, but keep the mapping in the database
      if (code && result.assigned && (result.type === 'db_mapping' || result.type === 'member_oath')) {
        if (pendingDeleteUntil.has(code)) {
          pendingDeleteUntil.delete(code);
          console.log(`Removed ${code} from grace deletion queue after successful assignment`);
        }
      }
    } catch (error) {
      console.error('Error in invite-role service member join handler:', error);
    }
  });

  // Periodic cleanup
  setInterval(async () => {
    try {
      const result = await InviteDB.cleanupExpiredInvites();
      if (result.ok && result.data.cleanedCount > 0) {
        console.log(`Periodic cleanup: removed ${result.data.cleanedCount} DB-expired invites`);
      }
      await sweepGraceDeletesNow();
    } catch (error) {
      console.error('Failed periodic invite cleanup:', error);
    }
  }, 60 * 60 * 1000); // hourly
}