// ============= src/commands/index.js =============
import * as straysCommand from './strays.js';
import * as vcCommand from './vc.js';
import * as decreeCommand from './decree.js';
import * as idsCommand from './ids.js';
import * as permsCommand from './perms.js';
import * as visitorDecreeCommand from '../services/visitor-decree-service.js';
import * as addaltCommand from './addalt.js'; // Import the addalt command
import { Events, MessageFlags } from 'discord.js';

const commands = new Map([
  [straysCommand.data.name, straysCommand],
  [vcCommand.data.name, vcCommand],
  [decreeCommand.data.name, decreeCommand],
  [idsCommand.data.name, idsCommand],
  [permsCommand.data.name, permsCommand],
  [visitorDecreeCommand.data.name, visitorDecreeCommand],
  [addaltCommand.data.name, addaltCommand],              // Add addalt command
  [addaltCommand.switchData.name, {                      // Add switch command
    execute: addaltCommand.executeSwitch,
    autocomplete: addaltCommand.autocompleteSwitchCharacters
  }],
]);

export function loadCommands(client) {
  client.on(Events.InteractionCreate, async (interaction) => {
    // Handle select menu interactions for addalt
    if (interaction.isStringSelectMenu() && 
        interaction.customId.startsWith('addalt_class:')) {
      try {
        const userId = interaction.customId.split(':')[1];
        if (userId === interaction.user.id) {
          const selectedClass = interaction.values[0];
          const modal = addaltCommand.createAddAltModal(selectedClass, userId);
          await interaction.showModal(modal);
        }
      } catch (err) {
        console.error('Error handling class selection:', err);
      }
      return;
    }
    
    // Handle modal submissions for addalt
    if (interaction.isModalSubmit() && 
        interaction.customId.startsWith('addalt_modal:')) {
      try {
        const [, userId, selectedClass] = interaction.customId.split(':');
        if (userId === interaction.user.id) {
          const name = interaction.fields.getTextInputValue('character_name');
          const realm = interaction.fields.getTextInputValue('character_realm');
          const isMainText = interaction.fields.getTextInputValue('is_main');
          const isMain = isMainText.toLowerCase() === 'yes';
          
          // Get user's characters or initialize empty array
          const userChars = addaltCommand.userCharacters.get(userId) || [];
          
          // If this is set as main, unset any existing mains
          if (isMain) {
            userChars.forEach(char => char.isMain = false);
          }
          
          // Add the new character
          userChars.push({
            name,
            class: selectedClass === 'none' ? null : selectedClass,
            realm: realm || null,
            isMain
          });
          
          // Save back to the map
          addaltCommand.userCharacters.set(userId, userChars);
          
          // Respond to the user
          const classText = selectedClass !== 'none' ? ` ${selectedClass}` : '';
          const realmText = realm ? ` of ${realm}` : '';
          const mainText = isMain ? ' as your **main character**' : ' as an alt';
          
          await interaction.reply({
            content: `✅ **${name}**${classText}${realmText} has been added to your roster${mainText}!\n\nUse \`/switch\` to change to this character.`,
            flags: MessageFlags.Ephemeral
          });
        }
      } catch (err) {
        console.error('Error handling character registration:', err);
        await interaction.reply({
          content: '⚠️ Something went wrong while registering your character.',
          flags: MessageFlags.Ephemeral
        });
      }
      return;
    }

    // Handle regular commands
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (command) {
        try {
          await command.execute(interaction);
        } catch (err) {
          console.error(`Error executing /${interaction.commandName}:`, err);
          if (!interaction.replied) {
            await interaction.reply({ 
              content: '⚠️ Something went wrong.', 
              flags: MessageFlags.Ephemeral 
            }).catch(() => {});
          }
        }
      }
    } else if (interaction.isAutocomplete()) {
      const command = commands.get(interaction.commandName);
      if (command?.autocomplete) {
        try {
          await command.autocomplete(interaction);
        } catch (err) {
          console.error(`Error in autocomplete for /${interaction.commandName}:`, err);
        }
      }
    }
  });

  console.log(`Loaded ${commands.size} commands`);
}
