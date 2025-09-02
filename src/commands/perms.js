// src/commands/perms.js
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  PermissionsBitField,
} from 'discord.js';
import { CHANNELS } from '../channels.js';
import { config } from '../config.js';

/**
 * DEFAULT_PERMISSIONS
 * — Preserves your overwrites exactly (from the original doc),
 *   with special IDs '@everyone' and 'BOT' handled at runtime.
 */
const DEFAULT_PERMISSIONS = {
  channels: {
    [CHANNELS.CHAMBER_OF_OATHS]: {
      name: 'chamber-of-oaths',
      description: 'Members complete final oath here',
      overwrites: [
        { id: '@everyone', deny: ['ViewChannel'] },
        { id: config.ROLE_BASE_MEMBER,  allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'UseApplicationCommands'] },
        { id: config.ROLE_BASE_OFFICER, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'UseApplicationCommands'] },
        { id: config.ROLE_BASE_VETERAN, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'UseApplicationCommands'] },
        { id: config.ROLE_FINAL_MYCE,   allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'UseApplicationCommands'] },
        { id: config.ROLE_FINAL_GALLIES,allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'UseApplicationCommands'] },
        { id: config.ROLE_FINAL_GCRUS,  allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'UseApplicationCommands'] },
        { id: config.ROLE_FINAL_BBEAR,  allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'UseApplicationCommands'] },
        { id: config.ROLE_FINAL_RAPO,   allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'UseApplicationCommands'] },
        { id: config.ROLE_FINAL_RALLYLT,allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'UseApplicationCommands'] },
        { id: 'BOT', allow: ['ViewChannel', 'SendMessages', 'ManageMessages'] },
      ],
    },
  },

  // Guild-wide suggestion: set this manually on @everyone in Server Settings
  roles: {
    '@everyone': {
      allow: ['UseApplicationCommands'],
      deny: [],
    },
  },

  categories: {
    [CHANNELS.BATTLEFRONT]: {
      name: 'battlefront',
      overwrites: [
        { id: '@everyone', deny: ['ViewChannel', 'Connect', 'CreateInstantInvite'] },
        { id: 'BOT', allow: ['ViewChannel', 'Connect', 'ManageChannels', 'MoveMembers', 'CreateInstantInvite'] },
        // Host & Stray Spores get perms per-VC only; don't open at category level.
      ],
    },
  },
};

/* ---------- helpers ---------- */

function resolveId(label, interaction) {
  if (!label) return null;
  if (label === '@everyone') return interaction.guild.roles.everyone.id;
  if (label === 'BOT') return interaction.client.user.id;
  return label; // assume it's a literal ID from config
}

function toOverwrite(ow, interaction) {
  return {
    id: resolveId(ow.id, interaction),
    allow: ow.allow ?? [],
    deny: ow.deny ?? [],
  };
}

function findChannelByNameAndType(interaction, name, type) {
  return interaction.guild.channels.cache.find(c => c.name === name && (type ? c.type === type : true)) ?? null;
}

function findCategory(guild, name) {
  return guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === name) ?? null;
}

async function applyOverwrites(interaction, channel, overwrites, reason) {
  const mapped = overwrites.map(ow => toOverwrite(ow, interaction));
  await channel.permissionOverwrites.set(mapped, reason ?? `Synced by ${interaction.user.tag} via /perms`);
}

/* ---------- command ---------- */

export const data = new SlashCommandBuilder()
  .setName('perms')
  .setDescription('Inspect or apply default permission overwrites.')
  .addSubcommand(sc =>
    sc
      .setName('show')
      .setDescription('Show my effective permissions here'),
  )
  .addSubcommand(sc =>
    sc
      .setName('apply')
      .setDescription('Apply default overwrites to a channel/category.')
      .addStringOption(opt =>
        opt
          .setName('target')
          .setDescription('Which target to sync')
          .setRequired(true)
          .addChoices(
            { name: 'chamber-of-oaths (text)', value: String(CHANNELS.CHAMBER_OF_OATHS) },
            { name: 'battlefront (category)', value: String(CHANNELS.BATTLEFRONT) },
          ),
      ),
  )
  .addSubcommand(sc =>
    sc
      .setName('apply_all')
      .setDescription('Apply default overwrites to ALL known channels/categories.'),
  )
  .addSubcommand(sc =>
    sc
      .setName('apply_battlefront')
      .setDescription('Apply strict defaults to the Battlefront category'),
  )
  .addSubcommand(sc =>
    sc
      .setName('check_top')
      .setDescription('Check that Glowwarden\'s role is at the top.'),
  )
  .addSubcommand(sc =>
    sc
      .setName('audit_invites')
      .setDescription('Scan roles/channels for any non-bot CreateInstantInvite permissions.'),
  )
  // Gate to admins by default (change if you want a custom role).
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'show') {
    const me = await interaction.guild.members.fetchMe();
    const perms = me.permissionsIn(interaction.channel).toArray().sort();
    return interaction.reply({
      ephemeral: true,
      content: `**My permissions in ${interaction.channel}:**\n` + (perms.length ? '• ' + perms.join('\n• ') : '_none_'),
    });
  }

  const entries = {
    [CHANNELS.CHAMBER_OF_OATHS]: {
      type: ChannelType.GuildText,
      name: DEFAULT_PERMISSIONS.channels[CHANNELS.CHAMBER_OF_OATHS].name,
      overwrites: DEFAULT_PERMISSIONS.channels[CHANNELS.CHAMBER_OF_OATHS].overwrites,
    },
    [CHANNELS.BATTLEFRONT]: {
      type: ChannelType.GuildCategory,
      name: DEFAULT_PERMISSIONS.categories[CHANNELS.BATTLEFRONT].name,
      overwrites: DEFAULT_PERMISSIONS.categories[CHANNELS.BATTLEFRONT].overwrites,
    },
  };

  if (sub === 'apply') {
    const key = interaction.options.getString('target', true);
    const meta = entries[key];
    if (!meta) {
      return interaction.reply({ ephemeral: true, content: 'Unknown target.' });
    }

    await interaction.deferReply({ ephemeral: true });

    const channel = findChannelByNameAndType(interaction, meta.name, meta.type);
    if (!channel) {
      return interaction.editReply(
        `I couldn't find **${meta.name}** (${meta.type === ChannelType.GuildCategory ? 'category' : 'text'}). ` +
        `Create or rename the channel to match, then re-run.`,
      );
    }

    try {
      await applyOverwrites(interaction, channel, meta.overwrites);
      return interaction.editReply(`✅ Synced overwrites on **#${channel.name}**.`);
    } catch (err) {
      console.error('perms apply failed:', err);
      return interaction.editReply('❌ Failed to apply overwrites. Ensure I have **Manage Channels** and my role is above the target roles.');
    }
  }

  if (sub === 'apply_all') {
    await interaction.deferReply({ ephemeral: true });
    const out = [];

    for (const meta of Object.values(entries)) {
      if (!meta) continue;
      const channel = findChannelByNameAndType(interaction, meta.name, meta.type);
      if (!channel) {
        out.push(`⚠️ Missing: **${meta.name}**`);
        continue;
      }
      try {
        await applyOverwrites(interaction, channel, meta.overwrites);
        out.push(`✅ Synced: **#${channel.name}**`);
      } catch (e) {
        console.error('apply_all error:', meta.name, e);
        out.push(`❌ Error: **#${channel.name}**`);
      }
    }

    out.push(
      '\nℹ️ Tip: Set **@everyone → UseApplicationCommands** at the guild level (Server Settings → Roles → @everyone).',
    );

    return interaction.editReply(out.join('\n'));
  }

  if (sub === 'apply_battlefront') {
    await interaction.deferReply({ ephemeral: true });

    const entry = DEFAULT_PERMISSIONS.categories[CHANNELS.BATTLEFRONT];
    if (!entry) return interaction.editReply('Battlefront not defined in DEFAULT_PERMISSIONS.');

    const category = findCategory(interaction.guild, entry.name);
    if (!category) {
      return interaction.editReply(`Category **${entry.name}** not found. Create/rename it, then re-run.`);
    }

    try {
      await applyOverwrites(interaction, category, entry.overwrites, 'Apply Battlefront strict defaults');
      return interaction.editReply(`✅ Applied strict defaults on **${category.name}** (CreateInvite denied to everyone except bot).`);
    } catch (e) {
      console.error('apply_battlefront failed:', e);
      return interaction.editReply('❌ Failed to apply. Ensure I have **Manage Channels** and high enough role.');
    }
  }

  if (sub === 'check_top') {
    const me = interaction.guild.members.me;
    const botRole = me?.roles?.highest;
    const topRole = interaction.guild.roles.cache.sort((a, b) => b.position - a.position).first();

    const ok = botRole && topRole && botRole.id === topRole.id;
    return interaction.reply({
      ephemeral: true,
      content: ok
        ? `✅ Glowwarden's role (**${botRole?.name}**) is at the TOP.`
        : `⚠️ Glowwarden's top role is **${botRole?.name ?? 'unknown'}**, but the top server role is **${topRole?.name ?? 'unknown'}**.\n` +
          `Move the bot's role to the very top so it can override everyone.`,
    });
  }

  if (sub === 'audit_invites') {
    await interaction.deferReply({ ephemeral: true });

    const createInvite = PermissionsBitField.Flags.CreateInstantInvite;
    const botId = interaction.client.user.id;

    const findings = [];

    // Roles that have CreateInstantInvite enabled (excluding bot role)
    interaction.guild.roles.cache.forEach(role => {
      if (role.managed && role.tags?.botId === botId) return; // bot's managed role
      if (role.permissions.has(createInvite)) {
        findings.push(`Role can create invites: @${role.name}`);
      }
    });

    // Channels where overwrites grant CreateInstantInvite to non-bot subjects
    interaction.guild.channels.cache.forEach(ch => {
      ch.permissionOverwrites.cache.forEach(ow => {
        if (ow.id === botId) return;
        if (ow.allow.has(createInvite)) {
          const subject =
            interaction.guild.roles.cache.get(ow.id)?.name
              ? `@${interaction.guild.roles.cache.get(ow.id).name}`
              : (interaction.guild.members.cache.get(ow.id)?.user.tag ?? ow.id);
          findings.push(`#${ch.name} grants CreateInvite to ${subject}`);
        }
      });
    });

    if (findings.length === 0) {
      return interaction.editReply('✅ No non-bot CreateInvite permissions found across roles/channels.');
    }

    return interaction.editReply(
      '⚠️ Found invite power outside the bot:\n• ' + findings.join('\n• ')
      + '\n\n👉 Remove CreateInvite from those roles, or add channel overwrites denying it.'
    );
  }

  return interaction.reply({ ephemeral: true, content: 'Unsupported subcommand.' });
}
