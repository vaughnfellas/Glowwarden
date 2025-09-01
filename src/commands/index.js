// ============= src/commands/index.js =============
import * as straysCommand from './strays.js';
import * as vcCommand from './vc.js';
import * as decreeCommand from './decree.js';
import * as idsCommand from './ids.js';
import * as permsCommand from './perms.js';
import * as visitorDecreeCommand from '../services/visitor-decree-service.js'; // Add this import
import { Events, MessageFlags } from 'discord.js';

const commands = new Map([
  [straysCommand.data.name, straysCommand],
  [vcCommand.data.name, vcCommand],
  [decreeCommand.data.name, decreeCommand],
  [idsCommand.data.name, idsCommand],
  [permsCommand.data.name, permsCommand],
  [visitorDecreeCommand.data.name, visitorDecreeCommand], // Add this line
]);

export function loadCommands(client) {
  client.on(Events.InteractionCreate, async (interaction) => {
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
