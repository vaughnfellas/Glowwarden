// ============= src/services/temp-vc-service.js =============
import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { config } from '../config.js';

// State tracking
export const tempOwners = new Map();
export const deleteTimers = new Map();

let client;

export function initTempVCService(discordClient) {
  client = discordClient;
}

export function scheduleDeleteIfEmpty(channelId, guild) {
  const prev = deleteTimers.get(channelId);
  if (prev) clearTimeout(prev);

  const t = setTimeout(async () => {
    try {
      const ch = guild.channels.cache.get(channelId) || 
        (await guild.channels.fetch(channelId).catch(() => null));
      if (!ch || ch.type !== ChannelType.GuildVoice) return;

      if (ch.members.size === 0 && tempOwners.has(channelId)) {
        const ownerId = tempOwners.get(channelId);

        // Remove temp Host role on delete
        if (config.TEMP_HOST_ROLE_ID && ownerId) {
          try {
            const ownerMember = await guild.members.fetch(ownerId).catch(() => null);
            if (ownerMember?.roles.cache.has(config.TEMP_HOST_ROLE_ID)) {
              await ownerMember.roles.remove(config.TEMP_HOST_ROLE_ID);
            }
          } catch (e) {
            console.error('Remove Host role failed:', e);
          }
        }

        await ch.delete('Temp VC empty past grace period');
        tempOwners.delete(channelId);
        deleteTimers.delete(channelId);
        console.log('🧹 Deleted empty temp VC:', channelId);
      }
    } catch (e) {
      console.error('Temp VC delete failed:', channelId, e);
    }
  }, config.TEMP_VC_DELETE_AFTER * 1000);

  deleteTimers.set(channelId, t);
}

export async function sweepTempRooms() {
  try {
    if (!config.GUILD_ID || !config.TEMP_VC_CATEGORY_ID || !client) return;

    const guild = await client.guilds.fetch(config.GUILD_ID);
    const category = await guild.channels.fetch(config.TEMP_VC_CATEGORY_ID).catch(() => null);

    if (!category) return;

    const children = category.children?.cache ?? 
      guild.channels.cache.filter(c => c.parentId === config.TEMP_VC_CATEGORY_ID);

    for (const ch of children.values()) {
      if (ch.type !== ChannelType.GuildVoice) continue;
      if (ch.members.size > 0) continue;

      // Clean up tracking data
      if (tempOwners.has(ch.id)) {
        const ownerId = tempOwners.get(ch.id);
        if (ownerId && config.TEMP_HOST_ROLE_ID) {
          try {
            const owner = await guild.members.fetch(ownerId).catch(() => null);
            if (owner?.roles.cache.has(config.TEMP_HOST_ROLE_ID)) {
              await owner.roles.remove(config.TEMP_HOST_ROLE_ID);
            }
          } catch {}
        }

        tempOwners.delete(ch.id);
        const t = deleteTimers.get(ch.id);
        if (t) clearTimeout(t);
        deleteTimers.delete(ch.id);
      }

      try {
        await ch.delete('Periodic sweep: empty temp VC in Battlefront');
        console.log('🧹 Sweep deleted:', ch.id, ch.name);
      } catch (e) {
        console.error('Sweep delete failed:', ch.id, e);
      }
    }
  } catch (e) {
    console.error('Sweep error:', e);
  }
}

export async function createTempVCFor(member) {
  const guild = member.guild;
  
  const name = (config.TEMP_VC_NAME_FMT || 'War Chamber — {user}')
    .replace('{user}', member.displayName);

  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.CreateInstantInvite],
    },
    {
      id: member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
        PermissionFlagsBits.Stream,
        PermissionFlagsBits.UseVAD,
        PermissionFlagsBits.MuteMembers,
        PermissionFlagsBits.DeafenMembers,
        PermissionFlagsBits.MoveMembers,
        PermissionFlagsBits.ManageChannels,
      ],
      deny: [PermissionFlagsBits.CreateInstantInvite],
    },
    {
      id: guild.members.me.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.MoveMembers,
        PermissionFlagsBits.ManageChannels,
      ],
      deny: [PermissionFlagsBits.CreateInstantInvite],
    },
  ];

  const ch = await guild.channels.create({
    name,
    type: ChannelType.GuildVoice,
    parent: config.TEMP_VC_CATEGORY_ID,
    userLimit: config.TEMP_VC_USER_LIMIT ?? undefined,
    permissionOverwrites: overwrites,
    reason: `Temp VC for ${member.user.tag}`,
  });

  tempOwners.set(ch.id, member.id);

  // Grant temp Host role
  if (config.TEMP_HOST_ROLE_ID) {
    try {
      await member.roles.add(config.TEMP_HOST_ROLE_ID);
    } catch (e) {
      console.error('Add Host role failed:', e);
    }
  }

  // Move member to new chamber
  try {
    await member.voice.setChannel(ch);
  } catch {}

  scheduleDeleteIfEmpty(ch.id, guild);

  console.log('🛠️ Created temp VC for', member.user.tag, '->', ch.name, `(${ch.id})`);
}

