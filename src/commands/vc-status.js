// commands/vc-status.js - Command to check voice channel status
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { config } from '../config.js';

export const data = new SlashCommandBuilder()
  .setName('vc-status')
  .setDescription('Check the status of voice channels');

export async function execute(interaction) {
  const { guild } = interaction;
  
  // Get the rent-a-war-chamber channel
  const rentChannel = guild.channels.cache.get(config.RENT_WAR_CHAMBER_VC_ID);
  if (!rentChannel) {
    return interaction.reply({
      content: '❌ The Rent-A-War-Chamber channel could not be found.',
      ephemeral: true
    });
  }
  
  // Get the battlefront category
  const battlefrontCategory = guild.channels.cache.get(config.BATTLEFRONT_CATEGORY_ID);
  if (!battlefrontCategory) {
    return interaction.reply({
      content: '❌ The Battlefront category could not be found.',
      ephemeral: true
    });
  }
  
  // Get all voice channels in the battlefront category
  const warChambers = guild.channels.cache.filter(
    channel => channel.parentId === battlefrontCategory.id && channel.type === 2 // 2 = voice channel
  );
  
  // Create embed
  const embed = new EmbedBuilder()
    .setTitle('🏰 War Chamber Status')
    .setColor(0x8B4513)
    .setDescription(`There are currently ${warChambers.size} active War Chambers.`)
    .addFields(
      { 
        name: '🔑 Creating a War Chamber', 
        value: `Join <#${rentChannel.id}> to create your own private War Chamber.` 
      }
    );
  
  // Add fields for each active chamber
  if (warChambers.size > 0) {
    const chamberFields = [];
    
    for (const [, chamber] of warChambers) {
      const memberCount = chamber.members.size;
      const owner = chamber.name.includes('—') 
        ? chamber.name.split('—')[1].trim() 
        : 'Unknown';
      
      chamberFields.push({
        name: chamber.name,
        value: `👑 Host: ${owner}\n👥 Members: ${memberCount}`,
        inline: true
      });
    }
    
    embed.addFields(chamberFields);
  } else {
    embed.addFields({
      name: 'No Active Chambers',
      value: 'There are currently no active War Chambers. Be the first to create one!'
    });
  }
  
  return interaction.reply({ embeds: [embed] });
}