// ============= src/commands/status.js =============
import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { config } from '../config.js';
import { pool } from '../db.js';
import { isOwner } from '../utils/owner.js';

export const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription('Show bot status and health information')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const client = interaction.client;
    const guild = interaction.guild;
    
    // Basic bot info
    const uptime = Math.floor(client.uptime / 1000);
    const uptimeStr = `<t:${Math.floor(Date.now() / 1000) - uptime}:R>`;
    
    // Guild info
    const memberCount = guild.memberCount;
    const channelCount = guild.channels.cache.size;
    const roleCount = guild.roles.cache.size;
    
    // Database health check
    let dbStatus = '❌ Connection Failed';
    let dbResponseTime = 'N/A';
    try {
      const start = Date.now();
      await pool.query('SELECT 1');
      dbResponseTime = `${Date.now() - start}ms`;
      dbStatus = '✅ Connected';
    } catch (error) {
      console.error('Database health check failed:', error);
    }

    // Memory usage
    const memUsage = process.memoryUsage();
    const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    
    // Commands count
    const commandCount = client.commands ? client.commands.size : 0;

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('🤖 Glowwarden Status')
      .addFields(
        { name: '⏰ Uptime', value: uptimeStr, inline: true },
        { name: '🧠 Memory', value: `${memMB}MB`, inline: true },
        { name: '⚡ Ping', value: `${client.ws.ping}ms`, inline: true },
        { name: '🏰 Guild Info', value: `${memberCount} members\n${channelCount} channels\n${roleCount} roles`, inline: true },
        { name: '🗄️ Database', value: `${dbStatus}\n${dbResponseTime}`, inline: true },
        { name: '⚙️ Commands', value: `${commandCount} loaded`, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: `Node.js ${process.version}` });

    // Add owner-only info if user is owner
    if (isOwner(interaction.user.id)) {
      embed.addFields(
        { name: '🔧 Environment', value: `NODE_ENV: ${process.env.NODE_ENV || 'development'}\nPORT: ${config.PORT}`, inline: true }
      );
    }

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Status command error:', error);
    const content = '❌ Failed to get bot status.';
    
    if (interaction.deferred) {
      return interaction.editReply({ content });
    } else {
      return interaction.reply({ content, ephemeral: true });
    }
  }
}
