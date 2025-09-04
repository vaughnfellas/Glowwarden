// src/commands/glowwarden.js
// Lists commands that are available in the current channel,
// commands that are registered but blocked (by channel/member perms),
// and commands expected by the code but not registered in the guild.

import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from 'discord.js';

/**
 * Build the slash command data
 */
export const data = new SlashCommandBuilder()
  .setName('glowwarden')
  .setDescription('List available and blocked commands in this guild/channel')
  .setDMPermission(false);

/**
 * Safely checks a permission bitfield (handles null/undefined)
 * @param {import('discord.js').PermissionsBitField | null | undefined} perms
 * @param {bigint | number} bits
 */
function hasPerm(perms, bits) {
  try {
    return Boolean(perms?.has(bits));
  } catch {
    return false;
  }
}

/**
 * Get a Set of registered command names for this guild
 * @param {import('discord.js').Guild} guild
 * @returns {Promise<Set<string>>}
 */
async function fetchRegisteredCommandNames(guild) {
  const registered = await guild.commands.fetch();
  return new Set([...registered.values()].map((c) => c.name));
}

/**
 * Pull the "expected" command names from client.commands if present
 * Fallback: use the registered names.
 * @param {import('discord.js').Client} client
 * @param {Set<string>} fallback
 */
function getExpectedCommandNames(client, fallback) {
  // Many bots stash a Collection<string, { data: SlashCommandBuilder | { name, description } }>
  const maybe = client.commands;
  if (!maybe) return [...fallback];
  try {
    if (typeof maybe.keys === 'function') {
      // Collection-like
      return [...maybe.keys()];
    }
    if (Array.isArray(maybe)) {
      // Array of entries
      return maybe.map((c) => c?.data?.name ?? c?.name).filter(Boolean);
    }
  } catch {
    // fall through
  }
  return [...fallback];
}

/**
 * Format arrays nicely for embed fields
 * @param {string[]} arr
 */
function fmtLines(arr) {
  if (!arr || arr.length === 0) return '*None*';
  // Discord field hard limit is ~1024 chars; keep it reasonable
  const joined = arr.join('\n');
  return joined.length <= 1000 ? joined : joined.slice(0, 997) + '...';
}

/**
 * Command executor
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
export async function execute(interaction) {
  if (!interaction.inGuild()) {
    await interaction.reply({
      content: 'This command can only be used in a server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const guild = interaction.guild;
  const channel = interaction.channel;

  try {
    // Channel-level permission: Use Application Commands
    const memberPermsInChannel = channel?.permissionsFor?.(interaction.member) ?? null;
    const canUseAppCmdsHere = hasPerm(memberPermsInChannel, PermissionFlagsBits.UseApplicationCommands);

    // Registered in this guild
    const registeredNames = await fetchRegisteredCommandNames(guild);

    // Expected by code (falls back to registered if no registry found)
    const expectedNames = getExpectedCommandNames(interaction.client, registeredNames);

    // For display buckets
    const available = [];
    const blocked = [];
    const notRegistered = expectedNames.filter((n) => !registeredNames.has(n));

    // We want details (description/default perms) for registered commands
    const registeredCommands = await guild.commands.fetch();

    for (const cmd of registeredCommands.values()) {
      const neededDefault = cmd.defaultMemberPermissions; // PermissionsBitField | null
      const memberHasDefaults = neededDefault
        ? hasPerm(interaction.memberPermissions, neededDefault)
        : true;

      if (!canUseAppCmdsHere) {
        blocked.push(
          `/${cmd.name} — blocked by channel permission **Use Application Commands**`
        );
        continue;
      }

      if (!memberHasDefaults) {
        const neededList = neededDefault?.toArray?.().join(', ') || '—';
        blocked.push(
          `/${cmd.name} — blocked by required member permissions (**${neededList}**)`
        );
        continue;
      }

      // Looks good
      const desc = cmd.description || '—';
      available.push(`/${cmd.name} — ${desc}`);
    }

    const embed = new EmbedBuilder()
      .setTitle('Glowwarden — Commands in this Guild')
      .addFields(
        { name: '✅ Available **in this channel**', value: fmtLines(available) },
        { name: '⛔ Registered but **blocked** here', value: fmtLines(blocked) },
        {
          name: '❓ Expected by code but **not registered**',
          value: fmtLines(notRegistered.map((n) => `/${n}`)),
        }
      )
      .setFooter({
        text:
          'Tip: If a command should be visible but isn’t, check Integrations → Glowwarden → Commands for channel restrictions.',
      });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (err) {
    console.error('glowwarden execute error:', err);
    const msg = 'An error occurred while listing commands.';
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
      }
    } catch (nestedErr) {
      // Swallow to avoid crashing the process on reply failures
      console.error('glowwarden follow-up error:', nestedErr);
    }
  }
}
