// events/ready.js - Bot ready event handler
import { Events, ActivityType, REST, Routes } from 'discord.js';
import { config } from '../config.js';

// Import command data for deployment
import { data as decreeData } from '../decree.js';
import { data as addaltData, switchData, rosterData, deleteAltData } from '../commands/addalt.js';
import { data as vcStatusData } from '../commands/vc-status.js';

export const name = Events.ClientReady;
export const once = true;

export async function execute(client) {
  console.log(`Ready! Logged in as ${client.user.tag}`);
  
  // Set bot activity
  client.user.setPresence({
    activities: [{ name: 'the Holy Gehy Empire', type: ActivityType.Watching }],
    status: 'online',
  });

  // Register slash commands
  try {
    console.log('Started refreshing application (/) commands.');
    
    const commands = [
      decreeData.toJSON(),
      addaltData.toJSON(),
      switchData.toJSON(),
      rosterData.toJSON(),
      deleteAltData.toJSON(),
      vcStatusData.toJSON(),
    ];
    
    const rest = new REST().setToken(config.DISCORD_TOKEN);
    
    await rest.put(
      Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID),
      { body: commands },
    );
    
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error refreshing application commands:', error);
  }
}