import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';

// --- minimal HTTP health server for Render free Web Service ---
import express from 'express';
const app = express();
app.get('/', (_req, res) => res.send('Spore Inviter up'));
app.get('/healthz', (_req, res) => res.send('ok'));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(Health server listening on ${port}));

// ------------------ ENV ------------------
const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;

const SPORE_BOX_CHANNEL_ID = process.env.SPORE_BOX_CHANNEL_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || '0';
const DEFAULT_USES = parseInt(process.env.DEFAULT_USES || '4', 10);
const MAX_USES = parseInt(process.env.MAX_USES || '10', 10);

// Temp VC settings
// ➕⚔️-rent-a-war-chamber (join-to-create)
const LOBBY_VC_ID = process.env.LOBBY_VC_ID || '1409839975180009525';
// Battlefront category where rooms are created:
const TEMP_VC_CATEGORY_ID = process.env.TEMP_VC_CATEGORY_ID || '1409836975455862834';
const TEMP_VC_NAME_FMT = process.env.TEMP_VC_NAME_FMT || 'War Chamber — {user}';
const TEMP_VC_DELETE_AFTER = Number(process.env.TEMP_VC_DELETE_AFTER || 300); // seconds
const TEMP_VC_USER_LIMIT = process.env.TEMP_VC_USER_LIMIT
  ? parseInt(process.env.TEMP_VC_USER_LIMIT, 10)
  : null;

// Temp Host role (grant on create, remove when owner leaves / room deletes)
const TEMP_HOST_ROLE_ID = process.env.TEMP_HOST_ROLE_ID || '1410629664522764318';

// ------------------ CLIENT ------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates, // needed for temp VCs
  ],
});

// ------------------ TEMP VOICE STATE ------------------
const tempOwners = new Map();   // channelId -> ownerUserId
const deleteTimers = new Map(); // channelId -> timeout id

function scheduleDeleteIfEmpty(channelId, guild) {
  const prev = deleteTimers.get(channelId);
  if (prev) clearTimeout(prev);

  const t = setTimeout(async () => {
    try {
      const ch =
        guild.channels.cache.get(channelId) ||
        (await guild.channels.fetch(channelId).catch(() => null));
      if (!ch || ch.type !== ChannelType.GuildVoice) return;

      // Only delete channels we’re tracking as temp
      if (ch.members.size === 0 && tempOwners.has(channelId)) {
        const ownerId = tempOwners.get(channelId);

        // Remove temp Host role on delete (if still present)
        if (TEMP_HOST_ROLE_ID && ownerId) {
          try {
            const ownerMember = await guild.members.fetch(ownerId).catch(() => null);
            if (ownerMember?.roles.cache.has(TEMP_HOST_ROLE_ID)) {
              await ownerMember.roles.remove(TEMP_HOST_ROLE_ID);
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
  }, TEMP_VC_DELETE_AFTER * 1000);

  deleteTimers.set(channelId, t);
}

async function createTempVCFor(member) {
  const guild = member.guild;

  const name = (TEMP_VC_NAME_FMT || 'War Chamber — {user}')
    .replace('{user}', member.displayName);

  // Private by default + NO INVITES anywhere in this room
  const overwrites = [
    // @everyone: can't connect, can't create invites
    {
      id: guild.roles.everyone.id,
      deny: [
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.CreateInstantInvite,
      ],
    },
    // Owner: full control to run the room, but still NO invites
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
    // Bot: ensure it can manage/move here
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
    parent: TEMP_VC_CATEGORY_ID,
    userLimit: TEMP_VC_USER_LIMIT ?? undefined,
    permissionOverwrites: overwrites,
    reason: Temp VC for ${member.user.tag},
  });

  tempOwners.set(ch.id, member.id);

  // Grant temp Host role
  if (TEMP_HOST_ROLE_ID) {
    try { await member.roles.add(TEMP_HOST_ROLE_ID); } catch (e) {
      console.error('Add Host role failed:', e);
    }
  }

  // Move the member into their new chamber (best-effort)
  try { await member.voice.setChannel(ch); } catch {}

  // Start deletion guard immediately
  scheduleDeleteIfEmpty(ch.id, guild);

  console.log('🛠️ Created temp VC for', member.user.tag, '->', ch.name, (${ch.id}));
}

// ------------------ READY ------------------
client.once('clientReady', async () => {
  console.log(✅ Logged in as ${client.user.tag});

  // Startup sweep: delete any empty orphan War Chambers after restarts
  try {
    if (!GUILD_ID || !TEMP_VC_CATEGORY_ID) return;

    const guild = await client.guilds.fetch(GUILD_ID);
    const category = await guild.channels.fetch(TEMP_VC_CATEGORY_ID).catch(() => null);

    if (!category) return;

    // Get children under the category (compat for some caches)
    const children =
      category.children?.cache ??
      guild.channels.cache.filter(c => c.parentId === TEMP_VC_CATEGORY_ID);

    const prefix = (TEMP_VC_NAME_FMT || 'War Chamber').split(' — ')[0];

    for (const ch of children.values()) {
      if (ch.type !== ChannelType.GuildVoice) continue;

      const looksLikeTemp = ch.name.startsWith(prefix);
      if (looksLikeTemp && ch.members.size === 0) {
        try {
          await ch.delete('Startup sweep: orphan temp VC');
          console.log('🧹 Swept orphan VC:', ch.id);
        } catch (e) {
          console.error('Startup sweep delete failed:', ch.id, e);
        }
      }
    }
  } catch (e) {
    console.error('Startup sweep error:', e);
  }
});

// ------------------ SLASH COMMANDS ------------------
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'strays') {
    console.log('↪ /strays received from', interaction.user.tag);

    // Acknowledge immediately (flags: 64 = ephemeral)
    try { await interaction.deferReply({ flags: 64 }); } catch {}

    const requested = interaction.options.getInteger('count') ?? DEFAULT_USES;
    const uses = Math.min(Math.max(requested, 1), MAX_USES);

    try {
      const spore = await client.channels.fetch(SPORE_BOX_CHANNEL_ID);
      if (!spore || spore.type !== ChannelType.GuildText) {
        await interaction.editReply('❌ I can’t find *#spore-box*. Check SPORE_BOX_CHANNEL_ID in your .env.');
        return;
      }

      const me = await interaction.guild.members.fetchMe();
      const perms = spore.permissionsFor(me);
      if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.CreateInstantInvite])) {
        await interaction.editReply('❌ I need *Create Invite* (and View) in *#spore-box*.');
        return;
      }

      const invite = await spore.createInvite({
        maxAge: 86400, // 24h
        maxUses: uses,
        unique: true,
        reason: Strays by ${interaction.user.tag} (${interaction.user.id}),
      });

      // RP flourish to the channel they ran the command in (best-effort)
      try {
        await interaction.channel?.send(
         🌿 ${interaction.user} loosens a spore-satchel; **${uses}** guest passes swirl into being.`
        );
      } catch {}

      // DM the invite (best-effort)
      let dmSent = true;
      try {
        await interaction.user.send(
          [
            Here are your guest passes for **#spore-box** (valid 24h, **${uses}** uses):,
            invite.url,
            '',
            '_Need a temp voice channel? Join *Sporehall* and I’ll conjure one for you._',
          ].join('\n')
        );
      } catch {
        dmSent = false;
      }

      if (dmSent) {
        await interaction.editReply('✉️ Your passes have been sent to your DMs.');
      } else {
        await interaction.editReply(
          ⚠️ I couldn’t DM you (privacy settings). Here’s your invite (only you can see this):\n${invite.url}
        );
      }

      // Log (optional)
      if (LOG_CHANNEL_ID !== '0') {
        try {
          const log = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
          if (log?.isTextBased()) {
            const expiresTs = Math.floor(Date.now() / 1000) + 86400;
            await log.send(
              [
               📜 **Strays Issued**`,
                • By: ${interaction.user} (${interaction.user.tag}),
                • Uses: **${uses}**,
                • Link: ${invite.url},
                • Expires: <t:${expiresTs}:R>,
                • Channel: <#${SPORE_BOX_CHANNEL_ID}>,
              ].join('\n')
            );
          }
        } catch {}
      }
    } catch (err) {
      console.error('Invite error:', err);
      try {
        await interaction.editReply('❌ Could not create invite (check bot perms).');
      } catch {}
    }

    return;
  }

  // /vc — move yourself to your host's chamber (host option has autocomplete)
  if (interaction.commandName === 'vc') {
    const hostId = interaction.options.getString('host', true);
    const member = interaction.member;

    const vs = member.voice;
    if (!vs?.channelId) {
      await interaction.reply({ content: '❌ Join *Sporehall* first, then use /vc.', flags: 64 });
      return;
    }
    if (LOBBY_VC_ID && vs.channelId !== LOBBY_VC_ID) {
      await interaction.reply({ content: '⚠️ Please join *Sporehall* first, then use /vc.', flags: 64 });
      return;
    }

    // find host's chamber
    const entry = [...tempOwners.entries()].find(([, owner]) => owner === hostId);
    if (!entry) {
      await interaction.reply({ content: '❌ I can’t find a War Chamber for that host right now.', flags: 64 });
      return;
    }

    const [chamberId] = entry;
    const chamber = await interaction.guild.channels.fetch(chamberId).catch(() => null);
    if (!chamber || chamber.type !== ChannelType.GuildVoice) {
      await interaction.reply({ content: '❌ That War Chamber doesn’t seem to exist anymore.', flags: 64 });
      return;
    }

    try {
      await member.voice.setChannel(chamber);
      await interaction.reply({ content: ✅ Moved you to **${chamber.name}**., flags: 64 });
    } catch (e) {
      console.error('vc move failed:', e);
      await interaction.reply({
        content: '❌ I couldn’t move you. I need *Move Members* in both channels.',
        flags: 64,
      });
    }
  }
});

// ------------------ AUTOCOMPLETE: /vc host ------------------
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isAutocomplete()) return;
  if (interaction.commandName !== 'vc') return;

  const focused = (interaction.options.getFocused() || '').toLowerCase();
  const entries = [...tempOwners.entries()].slice(0, 25);

  const choices = [];
  for (const [, ownerId] of entries) {
    try {
      const user = await client.users.fetch(ownerId);
      const label = user?.username || ownerId;
      if (!focused || label.toLowerCase().includes(focused)) {
        choices.push({ name: label, value: ownerId });
      }
    } catch {
      if (!focused || ownerId.includes(focused)) {
        choices.push({ name: ownerId, value: ownerId });
      }
    }
  }

  await interaction.respond(choices);
});

// ------------------ VOICE EVENTS ------------------
client.on('voiceStateUpdate', async (oldState, newState) => {
  // Join-to-create trigger (➕⚔️-rent-a-war-chamber)
  if (!oldState.channelId && newState.channelId === LOBBY_VC_ID) {
    try {
      await createTempVCFor(newState.member);
    } catch (e) {
      console.error('Temp VC create failed:', e);
    }
  }

  // Anyone left a temp channel? (arm/refresh delete timer)
  if (oldState.channelId && tempOwners.has(oldState.channelId)) {
    // If the owner left, strip Host immediately
    const ownerId = tempOwners.get(oldState.channelId);
    if (ownerId && oldState.member?.id === ownerId && TEMP_HOST_ROLE_ID) {
      try { await oldState.member.roles.remove(TEMP_HOST_ROLE_ID); } catch {}
    }
    scheduleDeleteIfEmpty(oldState.channelId, oldState.guild);
  }

  // Someone joined a temp channel? (clear countdown while occupied)
  if (newState.channelId && tempOwners.has(newState.channelId)) {
    scheduleDeleteIfEmpty(newState.channelId, newState.guild);
  }
});

// ------------------ LOGIN ------------------
client.login(TOKEN);    