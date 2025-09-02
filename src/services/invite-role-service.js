// ============= src/services/invite-role-service.js =============
import { Events, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
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
  // vanity URL optional
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

async function startOathCeremony(member, roleId) {
  try {
    const guild = member.guild;
    const oathChannel = guild.channels.cache.get(CHANNELS.CHAMBER_OF_OATHS);
    
    if (!oathChannel?.isTextBased()) {
      console.error('Chamber of Oaths channel not found or not text-based');
      return;
    }

    const role = guild.roles.cache.get(roleId);
    const roleName = role ? role.name : 'Member';

    const embed = new EmbedBuilder()
      .setTitle('New Member Oath Ceremony')
      .setDescription([
        `Welcome **${member.displayName}** to the guild!`,
        '',
        `**Assigned Role:** ${roleName}`,
        `**Joined:** <t:${Math.floor(Date.now() / 1000)}:F>`,
        '',
        '**Oath Requirement:**',
        'Please take your oath by responding to this message with your commitment to the guild.',
        '',
        'Once you take your oath, you will gain full access to the guild.'
      ].join('\n'))
      .setColor(0x8B4513)
      .setTimestamp()
      .setThumbnail(member.user.displayAvatarURL());

    await oathChannel.send({ content: `${member}`, embeds: [embed] });
    console.log(`Started oath ceremony for ${member.user.tag} with role ${roleName}`);
    
  } catch (error) {
    console.error('Failed to start oath ceremony:', error);
  }
}

async function assignRoleForCode(member, code) {
  // First, try the temp VC invite system (Stray Spores)
  if (code && await handleTempVCInviteJoin(member, code)) {
    return { assigned: true, type: 'temp_vc', roleId: config.STRAY_SPORE_ROLE_ID };
  }
  
  // Handle regular member/officer/vet invites
  const roleId = config.INVITE_ROLE_MAP?.[code] || config.INVITE_DEFAULT_ROLE_ID;
  if (!roleId) return { assigned: false, type: 'none' };
  
  const role = member.guild.roles.cache.get(roleId);
  if (!role) return { assigned: false, type: 'mapping' };
  
  try {
    await member.roles.add(role);
    
    // If this is a "member" invite (base member role), start oath ceremony
    if (roleId === config.ROLE_BASE_MEMBER) {
      await startOathCeremony(member, roleId);
      return { assigned: true, type: 'member_oath', roleId };
    }
    
    return { assigned: true, type: 'mapping', roleId };
  } catch (error) {
    console.error('Failed to assign role:', error);
    return { assigned: false, type: 'mapping' };
  }
}

export function initInviteRoleService(client) {
  client.on(Events.ClientReady, async () => {
    for (const guild of client.guilds.cache.values()) await refreshGuildInvites(guild);
    console.log('Invite role service initialized');
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
          logMessage = `War Chamber ${member} joined via invite \`${code}\` -> auto-assigned Stray Spore <@&${res.roleId}>`;
        } else if (res.type === 'member_oath') {
          logMessage = `New Member ${member} joined via \`${code}\` -> assigned <@&${res.roleId}> and started oath ceremony`;
        } else if (code) {
          logMessage = `${member} joined via \`${code}\`${res.assigned ? ` -> role <@&${res.roleId}>` : ''}`;
        } else {
          logMessage = `${member} joined (invite unknown)${res.assigned ? ` -> default <@&${res.roleId}>` : ''}`;
        }
        
        ch.send(logMessage).catch(() => {});
      }
    } catch (e) {
      console.warn('invite-role service error:', e?.message);
    }
  });
}