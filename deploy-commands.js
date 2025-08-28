import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const cmd = new SlashCommandBuilder()
  .setName('strays')
  .setDescription('Create a limited Stray Spore invite to the Spore Box')
  .addIntegerOption(opt =>
    opt.setName('count')
      .setDescription('Uses (default 4, max 10)')
      .setMinValue(1)
      .setMaxValue(parseInt(process.env.MAX_USES || '10', 10))
  );

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

try {
  const app = await rest.get(Routes.oauth2CurrentApplication());
  await rest.put(
    Routes.applicationGuildCommands(app.id, process.env.GUILD_ID),
    { body: [cmd.toJSON()] }
  );
  console.log('✅ Slash command deployed to guild.');
} catch (err) {
  console.error('Deploy error:', err);
}
