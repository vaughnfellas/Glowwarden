// src/events/interactionCreate.js
import * as alt from '../commands/alt.js';

export const name = 'interactionCreate';
export const once = false;

export async function execute(interaction) {
  try {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      
      if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
      }
      
      console.log(`Executing command: ${interaction.commandName} by ${interaction.user.tag}`);
      await command.execute(interaction);
    }
    
    // Handle autocomplete (for other commands that might need it)
    else if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);
      
      if (!command?.autocomplete) {
        return;
      }
      
      await command.autocomplete(interaction);
    }
    
    // Handle button interactions
    else if (interaction.isButton()) {
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
      
      else {
        console.warn(`Unhandled button interaction: ${customId}`);
      }
    }
    
    // Handle select menu interactions
    else if (interaction.isStringSelectMenu()) {
      const customId = interaction.customId;
      
      // Alt command select menus
      if (customId.startsWith('alt_')) {
        await alt.handleSelectMenu(interaction);
      }
      
      else {
        console.warn(`Unhandled select menu interaction: ${customId}`);
      }
    }
    
    // Handle modal submissions
    else if (interaction.isModalSubmit()) {
      const customId = interaction.customId;
      
      // Alt command modals
      if (customId.startsWith('alt_')) {
        await alt.handleModalSubmit(interaction);
      }
      
      else {
        console.warn(`Unhandled modal submission: ${customId}`);
      }
    }
    
  } catch (error) {
    console.error('Error in interactionCreate:', error);
    
    // Try to respond with an error message if we haven't responded yet
    try {
      const errorMessage = 'There was an error while executing this command!';
      
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    } catch (followUpError) {
      console.error('Failed to send error message to user:', followUpError);
    }
  }
}