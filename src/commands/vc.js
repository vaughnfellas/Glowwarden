// ============= src/commands/vc.js =============
import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { config } from '../config.js';
import { tempOwners } from '../services/temp-vc-service.js';

export const data = new SlashCommandBuilder()
  .setName('vc')
  .setDescription('Move to a host\'s War Chamber')
  .addStringOption(option =>
    option.setName('host')
      .setDescription('The host whose chamber you want to join')
      .setRequired(true)
      .setAutocomplete(true)
  );

export async function execute(interaction) {
  const hostId = interaction.options.getString('host', true);
  const member = interaction.member;

  const vs = member.voice;
  if (!vs?.channelId) {
    await interaction.reply({ content: '❌ Join *Sporehall* first, then use /vc.', flags: 64 });
    return;
  }
  if (config.LOBBY_VC_ID && vs.channelId !== config.LOBBY_VC_ID) {
    await interaction.reply({ content: '⚠️ Please join *Sporehall* first, then use /vc.', flags: 64 });
    return;
  }

  const entry = [...tempOwners.entries()].find(([, owner]) => owner === hostId);
  if (!entry) {
    await interaction.reply({ content: '❌ I can\'t find a War Chamber for that host right now.', flags: 64 });
    return;
  }

  const [chamberId] = entry;
  const chamber = await interaction.guild.channels.fetch(chamberId).catch(() => null);
  if (!chamber || chamber.type !== ChannelType.GuildVoice) {
    await interaction.reply({ content: '❌ That War Chamber doesn\'t seem to exist anymore.', flags: 64 });
    return;
  }

  try {
    await member.voice.setChannel(chamber);
    await interaction.reply({ content: `✅ Moved you to **${chamber.name}**.`, flags: 64 });
  } catch (e) {
    console.error('vc move failed:', e);
    await interaction.reply({
      content: '❌ I couldn\'t move you. I need *Move Members* in both channels.',
      flags: 64,
    });
  }
}

export async function autocomplete(interaction) {
  const focused = (interaction.options.getFocused() || '').toLowerCase();
  const entries = [...tempOwners.entries()].slice(0, 25);

  const choices = [];
  for (const [, ownerId] of entries) {
    try {
      const user = await interaction.client.users.fetch(ownerId);
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
}
