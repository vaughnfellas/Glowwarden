// ============= src/commands/addalt.js =============
import { 
  SlashCommandBuilder, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { CharacterDB } from '../database/characters.js';

export const data = new SlashCommandBuilder()
.setName('addalt')
.setDescription('Add a new character to your roster');

export async function execute(interaction) {
// Show class selection dropdown first
const classOptions = [
  { label: '⚔️ Warrior', value: 'Warrior', emoji: '⚔️' },
  { label: '🛡️ Paladin', value: 'Paladin', emoji: '🛡️' },
  { label: '🏹 Hunter', value: 'Hunter', emoji: '🏹' },
  { label: '🗡️ Rogue', value: 'Rogue', emoji: '🗡️' },
  { label: '✨ Priest', value: 'Priest', emoji: '✨' },
  { label: '⚡ Shaman', value: 'Shaman', emoji: '⚡' },
  { label: '🔥 Mage', value: 'Mage', emoji: '🔥' },
  { label: '💀 Warlock', value: 'Warlock', emoji: '💀' },
  { label: '🌿 Druid', value: 'Druid', emoji: '🌿' },
  { label: '❓ Classless', value: 'none', emoji: '❓' },
];

const selectMenu = new StringSelectMenuBuilder()
  .setCustomId(`addalt_class:${interaction.user.id}`)
  .setPlaceholder('⚔️ Choose your character\'s class...')
  .addOptions(classOptions);

const row = new ActionRowBuilder().addComponents(selectMenu);

await interaction.reply({
  content: '🎭 **Adding a new character to your roster!**\nFirst, choose your class:',
  components: [row],
  flags: MessageFlags.Ephemeral,
});
}

// ============= Character Details Modal =============
export function createAddAltModal(selectedClass, userId) {
const className = selectedClass === 'none' ? 'Classless' : selectedClass;

const modal = new ModalBuilder()
  .setCustomId(`addalt_modal:${userId}:${selectedClass}`)
  .setTitle(`🎭 Register ${className} Character`);

const nameInput = new TextInputBuilder()
  .setCustomId('character_name')
  .setLabel('Character Name')
  .setStyle(TextInputStyle.Short)
  .setPlaceholder(`Enter your ${className === 'Classless' ? '' : className + ' '}character's name`)
  .setRequired(true)
  .setMaxLength(32);

const realmInput = new TextInputBuilder()
  .setCustomId('character_realm')
  .setLabel('Realm (Optional)')
  .setStyle(TextInputStyle.Short)
  .setPlaceholder('Which server is this character on?')
  .setRequired(false)
  .setMaxLength(30);

const mainInput = new TextInputBuilder()
  .setCustomId('is_main')
  .setLabel('Is this your main character?')
  .setStyle(TextInputStyle.Short)
  .setPlaceholder('Type "yes" if this is your main, or leave blank for alt')
  .setRequired(false)
  .setMaxLength(3);

const firstRow = new ActionRowBuilder().addComponents(nameInput);
const secondRow = new ActionRowBuilder().addComponents(realmInput);
const thirdRow = new ActionRowBuilder().addComponents(mainInput);

modal.addComponents(firstRow, secondRow, thirdRow);
return modal;
}

// ============= Roster Command =============
export const rosterData = new SlashCommandBuilder()
.setName('roster')
.setDescription('View your character roster');

export async function executeRoster(interaction) {
const userId = interaction.user.id;
const characters = CharacterDB.getCharacters(userId);

if (characters.length === 0) {
  return interaction.reply({
    content: '⛔ You haven\'t registered any characters yet. Use `/addalt` to register characters.',
    flags: MessageFlags.Ephemeral,
  });
}

const embed = new EmbedBuilder()
  .setColor(0x3498db)
  .setTitle('🎭 Your Character Roster')
  .setDescription(characters.map(char => {
    const mainIcon = char.isMain ? '👑 ' : '';
    const classText = char.class ? ` - ${char.class}` : '';
    const realmText = char.realm ? ` of ${char.realm}` : '';
    return `${mainIcon}**${char.name}**${classText}${realmText}`;
  }).join('\n'))
  .setFooter({ text: `Total characters: ${characters.length}` });

await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ============= Delete Alt Command =============
export const deleteAltData = new SlashCommandBuilder()
.setName('deletealt')
.setDescription('Delete a character from your roster')
.addStringOption(option =>
  option.setName('character')
    .setDescription('Which character to delete')
    .setRequired(true)
    .setAutocomplete(true)
);

export async function executeDeleteAlt(interaction) {
const characterName = interaction.options.getString('character', true);
const userId = interaction.user.id;

if (!CharacterDB.characterExists(userId, characterName)) {
  return interaction.reply({
    content: `⛔ You don't have a character named **${characterName}**.`,
    flags: MessageFlags.Ephemeral,
  });
}

const character = CharacterDB.getCharacter(userId, characterName);

// Create confirmation buttons
const row = new ActionRowBuilder()
  .addComponents(
    new ButtonBuilder()
      .setCustomId(`confirm_delete:${userId}:${encodeURIComponent(characterName)}`)
      .setLabel('Yes, delete this character')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`cancel_delete:${userId}:${encodeURIComponent(characterName)}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
  );

const mainWarning = character.isMain ? 
  '\n\n⚠️ **Warning**: This is your main character. Deleting it will require you to set a new main.' : '';

await interaction.reply({
  content: `Are you sure you want to delete **${characterName}**?${mainWarning}`,
  components: [row],
  flags: MessageFlags.Ephemeral,
});
}

// ============= Switch Command =============
export const switchData = new SlashCommandBuilder()
.setName('switch')
.setDescription('Switch to one of your characters')
.addStringOption(option =>
  option.setName('character')
    .setDescription('Which character to switch to')
    .setRequired(true)
    .setAutocomplete(true)
);

export async function executeSwitch(interaction) {
const characterChoice = interaction.options.getString('character', true);
const member = interaction.member;
const userId = member.user.id;

const characters = CharacterDB.getCharacters(userId);
if (characters.length === 0) {
  return interaction.reply({
    content: '⛔ You haven\'t registered any characters yet. Use `/addalt` to register characters.',
    flags: MessageFlags.Ephemeral,
  });
}

const character = characters.find(c => 
  c.name.toLowerCase() === characterChoice.toLowerCase()
);

if (!character) {
  return interaction.reply({
    content: '⛔ I couldn\'t find that character in your roster.',
    flags: MessageFlags.Ephemeral,
  });
}

try {
  const oldName = member.displayName;
  await member.setNickname(character.name);

  const classText = character.class && character.class !== 'none' ? `, ${character.class}` : '';
  const realmText = character.realm ? ` of ${character.realm}` : '';
  
  const embed = new EmbedBuilder()
    .setColor(character.isMain ? 0xFFD700 : 0x8B4513)
    .setTitle(character.isMain ? '👑 **Main Character Active**' : '🎭 **Alt Character Switch**')
    .setDescription(`
*${oldName} steps into the shadows as **${character.name}${classText}${realmText}** emerges into the light.*

${character.isMain ? 
'*Your main character has taken the field. The guild banner flies proudly.*' : 
'*Your alt is ready for adventure. May this persona serve you well.*'}
    `)
    .setTimestamp()
    .setFooter({ text: 'Use /switch anytime to change characters!' });

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

} catch (error) {
  console.error('Character switch failed:', error);
  await interaction.reply({
    content: '⛔ I couldn\'t switch your character. Contact a guild officer.',
    flags: MessageFlags.Ephemeral,
  });
}
}

export async function autocompleteSwitchCharacters(interaction) {
const focused = (interaction.options.getFocused() || '').toLowerCase();
const userId = interaction.user.id;
const characters = CharacterDB.getCharacters(userId);

if (characters.length === 0) {
  return interaction.respond([
    { name: "No characters registered - use /addalt", value: "none" }
  ]);
}

const choices = characters
  .filter(char => {
    const searchText = `${char.name} ${char.class || ''}`.toLowerCase();
    return !focused || searchText.includes(focused);
  })
  .map(char => {
    const classText = char.class && char.class !== 'none' ? ` (${char.class})` : '';
    const mainIcon = char.isMain ? ' 👑' : '';
    return { 
      name: `${char.name}${classText}${mainIcon}`, 
      value: char.name 
    };
  })
  .slice(0, 25);

await interaction.respond(choices);
}

export async function autocompleteDeleteCharacters(interaction) {
// Reuse the same autocomplete function for both switch and delete
return autocompleteSwitchCharacters(interaction);
}
