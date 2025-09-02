// ============= src/commands/ping.js =============
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Check bot latency');

export async function execute(interaction) {
  const sent = await interaction.reply({ content: 'Pinging...', ephemeral: true, fetchReply: true });
  const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
  const wsLatency = interaction.client.ws.ping;
  
  await interaction.editReply({ 
    content: `🏓 **Pong!**\nRoundtrip: ${roundtrip}ms\nWebSocket: ${wsLatency}ms` 
  });
}