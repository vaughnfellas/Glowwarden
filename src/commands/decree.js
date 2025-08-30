import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('decree')
  .setDescription('Post the Imperial Decree with flair buttons')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  if (interaction.channelId !== String(process.env.DECREE_CHANNEL_ID)) {
    return interaction.reply({ content: 'Run this in the Chamber of Oaths.', flags: MessageFlags.Ephemeral });
  }

  const embed = new EmbedBuilder()
    .setTitle('Decree — Welcome Traveler')
    .setDescription(
      [
        'Hear the call, wayfarer! You now stand before the radiant banners of the Empire, where Pride is power, spores are sacred, and fellowship endures forever.',
        '',
        '🛡 **The Imperial Decree**',
        '• All are welcome beneath our rainbow standard — LGBTQ+ and Allies alike.',
        '• Heresy of hate shall not pass our gates — bigotry, slurs, or mockery of identity are banishable offenses.',
        '• Claim your true name — set your nickname to your WoW character.',
        '• Honor the fellowship — laughter, respect, and solidarity guide our quests more than gold or gear.',
        '',
        'Place your seal upon this decree and declare your truth:',
      ].join('\n')
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('flair:lgbt').setLabel('🌈 LGBTQIA2S+').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('flair:ally').setLabel('🤝 Ally').setStyle(ButtonStyle.Secondary),
  );

  await interaction.reply({ embeds: [embed], components: [row] });
}