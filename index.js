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
app.listen(port, () => console.log(`Health server listening on ${port}`));

// ------------------ ENV ------------------
const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;

const SPORE_BOX_CHANNEL_ID = process.env.SPORE_BOX_CHANNEL_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || '0';
const DEFAULT_USES = parseInt(process.env.DEFAULT_USES || '4', 10);
const MAX_USES = parseInt(process.env.MAX_USES || '10', 10);

// Temp VC settings
// Sporehall (landing VC) you created:
const LOBBY_VC_ID = process.env.LOBBY_VC_ID || '1409695442308169925';
// Battlefront category where rooms are created:
const TEMP_VC_CATEGORY_ID = process.env.TEMP_VC_CATEGORY_ID || '1409836975455862834';
const TEMP_VC_NAME_FMT = process.env.TEMP_VC_NAME_FMT || 'War Chamber — {user}';
const TEMP_VC_DELETE_AFTER = parseInt(process.env.TEMP_VC_DELETE_AFTER || '300', 10);
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

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ------------------ /strays handler ------------------
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'strays') {
    const requested = interaction.options.getInteger('count') ?? DEFAULT_USES;
    const uses = Math.min(Math.max(requested, 1), MAX_USES);

    try {
      const spore = await client.channels.fetch(SPORE_BOX_CHANNEL_ID);
      if (!spore || spore.type !== ChannelType.GuildText) {
        await interaction.reply({
          content:
            '❌ I can’t find **#spore-box**. Check `SPORE_BOX_CHANNEL_ID` in your `.env`.',
          ephemeral: true,
        });
        return;
      }

      const me = await interaction.guild.members.fetchMe();
      const perms = spore.permissionsFor(me);
      if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.CreateInstantInvite])) {
        await interaction.reply({
          content: '❌ I need **Create Invite** (and View) in **#spore-box**.',
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const invite = await spore.createInvite({
        maxAge: 86400, // 24h
        maxUses: uses,
        unique: true,
        reason: `Strays by ${interaction.user.tag} (${interaction.user.id})`,
      });

      // RP flourish
      try {
        await interaction.channel?.send(
          `🌿 ${interaction.user} loosens a spore-satchel; **${uses}** guest passes swirl into being.`
        );
      } catch {}

      // DM the invite
      let dmSent = true;
      try {
        await interaction.user.send(
          [
            `Here are your guest passes for **#spore-box** (valid 24h, **${uses}** uses):`,
            invite.url,
            '',
            '_Need a temp voice channel? Join **Sporehall** and I’ll conjure one for you._',
          ].join('\n')
        );
      } catch {
        dmSent = false;
      }

      if (dmSent) {
        await interaction.editReply('✉️ Your passes have been sent to your DMs.');
      } else {
        await interaction.editReply(
          `⚠️ I couldn’t DM you (privacy settings). Here’s your invite (only you can see this):\n${invite.url}`
        );
      }

      // Log
      if (LOG_CHANNEL_ID !== '0') {
        try {
          const log = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
          if (log?.isTextBased()) {
            const expiresTs = Math.floor(Date.now() / 1000) + 86400;
            await log.send(
              [
                `📜 **Strays Issued**`,
                `• By: ${interaction.user} (${interaction.user.tag})`,
                `• Uses: **${uses}**`,
                `• Link: ${invite.url}`,
                `• Expires: <t:${expiresTs}:R>`,
                `• Channel: <#${SPORE_BOX_CHANNEL_ID}>`,
              ].join('\n')
            );
          }
        } catch {}
      }
    } catch (err) {
      console.error('Invite error:', err);
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply('❌ Could not create invite (check bot perms).');
        } else {
          await interaction.reply({
            content: '❌ Could not create invite (check bot perms).',
            ephemeral: true,
          });
        }
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
      await interaction.reply({ content: '❌ Join **Sporehall** first, then use `/vc`.', ephemeral: true });
      return;
    }
    if (LOBBY_VC_ID && vs.channelId !== LOBBY_VC_ID) {
      await interaction.reply({ content: '⚠️ Please join **Sporehall** first, then use `/vc`.', ephemeral: true });
      return;
    }

    // find host's chamber
    const entry = [...tempOwners.entries()].find(([, owner]) => owner === hostId);
    if (!entry) {
      await interaction.reply({ content: '❌ I can’t find a War Chamber for that host right now.', ephemeral: true });
      return;
    }

    const [chamberId] = entry;
    const chamber = await interaction.guild.channels.fetch(chamberId).catch(() => null);
    if (!chamber || chamber.type !== ChannelType.GuildVoice) {
      await interaction.reply({ content: '❌ That War Chamber doesn’t seem to exist anymore.', ephemeral: true });
      return;
    }

    try {
      await member.voice.setChannel(chamber);
      await interaction.reply({ content: `✅ Moved you to **${chamber.name}**.`, ephemeral: true });
    } catch (e) {
      console.error('vc move failed:', e);
      await interaction.reply({
        content: '❌ I couldn’t move you. I need **Move Members** in both channels.',
        ephemeral: true,
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

// ------------------ TEMP VOICE ROOMS ------------------
const tempOwners = new Map();   // channelId -> ownerUserId
const deleteTimers = new Map(); // channelId -> timeout

function scheduleDeleteIfEmpty(channelId, guild) {
  const prev = deleteTimers.get(channelId);
  if (prev) clearTimeout(prev);

  const t = setTimeout(async () => {
    try {
      const ch =
        guild.channels.cache.get(channelId) ||
        (await guild.channels.fetch(channelId).catch(() => null));
      if (!ch || ch.type !== ChannelType.GuildVoice) return;

      if (ch.members.size === 0 && tempOwners.has(channelId)) {
        const ownerId = tempOwners.get(channelId);

        // Remove temp Host role on delete (if still present)
        if (TEMP_HOST_ROLE_ID && ownerId) {
          const ownerMember = await guild.members.fetch(ownerId).catch(() => null);
          if (ownerMember?.roles.cache.has(TEMP_HOST_ROLE_ID)) {
            await ownerMember.roles.remove(TEMP_HOST_ROLE_ID).catch(() => {});
          }
        }

        await ch.delete('Temp VC empty past grace period');
        tempOwners.delete(channelId);
        deleteTimers.delete(channelId);
      }
    } catch {}
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
    reason: `Temp VC for ${member.user.tag}`,
  });

  tempOwners.set(ch.id, member.id);

  // Grant temp Host role
  if (TEMP_HOST_ROLE_ID) {
    try { await member.roles.add(TEMP_HOST_ROLE_ID); } catch {}
  }

  // Move the member into their new chamber (best-effort)
  try { await member.voice.setChannel(ch); } catch {}

  // Start deletion guard
  scheduleDeleteIfEmpty(ch.id, guild);
}

client.on('voiceStateUpdate', async (oldState, newState) => {
  // Join-to-create trigger (Sporehall)
  if (!oldState.channelId && newState.channelId === LOBBY_VC_ID) {
    try {
      await createTempVCFor(newState.member);
    } catch (e) {
      console.error('Temp VC create failed:', e);
    }
  }

  // If a temp channel lost a member, check deletion + host role removal
  const oldChId = oldState.channelId;
  if (oldChId && oldChId !== newState.channelId && tempOwners.has(oldChId)) {
    const ownerId = tempOwners.get(oldChId);
    if (ownerId && oldState.member?.id === ownerId && TEMP_HOST_ROLE_ID) {
      try { await oldState.member.roles.remove(TEMP_HOST_ROLE_ID); } catch {}
    }
    scheduleDeleteIfEmpty(oldChId, oldState.guild);
  }
});

// ------------------ LOGIN ------------------
client.login(TOKEN);
