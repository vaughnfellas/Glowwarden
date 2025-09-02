// ============= src/deploy-commands.js =============
import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { data as decreeData } from './commands/decree.js';
import { data as idsData } from './commands/ids.js';
import { data as permsData } from './commands/perms.js';
import { data as addaltData, switchData, rosterData, deleteAltData } from './commands/addalt.js';
import { data as generateInviteData } from './commands/generate-invite.js';
import { data as glowwardenData } from './commands/glowwarden.js';
import { data as statusData } from './commands/status.js';
import { data as pingData } from './commands/ping.js';
import { data as vcStatusData } from './commands/vc-status.js';

// Helper: basic snowflake validator (17–20 digit ID)
const SNOWFLAKE = v => /^\d{17,20}$/.test(String(v || '').trim());

// --- Required envs (fail-loud) ---
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID; // optional

if (!TOKEN || !CLIENT_ID) {
  const missing = ['DISCORD_TOKEN', 'CLIENT_ID'].filter(k => !process.env[k]).join(', ');
  throw new Error(`Missing env for deploy: ${missing}`);
}
if (GUILD_ID && !SNOWFLAKE(GUILD_ID)) {
  throw new Error(`GUILD_ID looks invalid: "${GUILD_ID}"`);
}

// --- Build your commands ---
const straysCmd = new SlashCommandBuilder()
  .setName('strays')
  .setDescription('[Optional] Manual Stray invite - War Chambers auto-generate these!')
  .addIntegerOption(opt =>
    opt.setName('uses')
      .setDescription('Number of uses (default unlimited, max 25)')
      .setMinValue(1)
      .setMaxValue(25)
  )
  .addStringOption(opt =>
    opt.setName('reason')
      .setDescription('Reason for this manual invite')
  );

const vcCmd = new SlashCommandBuilder()
  .setName('vc')
  .setDescription('Create/join War Chamber (auto-generates Stray Spore invites)')
  .addStringOption(o =>
    o.setName('host')
      .setDescription('Join existing War Chamber by host name (leave empty to create your own)')
      .setAutocomplete(true)
  );

// Include ALL commands in the deployment
const commands = [
  straysCmd, 
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

// --- REST client ---
const rest = new REST({ version: '10' }).setToken(TOKEN);

// --- Deploy ---
(async () => {
  try {
    if (GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commands }
      );
      console.log(`✓ Deployed ${commands.length} commands to guild ${GUILD_ID}`);
    } else {
      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commands }
      );
      console.log(`✓ Deployed ${commands.length} GLOBAL commands (may take up to ~1h to appear)`);
    }
  } catch (err) {
    console.error('❌ Deploy failed:', err);
    process.exit(1);
  }
})();