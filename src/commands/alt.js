// commands/alt.js - Unified character management interface
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
  { name: 'Druid', value: 'Druid', emoji: '🻾' },
  { name: 'Hunter', value: 'Hunter', emoji: '🹹' },
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
  .setDescription('Manage your character roster');

// Utility function to validate character name
function validateCharacterName(name) {
  if (!name || typeof name !== 'string') {
    return 'Character name is required';
  }
  
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 32) {
    return 'Character name must be between 2 and 32 characters';
  }
  
  if (!/^[a-zA-Z0-9àáâãäåæçèéêëìíîïñòóôõöùúûüýÿ'-]+$/.test(trimmed)) {
    return 'Character name contains invalid characters';
  }
  
  return null;
}

// Create the main character management interface
async function createCharacterInterface(userId) {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const characters = await CharacterDB.getCharacters(userId);
    
    const embed = new EmbedBuilder()
      .setTitle('🎭 Character Management')
      .setColor(0x8B4513)
      .setDescription(characters.length === 0 
        ? 'You have no characters registered. Click "Add Character" to get started!'
        : `You have ${characters.length} character(s) registered.`
      )
      .setTimestamp();

    // Add character fields
    if (characters.length > 0) {
      for (const char of characters) {
        const mainTag = char.isMain ? '👑 **MAIN**' : '';
        const classText = char.class ? `**Class:** ${char.class}` : '';
        const realmText = char.realm ? `**Realm:** ${char.realm}` : '';
        const createdText = `**Added:** <t:${Math.floor(new Date(char.createdAt).getTime() / 1000)}:R>`;
        
        const details = [mainTag, classText, realmText, createdText].filter(Boolean).join('\n');
        
        embed.addFields({
          name: char.name,
          value: details,
          inline: true
        });
      }
    }

    // Create action buttons
    const buttons = new ActionRowBuilder();
    
    // Add Character button (always available)
    buttons.addComponents(
      new ButtonBuilder()
        .setCustomId(`alt_add:${userId}`)
        .setLabel('Add Character')
        .setStyle(ButtonStyle.Success)
        .setEmoji('➕')
    );

    // Only show other buttons if characters exist
    if (characters.length > 0) {
      buttons.addComponents(
        new ButtonBuilder()
          .setCustomId(`alt_switch:${userId}`)
          .setLabel('Switch Main')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔄'),
        new ButtonBuilder()
          .setCustomId(`alt_edit:${userId}`)
          .setLabel('Edit Character')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('✏️'),
        new ButtonBuilder()
          .setCustomId(`alt_delete:${userId}`)
          .setLabel('Delete Character')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️')
      );
    }

    return { embeds: [embed], components: [buttons] };
  } catch (error) {
    console.error('Error creating character interface:', error);
    throw error;
  }
}

// Create character selection dropdown
async function createCharacterSelectionMenu(userId, action) {
  if (!userId || !action) {
    throw new Error('userId and action are required');
  }

  try {
    const characters = await CharacterDB.getCharacters(userId);
    
    if (characters.length === 0) {
      return null;
    }

    const options = characters.slice(0, 25).map(char =>
      new StringSelectMenuOptionBuilder()
        .setLabel(`${char.name}${char.isMain ? ' [MAIN]' : ''}`)
        .setValue(char.name)
        .setDescription(`${char.class || 'No class'}${char.realm ? ` • ${char.realm}` : ''}`)
    );

    const select = new StringSelectMenuBuilder()
      .setCustomId(`alt_${action}_select:${userId}`)
      .setPlaceholder(`Select character to ${action}`)
      .addOptions(options);

    return new ActionRowBuilder().addComponents(select);
  } catch (error) {
    console.error(`Error creating ${action} selection menu:`, error);
    return null;
  }
}

// Create class selection dropdown
function createClassSelectionMenu(userId, characterName = '') {
  if (!userId) {
    throw new Error('userId is required');
  }

  const options = CLASS_OPTIONS.map(classOption => 
    new StringSelectMenuOptionBuilder()
      .setLabel(classOption.name)
      .setValue(classOption.value)
      .setEmoji(classOption.emoji)
  );

  const select = new StringSelectMenuBuilder()
    .setCustomId(`alt_class_select:${userId}:${characterName}`)
    .setPlaceholder('Select character class')
    .addOptions(options);

  return new ActionRowBuilder().addComponents(select);
}

// Create add character modal
function createAddCharacterModal(selectedClass, userId) {
  if (!selectedClass || !userId) {
    throw new Error('selectedClass and userId are required');
  }

  const modal = new ModalBuilder()
    .setCustomId(`alt_add_modal:${userId}:${selectedClass}`)
    .setTitle('Add New Character');

  const characterInput = new TextInputBuilder()
    .setCustomId('character_name')
    .setLabel('Character Name')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Enter your character name (2-32 characters)')
    .setRequired(true)
    .setMinLength(2)
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

  modal.addComponents(
    new ActionRowBuilder().addComponents(characterInput),
    new ActionRowBuilder().addComponents(realmInput),
    new ActionRowBuilder().addComponents(isMainInput)
  );

  return modal;
}

// Create edit character modal
function createEditCharacterModal(character, userId) {
  if (!character || !userId) {
    throw new Error('character and userId are required');
  }

  const modal = new ModalBuilder()
    .setCustomId(`alt_edit_modal:${userId}:${character.name}`)
    .setTitle(`Edit ${character.name}`);

  const classInput = new TextInputBuilder()
    .setCustomId('character_class')
    .setLabel('Character Class')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Enter class name or leave empty')
    .setRequired(false)
    .setValue(character.class || '')
    .setMaxLength(20);

  const realmInput = new TextInputBuilder()
    .setCustomId('character_realm')
    .setLabel('Realm')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Enter realm name or leave empty')
    .setRequired(false)
    .setValue(character.realm || '')
    .setMaxLength(30);

  const isMainInput = new TextInputBuilder()
    .setCustomId('is_main')
    .setLabel('Set as Main Character? (yes/no)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('yes or no')
    .setRequired(true)
    .setValue(character.isMain ? 'yes' : 'no')
    .setMaxLength(3);

  modal.addComponents(
    new ActionRowBuilder().addComponents(classInput),
    new ActionRowBuilder().addComponents(realmInput),
    new ActionRowBuilder().addComponents(isMainInput)
  );

  return modal;
}

// Safely set nickname with proper error handling
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
      flags: 1 << 6 // Ephemeral flag (64)
    });
  } catch (error) {
    console.error('Error in alt command execute:', error);
    
    const errorResponse = {
      content: 'An error occurred while loading your character management interface.',
      flags: 1 << 6 // Ephemeral flag
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(errorResponse);
    } else {
      await interaction.reply(errorResponse);
    }
  }
}

// Handle button clicks
export async function handleButtonClick(interaction) {
  if (!interaction?.customId || !interaction?.user?.id) {
    console.error('Invalid interaction in handleButtonClick');
    return;
  }

  try {
    const parts = interaction.customId.split(':');
    if (parts.length < 2) {
      return interaction.reply({
        content: 'Invalid button interaction.',
        flags: 1 << 6 // Ephemeral flag
      });
    }
    
    const [action, userId] = parts;
    
    if (userId !== interaction.user.id) {
      return interaction.reply({
        content: 'This interface is not for you.',
        flags: 1 << 6 // Ephemeral flag
      });
    }

    switch (action) {
      case 'alt_add':
        const classRow = createClassSelectionMenu(userId);
        await interaction.reply({
          content: '🎭 **Add Character**\nSelect your character\'s class:',
          components: [classRow],
          flags: 1 << 6 // Ephemeral flag
        });
        break;

      case 'alt_switch':
        const switchRow = await createCharacterSelectionMenu(userId, 'switch');
        if (!switchRow) {
          return interaction.reply({
            content: 'You have no characters to switch to.',
            flags: 1 << 6 // Ephemeral flag
          });
        }
        await interaction.reply({
          content: '🔄 **Switch Main Character**\nSelect which character to make your main:',
          components: [switchRow],
          flags: 1 << 6 // Ephemeral flag
        });
        break;

      case 'alt_edit':
        const editRow = await createCharacterSelectionMenu(userId, 'edit');
        if (!editRow) {
          return interaction.reply({
            content: 'You have no characters to edit.',
            flags: 1 << 6 // Ephemeral flag
          });
        }
        await interaction.reply({
          content: '✏️ **Edit Character**\nSelect which character to edit:',
          components: [editRow],
          flags: 1 << 6 // Ephemeral flag
        });
        break;

      case 'alt_delete':
        const deleteRow = await createCharacterSelectionMenu(userId, 'delete');
        if (!deleteRow) {
          return interaction.reply({
            content: 'You have no characters to delete.',
            flags: 1 << 6 // Ephemeral flag
          });
        }
        await interaction.reply({
          content: '🗑️ **Delete Character**\nSelect which character to delete:',
          components: [deleteRow],
          flags: 1 << 6 // Ephemeral flag
        });
        break;

      default:
        await interaction.reply({
          content: 'Unknown button action.',
          flags: 1 << 6 // Ephemeral flag
        });
    }
  } catch (error) {
    console.error('Error handling button click:', error);
    
    const errorResponse = {
      content: 'An error occurred while processing your request.',
      flags: 1 << 6 // Ephemeral flag
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(errorResponse);
    } else {
      await interaction.reply(errorResponse);
    }
  }
}

// Handle select menu interactions
export async function handleSelectMenu(interaction) {
  if (!interaction?.customId || !interaction?.user?.id) {
    console.error('Invalid interaction in handleSelectMenu');
    return;
  }

  try {
    console.log('Select menu interaction:', interaction.customId);
    
    const customIdParts = interaction.customId.split(':');
    if (customIdParts.length < 2) {
      return interaction.reply({
        content: 'Invalid select menu format.',
        flags: 1 << 6 // Ephemeral flag
      });
    }

    const menuType = customIdParts[0];
    const userId = customIdParts[1];
    
    // Extract the action from the menu type
    let action;
    if (menuType === 'alt_class_select') {
      action = 'class';
    } else if (menuType === 'alt_switch_select') {
      action = 'switch';
    } else if (menuType === 'alt_edit_select') {
      action = 'edit';
    } else if (menuType === 'alt_delete_select') {
      action = 'delete';
    } else {
      return interaction.reply({
        content: 'Unknown select menu type.',
        flags: 1 << 6 // Ephemeral flag
      });
    }
    
    console.log(`Menu type: ${menuType}, action: ${action}, userId: ${userId}`);
    
    if (userId !== interaction.user.id) {
      console.log(`User ID mismatch: ${userId} vs ${interaction.user.id}`);
      return interaction.reply({
        content: 'This selection menu is not for you.',
        flags: 1 << 6 // Ephemeral flag
      });
    }

    if (!interaction.values || interaction.values.length === 0) {
      return interaction.reply({
        content: 'No selection was made.',
        flags: 1 << 6 // Ephemeral flag
      });
    }

    switch (action) {
      case 'class':
        const selectedClass = interaction.values[0];
        const modal = createAddCharacterModal(selectedClass, userId);
        await interaction.showModal(modal);
        break;

      case 'switch':
        const characterToSwitch = interaction.values[0];
        await CharacterDB.setMainCharacter(userId, characterToSwitch);
        
        // Try to update nickname
        await setMemberNickname(interaction.member, characterToSwitch);
        
        await interaction.update({
          content: `✅ Switched to **${characterToSwitch}** as your main character!`,
          components: []
        });
        break;

      case 'edit':
        const characterToEdit = await CharacterDB.getCharacter(userId, interaction.values[0]);
        if (!characterToEdit) {
          return interaction.update({
            content: 'Character not found.',
            components: []
          });
        }
        
        const editModal = createEditCharacterModal(characterToEdit, userId);
        await interaction.showModal(editModal);
        break;

      case 'delete':
        const characterToDelete = interaction.values[0];
        
        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`alt_confirm_delete:${userId}:${characterToDelete}`)
            .setLabel('Delete Character')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`alt_cancel_delete:${userId}`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
        );
        
        await interaction.update({
          content: `⚠️ Are you sure you want to delete **${characterToDelete}**? This cannot be undone.`,
          components: [confirmRow]
        });
        break;
    }
  } catch (error) {
    console.error('Error handling select menu:', error);
    
    const errorResponse = {
      content: 'An error occurred while processing your selection.',
      flags: 1 << 6 // Ephemeral flag
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
  if (!interaction?.customId || !interaction?.user?.id || !interaction?.fields) {
    console.error('Invalid interaction in handleModalSubmit');
    return;
  }

  try {
    const parts = interaction.customId.split(':');
    if (parts.length < 4) {
      return interaction.reply({
        content: 'Invalid modal format.',
        flags: 1 << 6 // Ephemeral flag
      });
    }

    const [, action, userId, extra] = parts;
    
    if (userId !== interaction.user.id) {
      return interaction.reply({
        content: 'This modal is not for you.',
        flags: 1 << 6 // Ephemeral flag
      });
    }

    if (action === 'add') {
      const selectedClass = extra;
      const characterName = interaction.fields.getTextInputValue('character_name')?.trim();
      const realm = interaction.fields.getTextInputValue('character_realm')?.trim() || null;
      const isMainInput = interaction.fields.getTextInputValue('is_main')?.trim()?.toLowerCase();
      
      if (!characterName) {
        return interaction.reply({
          content: '❌ Character name is required.',
          flags: 1 << 6 // Ephemeral flag
        });
      }

      const nameError = validateCharacterName(characterName);
      if (nameError) {
        return interaction.reply({
          content: `❌ ${nameError}`,
          flags: 1 << 6 // Ephemeral flag
        });
      }
      
      const exists = await CharacterDB.characterExists(userId, characterName);
      if (exists) {
        return interaction.reply({
          content: `❌ Character **${characterName}** already exists in your roster.`,
          flags: 1 << 6 // Ephemeral flag
        });
      }
      
      const isMain = ['yes', 'y', '1', 'true'].includes(isMainInput || '');
      const charClass = selectedClass === 'none' ? null : selectedClass;
      
      await CharacterDB.addCharacter(userId, characterName, charClass, realm, isMain);
      
      if (isMain) {
        await setMemberNickname(interaction.member, characterName);
      }
      
      const mainText = isMain ? ' as your **main character**' : '';
      const classText = charClass ? ` (${charClass})` : '';
      const realmText = realm ? ` on ${realm}` : '';
      
      await interaction.reply({
        content: `✅ Added **${characterName}**${classText}${realmText}${mainText} to your roster!`,
        flags: 1 << 6 // Ephemeral flag
      });

    } else if (action === 'edit') {
      const characterName = extra;
      const newClass = interaction.fields.getTextInputValue('character_class')?.trim() || null;
      const newRealm = interaction.fields.getTextInputValue('character_realm')?.trim() || null;
      const isMainInput = interaction.fields.getTextInputValue('is_main')?.trim()?.toLowerCase();
      
      const isMain = ['yes', 'y', '1', 'true'].includes(isMainInput || '');
      
      // Update character
      await CharacterDB.addCharacter(userId, characterName, newClass, newRealm, isMain);
      
      if (isMain) {
        await setMemberNickname(interaction.member, characterName);
      }
      
      await interaction.reply({
        content: `✅ Updated **${characterName}** successfully!`,
        flags: 1 << 6 // Ephemeral flag
      });
    }
  } catch (error) {
    console.error('Error handling modal submit:', error);
    
    const errorResponse = {
      content: 'An error occurred while saving your character.',
      flags: 1 << 6 // Ephemeral flag
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(errorResponse);
    } else {
      await interaction.reply(errorResponse);
    }
  }
}

// Handle delete confirmation
export async function handleDeleteConfirmation(interaction) {
  if (!interaction?.customId || !interaction?.user?.id) {
    console.error('Invalid interaction in handleDeleteConfirmation');
    return;
  }

  try {
    const parts = interaction.customId.split(':');
    if (parts.length < 3) {
      return interaction.reply({
        content: 'Invalid delete confirmation format.',
        flags: 1 << 6 // Ephemeral flag
      });
    }

    const action = parts[1];            // 'confirm_delete' or 'cancel_delete'
    const userId = parts[2];
    const characterName = parts[3];     // only present when action === 'confirm_delete'

    if (userId !== interaction.user.id) {
      return interaction.reply({
        content: 'This button is not for you.',
        flags: 1 << 6 // Ephemeral flag
      });
    }

    if (action === 'confirm_delete') {
      if (!characterName) {
        return interaction.update({
          content: 'Invalid character name for deletion.',
          components: []
        });
      }

      await CharacterDB.deleteCharacter(userId, characterName);
      await interaction.update({
        content: `✅ Successfully deleted **${characterName}** from your roster.`,
        components: []
      });
    } else if (action === 'cancel_delete') {
      // Close the confirmation dialog
      await interaction.update({
        content: '❌ Character deletion cancelled.',
        components: []
      });
    } else {
      await interaction.update({
        content: 'Unknown delete action.',
        components: []
      });
    }
  } catch (error) {
    console.error('Error handling delete confirmation:', error);
    
    const errorResponse = {
      content: 'An error occurred while processing the deletion.',
      components: []
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(errorResponse);
    } else {
      await interaction.update(errorResponse);
    }
  }
}