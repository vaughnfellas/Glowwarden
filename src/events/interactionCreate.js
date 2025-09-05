// src/events/interactionCreate.js
import { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import * as alt from '../commands/alt.js';
import { config } from '../config.js';
import { CHANNELS } from '../channels.js';
import { createOathSceneText, sendOathCompletionDM, getPublicWelcomeText, createOathAcceptButton, processOathCompletion } from '../services/oath-service.js';

export const name = 'interactionCreate';
export const once = false;

// Store temporary oath data while user enters character info
const oathData = new Map(); // userId -> { flavor, guildId, channelId }

export async function execute(interaction) {
  try {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      try {
        const command = interaction.client.commands.get(interaction.commandName);
        
        if (!command) {
          console.error(`No command matching ${interaction.commandName} was found.`);
          return;
        }
        
        console.log(`Executing command: ${interaction.commandName} by ${interaction.user.tag}`);
        await command.execute(interaction);
      } catch (commandError) {
        console.error(`Error executing command ${interaction.commandName}:`, commandError);
        
        const errorMessage = 'There was an error while executing this command!';
        try {
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
          } else {
            await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
          }
        } catch (replyError) {
          console.error('Failed to send command error message:', replyError);
        }
      }
    }
    
    // Handle autocomplete (for other commands that might need it)
    else if (interaction.isAutocomplete()) {
      try {
        const command = interaction.client.commands.get(interaction.commandName);
        
        if (!command?.autocomplete) {
          return;
        }
        
        await command.autocomplete(interaction);
      } catch (autocompleteError) {
        console.error(`Error in autocomplete for ${interaction.commandName}:`, autocompleteError);
        try {
          await interaction.respond([]);
        } catch (respondError) {
          console.error('Failed to send empty autocomplete response:', respondError);
        }
      }
    }
    
    // Handle button interactions
    else if (interaction.isButton()) {
      try {
        const customId = interaction.customId;
        
        // Alt command buttons
        if (customId.startsWith('alt_')) {
          // Handle delete confirmations
          if (customId.includes('confirm_delete') || customId.includes('cancel_delete')) {
            await alt.handleDeleteConfirmation(interaction);
          } 
          // Handle main action buttons
          else {
            await alt.handleButtonClick(interaction);
          }
        }
        // Flair selection buttons (from decree command)
        else if (customId.startsWith('flair:')) {
          await handleFlairSelection(interaction);
        }
        // Oath acceptance button
        else if (customId === 'accept_oath') {
          await handleOathAcceptance(interaction);
        }
        else {
          console.warn(`Unhandled button interaction: ${customId}`);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
              content: 'This button interaction is not currently supported.', 
              flags: MessageFlags.Ephemeral 
            });
          }
        }
      } catch (buttonError) {
        console.error(`Error handling button interaction ${interaction.customId}:`, buttonError);
        
        try {
          const errorMessage = 'There was an error processing this button interaction!';
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
          } else {
            await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
          }
        } catch (replyError) {
          console.error('Failed to send button error message:', replyError);
        }
      }
    }
    
    // Handle select menu interactions
    else if (interaction.isStringSelectMenu()) {
      try {
        const customId = interaction.customId;
        
        // Alt command select menus
        if (customId.startsWith('alt_')) {
          await alt.handleSelectMenu(interaction);
        }
        // Character role selection
        else if (customId === 'character_role_select') {
          await handleCharacterRoleSelect(interaction);
        }
        else {
          console.warn(`Unhandled select menu interaction: ${customId}`);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
              content: 'This select menu interaction is not currently supported.', 
              flags: MessageFlags.Ephemeral 
            });
          }
        }
      } catch (selectError) {
        console.error(`Error handling select menu interaction ${interaction.customId}:`, selectError);
        
        try {
          const errorMessage = 'There was an error processing this selection!';
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
          } else {
            await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
          }
        } catch (replyError) {
          console.error('Failed to send select error message:', replyError);
        }
      }
    }
    
    // Handle modal submissions
    else if (interaction.isModalSubmit()) {
      try {
        const customId = interaction.customId;
        
        // Handle oath character info modal
        if (customId === 'oath_character_modal') {
          await handleOathCharacterModal(interaction);
        }
        // Handle alt command modals
        else if (customId.startsWith('alt_')) {
          await alt.handleModalSubmit(interaction);
        }
        else {
          console.warn(`Unhandled modal submission: ${customId}`);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
              content: 'This modal submission is not currently supported.', 
              flags: MessageFlags.Ephemeral 
            });
          }
        }
      } catch (modalError) {
        console.error(`Error handling modal submission ${interaction.customId}:`, modalError);
        
        try {
          const errorMessage = 'There was an error processing this form submission!';
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
          } else {
            await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
          }
        } catch (replyError) {
          console.error('Failed to send modal error message:', replyError);
        }
      }
    }
  } catch (error) {
    console.error('Error in interactionCreate event:', error);
  }
}

// Helper function to handle flair selection
async function handleFlairSelection(interaction) {
  const flavor = interaction.customId.replace('flair:', '');
  
  // Store oath data temporarily
  oathData.set(interaction.user.id, {
    flavor: flavor,
    guildId: interaction.guild.id,
    channelId: interaction.channel.id
  });
  
  // Create modal for character information
  const modal = new ModalBuilder()
    .setCustomId('oath_character_modal')
    .setTitle('Character Information');
  
  const characterNameInput = new TextInputBuilder()
    .setCustomId('character_name')
    .setLabel('Character Name')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Enter your WoW character name')
    .setRequired(true)
    .setMinLength(2)
    .setMaxLength(32);
  
  const characterClassInput = new TextInputBuilder()
    .setCustomId('character_class')
    .setLabel('Character Class')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., Paladin, Mage, Hunter (or leave empty)')
    .setRequired(false)
    .setMaxLength(20);
  
  const characterRealmInput = new TextInputBuilder()
    .setCustomId('character_realm')
    .setLabel('Realm (Optional)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., Stormrage, Tichondrius')
    .setRequired(false)
    .setMaxLength(30);
  
  const nameRow = new ActionRowBuilder().addComponents(characterNameInput);
  const classRow = new ActionRowBuilder().addComponents(characterClassInput);
  const realmRow = new ActionRowBuilder().addComponents(characterRealmInput);
  
  modal.addComponents(nameRow, classRow, realmRow);
  
  await interaction.showModal(modal);
}

// Helper function to handle oath character modal submission
async function handleOathCharacterModal(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  try {
    const userId = interaction.user.id;
    const storedData = oathData.get(userId);
    
    if (!storedData) {
      await interaction.editReply({
        content: 'Session expired. Please start the oath process again.'
      });
      return;
    }
    
    const characterName = interaction.fields.getTextInputValue('character_name')?.trim();
    const characterClass = interaction.fields.getTextInputValue('character_class')?.trim() || null;
    const characterRealm = interaction.fields.getTextInputValue('character_realm')?.trim() || null;
    
    // Validate character name
    if (!characterName || characterName.length < 2) {
      await interaction.editReply({
        content: 'Please provide a valid character name (at least 2 characters).'
      });
      return;
    }
    
    // Show role selection menu
    const roleSelect = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('character_role_select')
        .setPlaceholder('Select your character\'s role (optional)')
        .addOptions([
          new StringSelectMenuOptionBuilder()
            .setLabel('Tank')
            .setValue('tank')
            .setDescription('Protector of the group')
            .setEmoji('🛡️'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Healer')
            .setValue('healer')
            .setDescription('Restorer of life')
            .setEmoji('💚'),
          new StringSelectMenuOptionBuilder()
            .setLabel('DPS')
            .setValue('dps')
            .setDescription('Dealer of damage')
            .setEmoji('⚔️'),
          new StringSelectMenuOptionBuilder()
            .setLabel('None/Skip')
            .setValue('none')
            .setDescription('Skip role selection')
            .setEmoji('⏭️')
        ])
    );
    
    // Update stored data with character info
    storedData.characterName = characterName;
    storedData.characterClass = characterClass;
    storedData.characterRealm = characterRealm;
    oathData.set(userId, storedData);
    
    await interaction.editReply({
      content: `Character information received! **${characterName}**${characterClass ? ` the ${characterClass}` : ''}${characterRealm ? ` of ${characterRealm}` : ''}\n\nPlease select your character's role:`,
      components: [roleSelect]
    });
  } catch (error) {
    console.error('Error in handleOathCharacterModal:', error);
    await interaction.editReply({
      content: 'There was an error processing your character information. Please try again.'
    });
  }
}

// Helper function to handle character role selection
async function handleCharacterRoleSelect(interaction) {
  await interaction.deferUpdate();
  
  try {
    const userId = interaction.user.id;
    const storedData = oathData.get(userId);
    
    if (!storedData) {
      await interaction.editReply({
        content: 'Session expired. Please start the oath process again.',
        components: []
      });
      return;
    }
    
    const selectedRole = interaction.values[0] === 'none' ? null : interaction.values[0];
    storedData.characterRole = selectedRole;
    
    // Create the oath scene text
    const oathText = createOathSceneText(
      interaction.user, 
      storedData.flavor, 
      storedData.characterName, 
      storedData.characterClass
    );
    
    // Create accept button
    const acceptButton = createOathAcceptButton();
    
    // Send to the channel
    const channel = interaction.channel;
    if (channel) {
      await channel.send({
        content: oathText,
        components: [acceptButton]
      });
    }
    
    await interaction.editReply({
      content: 'Your character information has been recorded. Please accept your oath in the channel.',
      components: []
    });
  } catch (error) {
    console.error('Error in handleCharacterRoleSelect:', error);
    await interaction.editReply({
      content: 'There was an error processing your role selection. Please try again.',
      components: []
    });
  }
}

// Helper function to handle oath acceptance
async function handleOathAcceptance(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  try {
    const userId = interaction.user.id;
    const storedData = oathData.get(userId);
    
    if (!storedData) {
      await interaction.editReply({
        content: 'Session expired. Please start the oath process again.'
      });
      return;
    }
    
    // Process oath completion
    const result = await processOathCompletion(
      interaction.member,
      storedData.flavor,
      storedData.characterName,
      storedData.characterClass,
      storedData.characterRealm,
      storedData.characterRole
    );
    
    if (!result.success) {
      await interaction.editReply({
        content: `Failed to complete oath: ${result.error || 'Unknown error'}`
      });
      return;
    }
    
    // Send public welcome message
    const welcomeText = getPublicWelcomeText(
      interaction.user,
      storedData.characterName,
      storedData.characterClass,
      storedData.flavor
    );
    
    await interaction.channel.send(welcomeText);
    
    // Clean up stored data
    oathData.delete(userId);
    
    await interaction.editReply({
      content: 'Your oath has been completed successfully! Welcome to the Empire. Check your DMs for more information.'
    });
    
  } catch (error) {
    console.error('Error in handleOathAcceptance:', error);
    await interaction.editReply({
      content: 'There was an error processing your oath acceptance. Please try again or contact an administrator.'
    });
  }
}
