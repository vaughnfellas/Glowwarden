// src/commands/vc.js
import { SlashCommandBuilder, MessageFlags, ChannelType, PermissionFlagsBits } from 'discord.js';
import { tempOwners, grantAccessToMember } from '../services/temp-vc-service.js';
import { CHANNELS } from '../channels.js';
import { config } from '../config.js';

export const data = new SlashCommandBuilder()
  .setName('vc')
  .setDescription('War Chamber management commands')
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

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const member = interaction.member;
  const guild = interaction.guild;

  if (subcommand === 'goto') {
    const hostInput = interaction.options.getString('host', true);

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
      console.error('VC goto command error:', error);
      return interaction.reply({
        content: 'Something went wrong. Please try again.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
  else if (subcommand === 'invite') {
    const targetUser = interaction.options.getUser('user');
    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    
    if (!targetMember) {
      return interaction.reply({
        content: 'User not found in this server.',
        flags: MessageFlags.Ephemeral
      });
    }
    
    // Check if the command user is a host of any War Chamber
    let userChannel = null;
    for (const [channelId, ownerId] of tempOwners.entries()) {
      if (ownerId === interaction.user.id) {
        userChannel = guild.channels.cache.get(channelId);
        break;
      }
    }
    
    if (!userChannel) {
      return interaction.reply({
        content: 'You don\'t have an active War Chamber. Create one by joining the "Rent A War Chamber" voice channel.',
        flags: MessageFlags.Ephemeral
      });
    }
    
    // Grant access to the target member
    const result = await grantAccessToMember(targetMember, userChannel.id);
    
    if (result.success) {
      // Try to DM the invited user
      try {
        await targetMember.send(`**${interaction.user.username}** has invited you to their War Chamber! You now have access to join.`);
      } catch (error) {
        console.log(`Could not DM invite to ${targetMember.user.tag}`);
      }
      
      return interaction.reply({
        content: `✅ Granted access to **${targetMember.displayName}** for your War Chamber!`,
        flags: MessageFlags.Ephemeral
      });
    } else {
      return interaction.reply({
        content: `❌ Failed to grant access: ${result.message}`,
        flags: MessageFlags.Ephemeral
      });
    }
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
