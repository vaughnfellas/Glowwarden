// decree.js - Command to post the Imperial Decree with flair buttons
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { checkOwnerPermission } from '../utils/owner.js';
import { CHANNELS } from '../channels.js';
import { config } from '../config.js';
import { db } from '../db.js';


export const data = new SlashCommandBuilder()
  .setName('decree')
  .setDescription('Post the Imperial Decree with flair buttons')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  // Check if user is owner
  if (!(await checkOwnerPermission(interaction))) return;

  if (interaction.channelId !== CHANNELS.CHAMBER_OF_OATHS) {
    return interaction.reply({ content: 'Run this in the Chamber of Oaths.', flags: MessageFlags.Ephemeral });
  }

  const embed = new EmbedBuilder()
    .setTitle('📜 **Imperial Decree — Welcome Traveler**')
    .setDescription(
      [
        '*Hear the call, wayfarer! You now stand before the radiant banners of the Empire, where Pride is power, spores are sacred, and fellowship endures forever.*',
        '',
        '🛡️ **The Imperial Decree**',
        '• All are welcome beneath our rainbow standard — LGBTQ+ and Allies alike.',
        '• Heresy of hate shall not pass our gates — bigotry, slurs, or mockery of identity are banishable offenses.',
        '• **Claim your true name** — declare your WoW character name as you sign.',
        '• Honor the fellowship — laughter, respect, and solidarity guide our quests more than gold or gear.',
        '',
        '**Place your seal upon this decree and declare your truth:**',
        '*When you sign below, you\'ll be prompted to enter your character name for the guild records.*',
      ].join('\n')
    )
    .setColor(0x8B4513)
    .setFooter({ text: 'May the spores guide your path, champion.' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('flair:lgbt').setLabel('🌈 LGBTQIA2S+').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('flair:ally').setLabel('🤝 Ally').setStyle(ButtonStyle.Secondary),
  );

  await interaction.reply({ embeds: [embed], components: [row] });
}