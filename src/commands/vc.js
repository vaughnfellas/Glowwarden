// ============= src/commands/vc.js =============
import { SlashCommandBuilder, MessageFlags, ChannelType } from 'discord.js';
import { tempOwners } from '../services/temp-vc-service.js';
import { CHANNELS } from '../channels.js';
import { config } from '../config.js';

export const data = new SlashCommandBuilder()
  .setName('vc')
  .setDescription('Join a guild member\'s War Chamber by host name')
  .addStringOption(option =>
    option
      .setName('host')
      .setDescription('Host name of the War Chamber you want to join')
      .setRequired(true)
      .setAutocomplete(true)
  );

export async function execute(interaction) {
  const hostInput = interaction.options.getString('host', true);
  const member = interaction.member;
  const guild = interaction.guild;

  // Only allow guild members (not Stray Spores) to use this command
  if (member.roles.cache.has(config.STRAY_SPORE_ROLE_ID) && 
      !member.roles.cache.has(config.ROLE_BASE_MEMBER) &&
      !member.roles.cache.has(config.ROLE_BASE_OFFICER) &&
      !member.roles.cache.has(config.ROLE_BASE_VETERAN)) {
    return interaction.reply({
      content: 'This command is only available to guild members. Stray Spores should use the invite link provided by their host.',
      flags: MessageFlags.Ephemeral
    });
  }

  try {
    const battlefront = guild.channels.cache.get(CHANNELS.BATTLEFRONT);
    if (!battlefront) {
      return interaction.reply({
        content: 'Battlefront category not found.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Find matching host
    const tempVCs = battlefront.children.cache.filter(ch => 
      ch.type === ChannelType.GuildVoice && 
      tempOwners.has(ch.id)
    );

    let targetVC = null;
    
    // Try to find matching host
    for (const [channelId, channel] of tempVCs) {
      const ownerId = tempOwners.get(channelId);
      try {
        const owner = await guild.members.fetch(ownerId).catch(() => null);
        if (owner && owner.displayName.toLowerCase().includes(hostInput.toLowerCase())) {
          targetVC = { channel, owner };
          break;
        }
      } catch (error) {
        continue;
      }
    }

    if (!targetVC) {
      return interaction.reply({
        content: `No War Chamber found for host "${hostInput}". Use autocomplete to see available hosts.`,
        flags: MessageFlags.Ephemeral
      });
    }

    // Check if user is already in voice
    if (!member.voice.channelId) {
      return interaction.reply({
        content: 'You need to be in a voice channel first. Join any voice channel, then use this command.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Move them to the target VC
    try {
      await member.voice.setChannel(targetVC.channel);
      
      return interaction.reply({
        content: `Moved you to **${targetVC.owner.displayName}**'s War Chamber!`,
        flags: MessageFlags.Ephemeral
      });
      
    } catch (error) {
      return interaction.reply({
        content: 'Failed to move you to the War Chamber. You may not have permission to join.',
        flags: MessageFlags.Ephemeral
      });
    }
    
  } catch (error) {
    console.error('VC command error:', error);
    return interaction.reply({
      content: 'Something went wrong. Please try again.',
      flags: MessageFlags.Ephemeral
    });
  }
}

export async function autocomplete(interaction) {
  try {
    const guild = interaction.guild;
    const battlefront = guild.channels.cache.get(CHANNELS.BATTLEFRONT);
    
    if (!battlefront) {
      return interaction.respond([]);
    }

    const focusedValue = interaction.options.getFocused().toLowerCase();
    
    // Get all temp VCs and their owners
    const choices = [];
    const tempVCs = battlefront.children.cache.filter(ch => 
      ch.type === ChannelType.GuildVoice && 
      tempOwners.has(ch.id)
    );

    for (const [channelId, channel] of tempVCs) {
      const ownerId = tempOwners.get(channelId);
      try {
        const owner = await guild.members.fetch(ownerId).catch(() => null);
        if (owner) {
          const memberCount = channel.members.size;
          const displayName = owner.displayName;
          
          if (displayName.toLowerCase().includes(focusedValue)) {
            choices.push({
              name: `${displayName} (${memberCount} members)`,
              value: displayName
            });
          }
        }
      } catch (error) {
        continue;
      }
    }

    // Sort by member count (more active chambers first)
    choices.sort((a, b) => {
      const aMatch = a.name.match(/\((\d+) members\)/);
      const bMatch = b.name.match(/\((\d+) members\)/);
      const aCount = aMatch ? parseInt(aMatch[1]) : 0;
      const bCount = bMatch ? parseInt(bMatch[1]) : 0;
      return bCount - aCount;
    });

    return interaction.respond(choices.slice(0, 25));
    
  } catch (error) {
    console.error('VC autocomplete error:', error);
    return interaction.respond([]);
  }
}