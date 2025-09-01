// src/commands/glowwarden.js
import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { commands as expectedMap } from './index.js'; // your aggregator: Map(name -> module)

export const data = new SlashCommandBuilder()
  .setName('glowwarden')
  .setDescription('List Glowwarden commands and why they are/aren’t available here')
  .setDMPermission(false);

export async function execute(interaction) {
  const guild = interaction.guild;
  const channel = interaction.channel;
  const meInChan = channel?.permissionsFor(interaction.member);
  const canUseAppCmdsHere = meInChan?.has(PermissionFlagsBits.UseApplicationCommands) ?? false;

  // Registered commands Discord knows about in THIS guild
  const registered = await guild.commands.fetch(); // Collection<string, ApplicationCommand>
  const registeredNames = new Set([...registered.values()].map(c => c.name));

  // Expected (from your code) vs Registered (Discord) → “Not registered”
  const expectedNames = [...expectedMap.keys()];
  const notRegistered = expectedNames.filter(n => !registeredNames.has(n));

  // Split registered into buckets for this user + channel
  const available = [];
  const blocked = []; // with reasons

  for (const cmd of registered.values()) {
    const needed = cmd.defaultMemberPermissions; // PermissionsBitField | null
    const hasMemberPerms = !needed || interaction.memberPermissions?.has(needed);

    if (!canUseAppCmdsHere) {
      blocked.push(`/${cmd.name} — blocked by channel permission **Use Application Commands**`);
      continue;
    }
    if (!hasMemberPerms) {
      blocked.push(`/${cmd.name} — blocked by default perms (**${needed?.toArray().join(', ') || '—'}**)`);
      continue;
    }
    // If it passes both checks but user previously didn't see it in picker,
    // that usually means Integrations → Commands channel restriction:
    // We’ll show it as available and add a note below.
    available.push(`/${cmd.name} — ${cmd.description || '—'}`);
  }

  const lines = (arr) => arr.length ? arr.join('\n') : '*None*';

  const embed = new EmbedBuilder()
    .setTitle('Glowwarden — commands in this guild')
    .addFields(
      { name: '✅ Available to you **here**', value: lines(available) },
      { name: '⛔ Registered but **blocked**', value: lines(blocked) },
      { name: '❓ **Not registered** (expected by code but missing in guild)', value: lines(notRegistered.map(n => `/${n}`)) },
    )
    .setFooter({ text: 'Note: If a command is “Available” but still not in the picker, it is likely channel-restricted via Integrations → Glowwarden → Commands.' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
