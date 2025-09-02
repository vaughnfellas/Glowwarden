// ============= src/services/invite-role-service.js =============
import { Events, PermissionFlagsBits } from 'discord.js';
import { config } from '../config.js';
import { CHANNELS } from '../channels.js';
import { handleTempVCInviteJoin } from './temp-vc-service.js';

const cache = new Map(); // guildId -> Map<code, uses>

async function refreshGuildInvites(guild) {
  const invites = await guild.invites.fetch().catch(() => null);
  const map = new Map();
  if (invites) {
    for (const i of invites.values()) map.set(i.code, i.uses ?? 0);
  }
  // vanity URL optional; remove this block if you don't use a vanity
  if (guild.vanityURLCode) {
    const vanity = await guild.fetchVanityData().catch(() => null);
    if (vanity?.code) map.set(vanity.code, vanity.uses ?? 0);
  }
  cache.set(guild.id, map);
  return map;
}

function diffUsedInvite(oldMap, newMap) {
  for (const [code, uses] of newMap.entries()) {
    const before = oldMap.get(code) ?? 0;
    if ((uses ?? 0) > before) return code;           // uses increased
  }
  for (const code of oldMap.keys()) {
    if (!newMap.has(code)) return code;              // single-use disappeared
  }
  return null;
}

async function assignRoleForCode(member, code) {
  // First, try the temp VC invite system
  if (code && await handleTempVCInviteJoin(member, code)) {
    return { assigned: true, type: 'temp_vc', roleId: config.STRAY_SPORE_ROLE_ID };
  }
  
  // Fallback to traditional role mapping (for any remaining invite types)
  const roleId = config.INVITE_ROLE_MAP?.[code] || config.INVITE_DEFAULT_ROLE_ID;
  if (!roleId) return { assigned: false, type: 'none' };
  
  const role = member.guild.roles.cache.get(roleId);
  if (!role) return { assigned: false, type: 'mapping' };
  
  await member.roles.add(role).catch(() => {});
  return { assigned: true, type: 'mapping', roleId };
}

export function initInviteRoleService(client) {
  client.on(Events.ClientReady, async () => {
    for (const guild of client.guilds.cache.values()) await refreshGuildInvites(guild);
  });

  client.on(Events.InviteCreate, (invite) => {
    const g = invite.guild; if (!g) return;
    const m = cache.get(g.id) ?? new Map();
    m.set(invite.code, invite.uses ?? 0);
    cache.set(g.id, m);
  });

  client.on(Events.InviteDelete, (invite) => {
    const g = invite.guild; if (!g) return;
    const m = cache.get(g.id) ?? new Map();
    m.delete(invite.code);
    cache.set(g.id, m);
  });

  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      const g = member.guild;
      const me = g.members.me;
      const canManageGuild = me?.permissions?.has(PermissionFlagsBits.ManageGuild);

      const before = cache.get(g.id) ?? (canManageGuild ? await refreshGuildInvites(g) : new Map());
      const after = canManageGuild ? await refreshGuildInvites(g) : before;
      const code = canManageGuild ? diffUsedInvite(before, after) : null;

      const res = await assignRoleForCode(member, code || '__default__');

      // Enhanced logging based on invite type
      const ch = g.channels.cache.get(CHANNELS.HALL_OF_RECORDS);
      if (ch?.isTextBased()) {
        let logMessage;
        
        if (res.type === 'temp_vc') {
          logMessage = `🏰 ${member} joined via War Chamber invite \`${code}\` → auto-assigned Stray Spore <@&${res.roleId}>`;
        } else if (code) {
          logMessage = `🧭 ${member} joined via \`${code}\`${res.assigned ? ` → role <@&${res.roleId}>` : ''}`;
        } else {
          logMessage = `🧭 ${member} joined (invite unknown)${res.assigned ? ` → default <@&${res.roleId}>` : ''}`;
        }
        
        ch.send(logMessage).catch(() => {});
      }
    } catch (e) {
      console.warn('invite-role service error:', e?.message);
    }
  });
}