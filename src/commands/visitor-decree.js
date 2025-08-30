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
    .setName('visitor-decree')
    .setDescription('Post the Visitor Decree (for Stray Spores) in this channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);
  
  export async function execute(interaction) {
    const hall = process.env.SPOREHALL_CHANNEL_ID
      ? `<#${process.env.SPOREHALL_CHANNEL_ID}>`
      : 'the waiting hall';
  
    const embed = new EmbedBuilder()
      .setTitle('Visitor Decree — Welcome, Traveler')
      .setDescription(
  `You have entered the Empire as an invited guest.
  
  **Sign the decree** to declare your identity and receive access:
  • 🌈 **LGBTQIA2S+**
  • 🤝 **Ally**
  
  After you are marked, go to ${hall} and wait for your host.
  Tip: inside ${hall} you can use **/vc** to be escorted to their War Chamber.
  
  *Stray Spores are swept at dawn if not rooted.*`
      );
  
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('flair:lgbt').setLabel('🌈 I am LGBTQIA2S+').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('flair:ally').setLabel('🤝 I am an Ally').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('sporebox:host').setLabel('📣 Ping a Host').setStyle(ButtonStyle.Primary),
    );
  
    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: 'Decree posted. Pin it for convenience.', flags: MessageFlags.Ephemeral });
  }
  