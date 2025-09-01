// ============= src/database/characters.js =============
import Database from 'better-sqlite3';
import path from 'path';

// Create/open database file
const db = new Database(path.join(process.cwd(), 'characters.db'));

// Create table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    class TEXT,
    realm TEXT,
    is_main BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
  )
`);

// Prepared statements for better performance
const statements = {
  addCharacter: db.prepare(`
    INSERT INTO characters (user_id, name, class, realm, is_main)
    VALUES (?, ?, ?, ?, ?)
  `),
  
  getCharacters: db.prepare(`
    SELECT * FROM characters 
    WHERE user_id = ? 
    ORDER BY is_main DESC, created_at ASC
  `),
  
  characterExists: db.prepare(`
    SELECT COUNT(*) as count 
    FROM characters 
    WHERE user_id = ? AND LOWER(name) = LOWER(?)
  `),
  
  unmarkAllMains: db.prepare(`
    UPDATE characters 
    SET is_main = 0 
    WHERE user_id = ?
  `),
  
  removeCharacter: db.prepare(`
    DELETE FROM characters 
    WHERE user_id = ? AND LOWER(name) = LOWER(?)
  `),
  
  getCharacter: db.prepare(`
    SELECT * FROM characters 
    WHERE user_id = ? AND LOWER(name) = LOWER(?)
  `)
};

export class CharacterDB {
  static addCharacter(userId, name, charClass, realm, isMain = false) {
    // If setting as main, unmark all others first
    if (isMain) {
      statements.unmarkAllMains.run(userId);
    }

    return statements.addCharacter.run(userId, name, charClass, realm, isMain ? 1 : 0);
  }

  static getCharacters(userId) {
    return statements.getCharacters.all(userId).map(char => ({
      name: char.name,
      class: char.class,
      realm: char.realm,
      isMain: char.is_main === 1,
      createdAt: char.created_at
    }));
  }

  static characterExists(userId, name) {
    const result = statements.characterExists.get(userId, name);
    return result.count > 0;
  }

  static getCharacter(userId, name) {
    const char = statements.getCharacter.get(userId, name);
    if (!char) return null;
    
    return {
      name: char.name,
      class: char.class,
      realm: char.realm,
      isMain: char.is_main === 1,
      createdAt: char.created_at
    };
  }

  static removeCharacter(userId, name) {
    return statements.removeCharacter.run(userId, name);
  }

  // Gracefully close database connection
  static close() {
    db.close();
  }
}

// ============= Updated src/commands/addalt.js =============
import { 
  SlashCommandBuilder, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags,
  EmbedBuilder
} from 'discord.js';
import { CharacterDB } from '../database/characters.js';

export const data = new SlashCommandBuilder()
  .setName('addalt')
  .setDescription('Add a new character to your roster');

export async function execute(interaction) {
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

// ============= Updated src/commands/switch.js =============
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

  const character = CharacterDB.getCharacter(userId, characterChoice);
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