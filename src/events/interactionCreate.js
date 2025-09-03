// src/events/interactionCreate.js
import { Events } from 'discord.js';
import { createCharacterNameModal, handleCharacterNameSubmit, grantAccessToMember } from '../services/temp-vc-service.js';

export const name = Events.InteractionCreate;
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
      
      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`Error executing ${interaction.commandName}`);
        console.error(error);
        
        const replyOptions = {
          content: 'There was an error executing this command!',
          ephemeral: true
        };
        
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(replyOptions);
        } else {
          await interaction.reply(replyOptions);
        }
      }
    }
    // Handle autocomplete
    else if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);
      
      if (!command || !command.autocomplete) {
        console.error(`No autocomplete handler for ${interaction.commandName}`);
        return;
      }
      
      try {
        await command.autocomplete(interaction);
      } catch (error) {
        console.error(`Error handling autocomplete for ${interaction.commandName}`);
        console.error(error);
      }
    }
    // Handle buttons
    else if (interaction.isButton()) {
      // Handle "Set WoW Character Name" button
      if (interaction.customId === 'setname') {
        const modal = createCharacterNameModal();
        await interaction.showModal(modal);
      }
      // Handle "Get Access" button
      else if (interaction.customId.startsWith('access_')) {
        const channelId = interaction.customId.split('_')[1];
        const result = await grantAccessToMember(interaction.member, channelId);
        
        await interaction.reply({
          content: result.message,
          ephemeral: true
        });
      }
    }
    // Handle modal submissions
    else if (interaction.isModalSubmit()) {
      if (interaction.customId === 'character_name_modal') {
        await handleCharacterNameSubmit(interaction);
      }
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
  }
}
