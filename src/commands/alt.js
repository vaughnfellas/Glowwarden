// commands/alt.js - Streamlined character management interface
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

// Classic WoW classes only
const CLASS_OPTIONS = [
  { name: 'Druid', value: 'Druid', emoji: '🻃' },
  { name: 'Hunter', value: 'Hunter', emoji: '🏹' },
  { name: 'Mage', value: 'Mage', emoji: '🔮' },
  { name: 'Paladin', value: 'Paladin', emoji: '🛡️' },
  { name: 'Priest', value: 'Priest', emoji: '✨' },
  { name: 'Rogue', value: 'Rogue', emoji: '🗡️' },
  { name: 'Shaman', value: 'Shaman', emoji: '⚡' },
  { name: 'Warlock', value: 'Warlock', emoji: '🔥' },
  { name: 'Warrior', value: 'Warrior', emoji: '⚔️' },
  { name: 'None/Other', value: 'none', emoji: '❓' }
];

export const data = new SlashCommandBuilder()
  .setName('alt')
  .setDescription('Manage your character roster with a simple interface');

// Utility function to validate character name
function validateCharacterName(name) {
  if (!name || typeof name !== 'string') {
    return 'Character name is required';
  }
  
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 32) {
    return 'Character name must be between 2 and 32 characters';
  }
  
  if (!/^[a-zA-ZÀ-ÿ0-9'-]+$/.test(trimmed)) {
    return 'Character name contains invalid characters';
  }
  
  return null;
}

// Get emoji for class
function getClassEmoji(className) {
  const classOption = CLASS_OPTIONS.find(opt => opt.value === className);
  return classOption ? classOption.emoji : '❓';
}

// Create the main character interface with list + action buttons
async function createCharacterInterface(userId, selectedCharName = null) {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const characters = await CharacterDB.getCharacters(userId);
    
    const embed = new EmbedBuilder()
      .setTitle('🎭 Character Management')
      .setColor(0x8B4513)
      .setTimestamp();

    if (characters.length === 0) {
      embed.setDescription('You have no characters registered yet.\nClick "Add Character" below to get started!');
      
      // Only show Add button when no characters
      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`alt_add:${userId}`)
          .setLabel('Add Character')
          .setStyle(ButtonStyle.Success)
          .setEmoji('➕')
      );

      return { embeds: [embed], components: [actionRow] };
    }

    // Show current main
    const currentMain = characters.find(c => c.isMain);
    if (currentMain) {
      embed.addFields({
        name: '👑 Main Character',
        value: `**${currentMain.name}**${currentMain.class ? ` (${currentMain.class})` : ''}${currentMain.realm ? ` - ${currentMain.realm}` : ''}`,
        inline: false
      });
    }

    // Add all characters to the embed
    const charList = characters.map(char => {
      const classEmoji = getClassEmoji(char.class);
      const mainTag = char.isMain ? ' 👑' : '';
      return `${classEmoji} **${char.name}**${char.class ? ` (${char.class})` : ''}${char.realm ? ` - ${char.realm}` : ''}${mainTag}`;
    }).join('\n');
    
    embed.addFields({
      name: '📜 Your Characters',
      value: charList || 'No characters found',
      inline: false
    });

    // Create character selection dropdown
    const options = characters.map(char => {
      const classEmoji = getClassEmoji(char.class);
      return new StringSelectMenuOptionBuilder()
        .setLabel(char.name)
        .setValue(char.name)
        .setDescription(`${char.class || 'No class'}${char.realm ? ` • ${char.realm}` : ''}${char.isMain ? ' • MAIN' : ''}`)
        .setEmoji(classEmoji);
    });

    // Set the placeholder to show selected character if one is selected
    let placeholder = 'Select a character to manage...';
    if (selectedCharName) {
      const selectedChar = characters.find(c => c.name === selectedCharName);
      if (selectedChar) {
        placeholder = `Selected: ${selectedChar.name}`;
      }
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`alt_character_select:${userId}`)
      .setPlaceholder(placeholder)
      .addOptions(options);

    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

    // Action buttons row
    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`alt_add:${userId}`)
        .setLabel('Add Character')
        .setStyle(ButtonStyle.Success)
        .setEmoji('➕'),
      new ButtonBuilder()
        .setCustomId(`alt_switch:${userId}`)
        .setLabel('Switch Active')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔄'),
      new ButtonBuilder()
        .setCustomId(`alt_delete:${userId}`)
        .setLabel('Delete Character')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️')
    );

    embed.setDescription(`Select a character from the dropdown, then use the buttons below to manage them.\n\n**Total Characters:** ${characters.length}`);

    return { embeds: [embed], components: [selectRow, actionRow] };
  } catch (error) {
    console.error('Error creating character interface:', error);
    throw error;
  }
}

// Create add character modal
function createAddCharacterModal(userId) {
  const modal = new ModalBuilder()
    .setCustomId(`alt_add_modal:${userId}`)
    .setTitle('➕ Add New Character');

  const nameInput = new TextInputBuilder()
    .setCustomId('character_name')
    .setLabel('Character Name')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Enter your character name (2-32 characters)')
    .setRequired(true)
    .setMinLength(2)
    .setMaxLength(32);

  const classInput = new TextInputBuilder()
    .setCustomId('character_class')
    .setLabel('Character Class')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., Paladin, Mage, Hunter (or leave empty)')
    .setRequired(false)
    .setMaxLength(20);

  const realmInput = new TextInputBuilder()
    .setCustomId('character_realm')
    .setLabel('Realm (Optional)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., Stormrage, Tichondrius')
    .setRequired(false)
    .setMaxLength(30);

  modal.addComponents(
    new ActionRowBuilder().addComponents(nameInput),
    new ActionRowBuilder().addComponents(classInput),
    new ActionRowBuilder().addComponents(realmInput)
  );

  return modal;
}

// Create make main character buttons
function createMakeMainButton(userId, characterName) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`alt_make_main:${userId}:${characterName}`)
      .setLabel('Make This My Main')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('👑'),
    new ButtonBuilder()
      .setCustomId(`alt_skip_main:${userId}`)
      .setLabel('Keep as Alt')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('✋')
  );
}

// Safely set nickname
async function setMemberNickname(member, nickname) {
  if (!member || !nickname) return false;
  
  try {
    if (member.manageable) {
      await member.setNickname(nickname);
      return true;
    }
  } catch (error) {
    console.log(`No permission to set nickname: ${error.message}`);
  }
  return false;
}

// Main command execution
export async function execute(interaction) {
  if (!interaction?.user?.id) {
    console.error('Invalid interaction in alt command execute');
    return;
  }

  try {
    const userId = interaction.user.id;
    const interfaceData = await createCharacterInterface(userId);
    
    await interaction.reply({
      ...interfaceData,
      flags: 1 << 6 // Ephemeral
    });
  } catch (error) {
    console.error('Error in alt command execute:', error);
    
    await interaction.reply({
      content: 'An error occurred while loading your character interface.',
      flags: 1 << 6
    });
  }
}

// Store selected character for current user session
const userSelections = new Map();

// Handle select menu interactions  
export async function handleSelectMenu(interaction) {
  if (!interaction?.customId || !interaction?.user?.id || !interaction.values?.length) return;

  try {
    const parts = interaction.customId.split(':');
    const [menuType, userId] = parts;
    
    if (userId !== interaction.user.id) {
      return interaction.reply({
        content: 'This selection is not for you.',
        flags: 1 << 6
      });
    }

    if (menuType === 'alt_character_select') {
      const selectedCharacter = interaction.values[0];
      
      // Store the selection for this user
      userSelections.set(userId, selectedCharacter);
      
      // Get character details
      const character = await CharacterDB.getCharacter(userId, selectedCharacter);
      if (!character) {
        return interaction.update({
          content: '❌ Character not found.',
          components: []
        });
      }

      const classText = character.class ? ` (${character.class})` : '';
      const realmText = character.realm ? ` - ${character.realm}` : '';
      const mainTag = character.isMain ? ' 👑' : '';

      // Create updated interface with selected character
      const updatedInterface = await createCharacterInterface(userId, selectedCharacter);
      
      await interaction.update({
        content: `✅ Selected: **${character.name}**${classText}${realmText}${mainTag}\n\nUse the buttons below to manage this character.`,
        ...updatedInterface
      });
    }
  } catch (error) {
    console.error('Error handling select menu:', error);
    
    await interaction.reply({
      content: 'An error occurred while processing your selection.',
      flags: 1 << 6
    });
  }
}

// Handle button clicks
export async function handleButtonClick(interaction) {
  if (!interaction?.customId || !interaction?.user?.id) return;

  try {
    const parts = interaction.customId.split(':');
    const [action, userId] = parts;
    
    if (userId !== interaction.user.id) {
      return interaction.reply({
        content: 'This interface is not for you.',
        flags: 1 << 6
      });
    }

    switch (action) {
      case 'alt_add':
        const addModal = createAddCharacterModal(userId);
        await interaction.showModal(addModal);
        break;

      case 'alt_switch':
        const selectedForSwitch = userSelections.get(userId);
        if (!selectedForSwitch) {
          return interaction.reply({
            content: '❌ Please select a character from the dropdown first.',
            flags: 1 << 6
          });
        }

        // Switch active character (changes nickname only)
        const switched = await setMemberNickname(interaction.member, selectedForSwitch);
        const switchMessage = switched 
          ? `✅ Switched to **${selectedForSwitch}** for roleplay! 🎭\n*Your Discord nickname has been updated.*`
          : `✅ Switched to **${selectedForSwitch}** for roleplay! 🎭\n*Note: Couldn't update nickname (no permissions).*`;
        
        await interaction.reply({
          content: switchMessage,
          flags: 1 << 6
        });
        break;

      case 'alt_delete':
        const selectedForDelete = userSelections.get(userId);
        if (!selectedForDelete) {
          return interaction.reply({
            content: '❌ Please select a character from the dropdown first.',
            flags: 1 << 6
          });
        }

        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`alt_confirm_delete:${userId}:${selectedForDelete}`)
            .setLabel(`Yes, Delete ${selectedForDelete}`)
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️'),
          new ButtonBuilder()
            .setCustomId(`alt_cancel_delete:${userId}`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❌')
        );

        await interaction.reply({
          content: `⚠️ **Are you sure you want to delete ${selectedForDelete}?**\n\nThis action cannot be undone!`,
          components: [confirmRow],
          flags: 1 << 6
        });
        break;

      case 'alt_make_main':
        const characterName = parts[2];
        await CharacterDB.setMainCharacter(userId, characterName);
        await setMemberNickname(interaction.member, characterName);
        
        // Show updated interface after setting main
        const updatedMainInterface = await createCharacterInterface(userId, characterName);
        
        await interaction.update({
          content: `✅ **${characterName}** is now your main character! 👑`,
          ...updatedMainInterface
        });
        break;

      case 'alt_skip_main':
        // Get the most recently added character
        const characters = await CharacterDB.getCharacters(userId);
        const newestChar = characters[characters.length - 1];
        
        // Show updated interface
        const updatedInterface = await createCharacterInterface(userId, newestChar?.name);
        
        await interaction.update({
          content: '✅ Character added as an alt. You can change this later!',
          ...updatedInterface
        });
        break;

      case 'alt_confirm_delete':
        const charToDelete = parts[2];
        await CharacterDB.deleteCharacter(userId, charToDelete);
        
        // Clear selection if we just deleted the selected character
        if (userSelections.get(userId) === charToDelete) {
          userSelections.delete(userId);
        }
        
        // Show updated interface after deletion
        const updatedDeleteInterface = await createCharacterInterface(userId);
        
        await interaction.update({
          content: `✅ Successfully deleted **${charToDelete}**.`,
          ...updatedDeleteInterface
        });
        break;

      case 'alt_cancel_delete':
        // Get current selection
        const currentSelection = userSelections.get(userId);
        
        // Show updated interface
        const cancelInterface = await createCharacterInterface(userId, currentSelection);
        
        await interaction.update({
          content: '❌ Character deletion cancelled.',
          ...cancelInterface
        });
        break;
    }
  } catch (error) {
    console.error('Error handling button click:', error);
    
    const errorResponse = {
      content: 'An error occurred while processing your request.',
      flags: 1 << 6
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(errorResponse);
    } else {
      await interaction.reply(errorResponse);
    }
  }
}

// Handle modal submissions
export async function handleModalSubmit(interaction) {
  if (!interaction?.customId || !interaction?.user?.id) return;

  try {
    const parts = interaction.customId.split(':');
    const [modalType, userId] = parts;
    
    if (userId !== interaction.user.id) {
      return interaction.reply({
        content: 'This modal is not for you.',
        flags: 1 << 6
      });
    }

    if (modalType === 'alt_add_modal') {
      // Add character modal
      const characterName = interaction.fields.getTextInputValue('character_name')?.trim();
      const characterClass = interaction.fields.getTextInputValue('character_class')?.trim() || null;
      const realm = interaction.fields.getTextInputValue('character_realm')?.trim() || null;

      if (!characterName) {
        return interaction.reply({
          content: '❌ Character name is required.',
          flags: 1 << 6
        });
      }

      const nameError = validateCharacterName(characterName);
      if (nameError) {
        return interaction.reply({
          content: `❌ ${nameError}`,
          flags: 1 << 6
        });
      }

      const exists = await CharacterDB.characterExists(userId, characterName);
      if (exists) {
        return interaction.reply({
          content: `❌ Character **${characterName}** already exists.`,
          flags: 1 << 6
        });
      }

      // Add character (defaults to NOT main)
      await CharacterDB.addCharacter(userId, characterName, characterClass, realm, false);

      // Ask if they want to make it main
      const mainButton = createMakeMainButton(userId, characterName);
      const classText = characterClass ? ` (${characterClass})` : '';
      const realmText = realm ? ` on ${realm}` : '';

      await interaction.reply({
        content: `✅ Added **${characterName}**${classText}${realmText} to your roster!\n\nWould you like to make this your main character?`,
        components: [mainButton],
        flags: 1 << 6
      });
    }
  } catch (error) {
    console.error('Error handling modal submit:', error);
    
    await interaction.reply({
      content: 'An error occurred while processing your request.',
      flags: 1 << 6
    });
  }
}

// Legacy function for compatibility
export async function handleDeleteConfirmation(interaction) {
  return handleButtonClick(interaction);
}
