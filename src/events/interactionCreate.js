// src/events/interactionCreate.js
import { MessageFlags } from 'discord.js';
import * as alt from '../commands/alt.js';

export const name = 'interactionCreate';
export const once = false;

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
        
        // Alt command modals
        if (customId.startsWith('alt_')) {
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
    console.error('Critical error in interactionCreate:', error);
    
    // Last resort error handling
    try {
      const errorMessage = 'A critical error occurred while processing your interaction!';
      
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
      }
    } catch (criticalError) {
      console.error('Failed to send critical error message:', criticalError);
    }
  }
}