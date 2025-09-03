// ============= src/events/ready.js =============
import { Events, ActivityType, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { config } from '../config.js';
import { sweepTempRooms, initTempVCService } from '../services/temp-vc-service.js';
import { initInviteRoleService } from '../services/invite-role-service.js';

// Import command data for deployment
import { data as decreeData } from '../commands/decree.js';
import { data as idsData } from '../commands/ids.js';
import { data as permsData } from '../commands/perms.js';
import { data as addaltData, switchData, rosterData, deleteAltData } from '../commands/addalt.js';
import { data as generateInviteData } from '../commands/generate-invite.js';
import { data as glowwardenData } from '../commands/glowwarden.js';
import { data as statusData } from '../commands/status.js';
import { data as pingData } from '../commands/ping.js';
import { data as vcStatusData } from '../commands/vc-status.js';

export const name = Events.ClientReady;
export const once = true;

// Helper: basic snowflake validator
const SNOWFLAKE = v => /^\d{17,20}$/.test(String(v || '').trim());

async function deployCommands(client) {
  try {
    const TOKEN = process.env.DISCORD_TOKEN || config.DISCORD_TOKEN;
    const CLIENT_ID = process.env.CLIENT_ID || config.CLIENT_ID;
    const GUILD_ID = process.env.GUILD_ID || config.GUILD_ID;

    if (!TOKEN || !CLIENT_ID) {
      throw new Error('Missing DISCORD_TOKEN or CLIENT_ID for command deployment');
    }

    // Build vc command
    const vcCmd = new SlashCommandBuilder()
      .setName('vc')
      .setDescription('Create/join War Chamber (auto-generates Stray Spore invites)')
      .addSubcommand(subcommand =>
        subcommand
          .setName('goto')
          .setDescription('Join a guild member\'s War Chamber by host name')
          .addStringOption(option =>
            option
              .setName('host')
              .setDescription('Host name of the War Chamber you want to join')
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('invite')
          .setDescription('Invite a guild member to your War Chamber')
          .addUserOption(option =>
            option
              .setName('user')
              .setDescription('User to invite to your War Chamber')
              .setRequired(true)
          )
      );

    // Include ALL commands in the deployment
    const commands = [
      vcCmd, 
      vcStatusData,
      decreeData, 
      idsData, 
      permsData, 
      addaltData,
      switchData,
      rosterData,
      deleteAltData,
      generateInviteData,
      glowwardenData,
      statusData,
      pingData
    ].map(c => c.toJSON());

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    if (GUILD_ID && SNOWFLAKE(GUILD_ID)) {
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commands }
      );
      console.log(`✅ Deployed ${commands.length} commands to guild ${GUILD_ID}`);
    } else {
      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commands }
      );
      console.log(`✅ Deployed ${commands.length} GLOBAL commands`);
    }
  } catch (error) {
    console.error('❌ Command deployment failed:', error);
    // Don't crash the bot if command deployment fails
  }
}

export async function execute(client) {
  try {
    console.log(`✅ Logged in as ${client.user.tag}`);

    // Deploy commands first
    console.log('Deploying slash commands...');
    await deployCommands(client);

    // Services with proper error handling
    try {
      console.log('Initializing invite role service...');
      initInviteRoleService(client);
      console.log('✅ Invite role service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize invite role service:', error);
      // Continue execution even if this service fails
    }

    try {
      console.log('Initializing temp VC service...');
      initTempVCService(client);
      console.log('✅ Temp VC service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize temp VC service:', error);
      // Continue execution even if this service fails
    }
    
    // Presence
    try {
      client.user.setPresence({
        activities: [{ name: 'the Chamber of Oaths', type: ActivityType.Watching }],
        status: 'online',
      });
      console.log('✅ Set bot presence');
    } catch (error) {
      console.error('❌ Failed to set presence:', error);
    }

    // Startup sweep + schedule
    try {
      await sweepTempRooms();
      const sweepMs = Math.max(60_000, Number(config.SWEEP_INTERVAL_SEC) * 1000 || 600_000);
      setInterval(sweepTempRooms, sweepMs);
      console.log(`✅ Scheduled temp room sweeps every ${sweepMs/1000} seconds`);
    } catch (error) {
      console.error('❌ Failed to set up room sweeping:', error);
    }
    
    console.log('✅ Ready event completed successfully');
  } catch (error) {
    console.error('❌ Critical error in ready event:', error);
  }
}
