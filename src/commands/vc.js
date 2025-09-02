// ============= src/commands/vc.js =============
import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { tempOwners, createTempVCFor, getTempVCInviteInfo } from '../services/temp-vc-service.js';
import { CHANNELS } from '../channels.js';

export const data = new SlashCommandBuilder()
  .setName('vc')
  .setDescription('Create/join War Chamber (auto-generates Stray Spore invites)')
  .addStringOption(option =>
    option
      .setName('host')
      .setDescription('Join existing War Chamber by host name (leave empty to create your own)')
      .setAutocomplete(true)
  );

export async function execute(interaction) {
  const hostInput = interaction.options.getString('host');
  const member = interaction.member;
  const guild = interaction.guild;

  // If no host specified, create their own War Chamber
  if (!hostInput) {
    // Check if they already have a War Chamber
    const existingVC = [...tempOwners.entries()].find(([channelId, ownerId]) => ownerId === member.id);
    
    if (existingVC) {
      const [channelId] = existingVC;
      const channel = guild.channels.cache.get(channelId);
      const inviteInfo = getTempVCInviteInfo(channelId);
      
      if (channel && inviteInfo) {
        return interaction.reply({
          content: [
            `You already have an active War Chamber: **${channel.name}**`,
            `Your auto-generated invite: \`${inviteInfo.url}\``,
            `Share this link to bring friends directly to your chamber as Stray Spores!`
          ].join('\n'),
          flags: MessageFlags.Ephemeral
        });
      }
    }

    // Create new War Chamber
    try {
      await interaction.deferReply({ ephemeral: true });
      
      await createTempVCFor(member);
      
      return interaction.editReply({
        content: [
          '🏰 **War Chamber created!**',
          'You\'ve been moved to your new chamber and an invite has been auto-generated.',
          'Check the text channel in your War Chamber for the Stray Spore invite link!',
          '',
          '💡 **Tip:** Use `/vc-status` to see your invite link anytime.'
        ].join('\n')
      });
      
    } catch (error) {
      console.error('Failed to create War Chamber:', error);
      return interaction.editReply('❌ Failed to create War Chamber. Please try again.');
    }
  }

  // Join existing War Chamber
  try {
    const battlefront = guild.channels.cache.get(CHANNELS.BATTLEFRONT);
    if (!battlefront) {
      return interaction.reply({
        content: '❌ Battlefront category not found.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Find matching host
    const tempVCs = battlefront.children.cache.filter(ch => 
      ch.type === 2 && // GuildVoice
      tempOwners.has(ch.id)
    );

    let targetVC = null;
    
    // Try exact match first
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
        content: `❌ No War Chamber found for host "${hostInput}". Use autocomplete to see available hosts.`,
        flags: MessageFlags.Ephemeral
      });
    }

    // Check if user is already in voice
    if (!member.voice.channelId) {
      return interaction.reply({
        content: '❌ You need to be in a voice channel first. Join Sporehall or any voice channel, then use this command.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Move them to the target VC
    try {
      await member.voice.setChannel(targetVC.channel);
      
      return interaction.reply({
        content: `✅ Moved you to **${targetVC.owner.displayName}**'s War Chamber!`,
        flags: MessageFlags.Ephemeral
      });
      
    } catch (error) {
      return interaction.reply({
        content: '❌ Failed to move you to the War Chamber. You may not have permission to join.',
        flags: MessageFlags.Ephemeral
      });
    }
    
  } catch (error) {
    console.error('VC command error:', error);
    return interaction.reply({
      content: '❌ Something went wrong. Please try again.',
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
      ch.type === 2 && // GuildVoice
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
      const aCount = parseInt(a.name.match(/\((\d+) members\)/)[1]);
      const bCount = parseInt(b.name.match(/\((\d+) members\)/)[1]);
      return bCount - aCount;
    });

    return interaction.respond(choices.slice(0, 25));
    
  } catch (error) {
    console.error('VC autocomplete error:', error);
    return interaction.respond([]);
  }
}