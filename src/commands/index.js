// ============= src/commands/index.js =============
import * as straysCommand from './strays.js';
import * as vcCommand from './vc.js';

const commands = new Map([
  [straysCommand.data.name, straysCommand],
  [vcCommand.data.name, vcCommand],
]);

export function loadCommands(client) {
  client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (command) {
        await command.execute(interaction);
      }
    } else if (interaction.isAutocomplete()) {
      const command = commands.get(interaction.commandName);
      if (command?.autocomplete) {
        await command.autocomplete(interaction);
      }
    }
  });

  console.log(`Loaded ${commands.size} commands`);
}
