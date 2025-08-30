import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { data as decreeData } from './commands/decree.js';

const straysCmd = new SlashCommandBuilder()
  .setName('strays')
  .setDescription('Conjure guest passes to #spore-box (24h)')
  .addIntegerOption(opt =>
    opt.setName('count')
      .setDescription('Number of guest passes (default 4, max 10)')
      .setMinValue(1)
      .setMaxValue(10)
  );

const vcCmd = new SlashCommandBuilder()
  .setName('vc')
  .setDescription('Move yourself to your host’s War Chamber')
  .addStringOption(o =>
    o.setName('host')
      .setDescription('Pick your host (current War Chamber owner)')
      .setAutocomplete(true)
      .setRequired(true)
  );

const commands = [straysCmd, vcCmd, decreeData].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  );
  console.log('Slash command deployed to guild.');
})();
