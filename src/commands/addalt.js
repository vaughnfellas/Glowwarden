// commands/addalt.js - Character management commands
import { 
  SlashCommandBuilder, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} from 'discord.js';
import { CharacterDB } from '../database/characters.js';

// Class options for WoW
const CLASS_OPTIONS = [
  { name: 'Death Knight', value: 'Death Knight', emoji: '💀' },
  { name: 'Demon Hunter', value: 'Demon Hunter', emoji: '👹' },
  { name: 'Druid', value: 'Druid', emoji: '🐻' },
  { name: 'Evoker', value: 'Evoker', emoji: '🐉' },
  { name: 'Hunter', value: 'Hunter', emoji: '🏹' },
  { name: 'Mage', value: 'Mage', emoji: '🔮' },
  { name: 'Monk', value: 'Monk', emoji: '🧘' },
  { name: 'Paladin', value: 'Paladin', emoji: '🛡️' },
  { name: 'Priest', value: 'Priest', emoji: '✨' },
  { name: 'Rogue', value: 'Rogue', emoji: '🗡️' },
  { name: 'Shaman', value: 'Shaman', emoji: '⚡' },
  { name: 'Warlock', value: 'Warlock', emoji: '🔥' },
  { name: 'Warrior', value: 'Warrior', emoji: '⚔️' },
  { name: 'None/Other', value: 'none', emoji: '❓' }
];

// Command to add an alt character
export const data = new SlashCommandBuilder()
  .setName('addalt')
  .setDescription('Add an alternate character to your profile');

// Command to switch main character
export const switchData = new SlashCommandBuilder()
  .setName('switch')
  .setDescription('Switch your active character')
  .addStringOption(option =>
    option.setName('character')
      .setDescription('Character to switch to')
      .setRequired(true)
      .setAutocomplete(true)
  );

// Command to view character roster
export const rosterData = new SlashCommandBuilder()
  .setName('roster')
  .setDescription('View your character roster');

// Command to delete an alt character
export const deleteAltData = new SlashCommandBuilder()
  .setName('deletealt')
  .setDescription('Delete a character from your roster')
  .addStringOption(option =>
    option.setName('character')
      .setDescription('Character to delete')
      .setRequired(true)
      .setAutocomplete(true)
  );

// Create the class selection menu
function createClassSelectionMenu(userId) {
  const options = CLASS_OPTIONS.map(classOption => 
    new StringSelectMenuOptionBuilder()
      .setLabel(classOption.name)
      .setValue(classOption.value)
      .setEmoji(classOption.emoji)
  );

  const select = new StringSelectMenuBuilder()
    .setCustomId(`addalt_class:${userId}`)
    .setPlaceholder('Select your character class')
    .addOptions(options);

  return new ActionRowBuilder().addComponents(select);
}

// Create the addalt modal
export function createAddAltModal(selectedClass, userId) {
  const modal = new ModalBuilder()
    .setCustomId(`addalt_modal:${userId}:${selectedClass}`)
    .setTitle('Add Character');

  const characterInput = new TextInputBuilder()
    .setCustomId('character_name')
    .setLabel('Character Name')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Enter your character name')
    .setRequired(true)
    .setMaxLength(32);

  const realmInput = new TextInputBuilder()
    .setCustomId('character_realm')
    .setLabel('Realm (Optional)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., Stormrage, Tichondrius')
    .setRequired(false)
    .setMaxLength(30);

  const isMainInput = new TextInputBuilder()
    .setCustomId('is_main')
    .setLabel('Set as Main Character? (yes/no)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('yes or no')
    .setRequired(true)
    .setValue('no')
    .setMaxLength(3);

  const firstRow = new ActionRowBuilder().addComponents(characterInput);
  const secondRow = new ActionRowBuilder().addComponents(realmInput);
  const thirdRow = new ActionRowBuilder().addComponents(isMainInput);

  modal.addComponents(firstRow, secondRow, thirdRow);
  return modal;
}

// Execute addalt command
export async function execute(interaction) {
  const userId = interaction.user.id;
  const row = createClassSelectionMenu(userId);
  
  await interaction.reply({
    content: '🎭 **Character Registration**\nSelect your character\'s class:',
    components: [row],
    ephemeral: true
  });
}

// Execute switch command
export async function executeSwitch(interaction) {
  const userId = interaction.user.id;
  const characterName = interaction.options.getString('character');
  
  // Check if character exists
  const character = await CharacterDB.getCharacter(userId, characterName);
  if (!character) {
    return interaction.reply({
      content: `❌ Character **${characterName}** not found in your roster.`,
      ephemeral: true
    });
  }
  
  // Set as main character
  await CharacterDB.setMainCharacter(userId, characterName);
  
  // Update nickname
  try {
    const member = interaction.member;
    await member.setNickname(characterName);
  } catch (error) {
    console.log(`No permission to set nickname for ${interaction.user.tag}:`, error.message);
  }
  
  return interaction.reply({
    content: `✅ Switched to **${characterName}** as your main character!`,
    ephemeral: true
  });
}

// Execute roster command
export async function executeRoster(interaction) {
  const userId = interaction.user.id;
  
  // Get all characters
  const characters = await CharacterDB.getCharacters(userId);
  
  if (characters.length === 0) {
    return interaction.reply({
      content: '❌ You have no characters registered. Use `/addalt` to add characters.',
      ephemeral: true
    });
  }
  
  // Create embed
  const embed = new EmbedBuilder()
    .setTitle('🎭 Your Character Roster')
    .setColor(0x8B4513)
    .setDescription(`You have ${characters.length} character(s) registered.`);
  
  // Add fields for each character
  for (const char of characters) {
    const mainTag = char.isMain ? '👑 **MAIN**' : '';
    const classText = char.class ? `**Class:** ${char.class}` : '';
    const realmText = char.realm ? `**Realm:** ${char.realm}` : '';
    
    const details = [mainTag, classText, realmText].filter(Boolean).join('\n');
    
    embed.addFields({
      name: char.name,
      value: details || 'No additional details',
      inline: true
    });
  }
  
  return interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}

// Execute deletealt command
export async function executeDeleteAlt(interaction) {
  const userId = interaction.user.id;
  const characterName = interaction.options.getString('character');
  
  // Check if character exists
  const character = await CharacterDB.getCharacter(userId, characterName);
  if (!character) {
    return interaction.reply({
      content: `❌ Character **${characterName}** not found in your roster.`,
      ephemeral: true
    });
  }
  
  // Create confirmation buttons
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`confirm_delete:${userId}:${encodeURIComponent(characterName)}`)
      .setLabel('Delete Character')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`cancel_delete:${userId}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
  );
  
  return interaction.reply({
    content: `⚠️ Are you sure you want to delete **${characterName}**? This cannot be undone.`,
    components: [row],
    ephemeral: true
  });
}