// ============= src/commands/vc.js =============
import { SlashCommandBuilder, ChannelType, MessageFlags } from 'discord.js';
import { config } from '../config.js';
import { CHANNELS } from '../channels.js';
import { tempOwners } from '../services/temp-vc-service.js';

export const data = new SlashCommandBuilder()
  .setName('vc')
  .setDescription('Move to a host\'s War Chamber')
  .addStringOption(option =>
    option.setName('host')
      .setDescription('The host whose chamber you want to join')
      .setRequired(true)
      .setAutocomplete(true)
  );

export async function execute(interaction) {
  const hostId = interaction.options.getString('host', true);
  const member = interaction.member;

  // Check if user is in a voice channel
  const vs = member.voice;
  if (!vs?.channelId) {
    await interaction.reply({ content: '⛔ Join a voice channel first, then use /vc.', flags: MessageFlags.Ephemeral });
    return;
  }
  
  // Check if user is a Stray Spore (needs to be in Sporehall specifically)
  const isStraySpore = member.roles.cache.has(process.env.STRAY_SPORE_ROLE_ID || '');
  if (isStraySpore && CHANNELS.SPOREHALL && vs.channelId !== CHANNELS.SPOREHALL) {
    await interaction.reply({ content: '⚠️ As a guest, please join *Sporehall* first, then use /vc.', flags: MessageFlags.Ephemeral });
    return;
  }

  // Find the chamber for the selected host
  const entry = [...tempOwners.entries()].find(([, owner]) => owner === hostId);
  if (!entry) {
    await interaction.reply({ content: '⛔ I can\'t find a War Chamber for that host right now.', flags: MessageFlags.Ephemeral });
    return;
  }

  const [chamberId] = entry;
  const chamber = await interaction.guild.channels.fetch(chamberId).catch(() => null);
  if (!chamber || chamber.type !== ChannelType.GuildVoice) {
    await interaction.reply({ content: '⛔ That War Chamber doesn\'t seem to exist anymore.', flags: MessageFlags.Ephemeral });
    return;
  }

  try {
    await member.voice.setChannel(chamber);
    await interaction.reply({ content: `✅ Moved you to **${chamber.name}**.`, flags: MessageFlags.Ephemeral });
  } catch (e) {
    console.error('vc move failed:', e);
    await interaction.reply({
      content: '⛔ I couldn\'t move you. I need *Move Members* in both channels.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

export async function autocomplete(interaction) {
  const focused = (interaction.options.getFocused() || '').toLowerCase();
  const guild = interaction.guild;
  const choices = [];
  
  // First, try to get hosts from temp war chambers
  const tempHostEntries = [...tempOwners.entries()];
  
  if (tempHostEntries.length > 0) {
    console.log(`[vc] Found ${tempHostEntries.length} temp war chambers`);
    
    // Process temp chamber owners
    for (const [chamberId, ownerId] of tempHostEntries) {
      try {
        // Try to get the channel name for context
        const channel = await guild.channels.fetch(chamberId).catch(() => null);
        const channelName = channel?.name || "War Chamber";
        
        // Try to get the user's name
        const user = await interaction.client.users.fetch(ownerId).catch(() => null);
        const username = user?.username || "Unknown Host";
        
        // Only add if it matches the search or there's no search yet
        if (!focused || username.toLowerCase().includes(focused)) {
          choices.push({ 
            name: `${username} (${channelName})`, 
            value: ownerId 
          });
        }
      } catch (err) {
        console.error(`[vc] Error processing temp host ${ownerId}:`, err);
        // Still add as a fallback with just the ID
        if (!focused || ownerId.includes(focused)) {
          choices.push({ name: `Host ID: ${ownerId}`, value: ownerId });
        }
      }
    }
  } else {
    console.log('[vc] No temp war chambers found, falling back to host role');
    
    // Fallback: If no temp chambers, look for users with the host role
    try {
      const hostRole = guild.roles.cache.find(r => 
        r.name.toLowerCase().includes('host') || 
        (process.env.HOST_ROLE_ID && r.id === process.env.HOST_ROLE_ID)
      );
      
      if (hostRole) {
        const hosts = hostRole.members.map(m => ({
          id: m.id,
          username: m.user.username
        }));
        
        for (const host of hosts) {
          if (!focused || host.username.toLowerCase().includes(focused)) {
            choices.push({ name: host.username, value: host.id });
          }
        }
      }
    } catch (err) {
      console.error('[vc] Error fetching host role members:', err);
    }
  }
  
  // If still no choices, add a helpful message
  if (choices.length === 0) {
    choices.push({ name: "No hosts available right now", value: "no_host" });
  }
  
  // Limit to 25 choices as per Discord's limit
  await interaction.respond(choices.slice(0, 25));
}
