// src/commands/status.js
import { SlashCommandBuilder } from 'discord.js';
import { supabase } from '../db.js'; // Import supabase instead of pool
import { config } from '../config.js';

export const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription('Check bot and database status');

export async function execute(interaction) {
  try {
    const startTime = Date.now();
    
    // Test database connection with a simple query
    const { data: testData, error } = await supabase
      .from('characters')
      .select('count', { count: 'exact', head: true });
    
    const dbLatency = Date.now() - startTime;
    
    if (error) {
      console.error('Database test failed:', error);
      return interaction.reply({
        content: `⚠️ **Status Check**\n\n` +
                `Bot: ✅ Online\n` +
                `Database: ❌ Connection failed\n` +
                `Error: ${error.message}\n` +
                `Latency: ${interaction.client.ws.ping}ms`,
        flags: MessageFlags.Ephemeral
      });
    }
    
    // Get character count for additional info
    const { count: characterCount } = testData || { count: 0 };
    
    const statusEmbed = {
      title: '🤖 Bot Status',
      color: 0x00ff00, // Green
      fields: [
        {
          name: '🟢 Bot Status',
          value: 'Online and operational',
          inline: true
        },
        {
          name: '🗄️ Database Status', 
          value: `Connected to Supabase\nLatency: ${dbLatency}ms`,
          inline: true
        },
        {
          name: '📊 Stats',
          value: `Characters: ${characterCount}\nPing: ${interaction.client.ws.ping}ms`,
          inline: true
        },
        {
          name: '🔧 Environment',
          value: config.NODE_ENV || 'unknown',
          inline: true
        },
        {
          name: '⏰ Uptime',
          value: formatUptime(process.uptime()),
          inline: true
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Holy Gehy Empire Bot'
      }
    };
    
    await interaction.reply({ 
      embeds: [statusEmbed],
      flags: MessageFlags.Ephemeral 
    });
    
  } catch (error) {
    console.error('Status command failed:', error);
    await interaction.reply({
      content: `❌ **Status Check Failed**\n\nError: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
  }
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}