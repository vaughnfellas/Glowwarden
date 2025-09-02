// ============= src/commands/ping.js =============
export const pingData = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Check bot latency');

export async function executePing(interaction) {
  const sent = await interaction.reply({ content: 'Pinging...', ephemeral: true, fetchReply: true });
  const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
  const wsLatency = interaction.client.ws.ping;
  
  await interaction.editReply({ 
    content: `🏓 **Pong!**\nRoundtrip: ${roundtrip}ms\nWebSocket: ${wsLatency}ms` 
  });
}