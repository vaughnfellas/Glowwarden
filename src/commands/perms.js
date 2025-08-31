// ============= src/commands/perms.js =============
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { checkOwnerPermission } from '../utils/owner.js';
import { config } from '../config.js';
import fs from 'fs/promises';
import path from 'path';
import { CHANNELS } from '../channels.js';

export const data = new SlashCommandBuilder()
  .setName('perms')
  .setDescription('Manage server permissions with config-driven templates')
  .addSubcommand(sub =>
    sub.setName('audit')
      .setDescription('Audit current permissions and find security issues')
  )
  .addSubcommand(sub =>
    sub.setName('apply-defaults')
      .setDescription('Apply the default permission structure from config')
      .addBooleanOption(opt =>
        opt.setName('dry-run')
          .setDescription('Preview changes without applying them')
      )
  )
  .addSubcommand(sub =>
    sub.setName('save-current')
      .setDescription('Save current Discord permissions as new config defaults')
      .addStringOption(opt =>
        opt.setName('output')
          .setDescription('Where to save (config-update or new-template)')
          .addChoices(
            { name: 'Update existing config', value: 'config' },
            { name: 'Save as new template', value: 'template' }
          )
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt.setName('name')
          .setDescription('Template name (required if saving as template)')
      )
  )
  .addSubcommand(sub =>
    sub.setName('load-template')
      .setDescription('Apply a saved permission template')
      .addStringOption(opt =>
        opt.setName('template')
          .setDescription('Template to apply')
          .setAutocomplete(true)
          .setRequired(true)
      )
      .addBooleanOption(opt =>
        opt.setName('dry-run')
          .setDescription('Preview changes without applying them')
      )
  )
  .addSubcommand(sub =>
    sub.setName('show-template')
      .setDescription('Display a permission template')
      .addStringOption(opt =>
        opt.setName('template')
          .setDescription('Template to view')
          .setAutocomplete(true)
          .setRequired(true)
      )
  );

// Default permission structure based on your role setup
const DEFAULT_PERMISSIONS = {
  channels: {
    [CHANNELS.SPORE_BOX]: {
      name: 'spore-box',
      description: 'Guest landing zone - visitors sign decree here',
      overwrites: [
        {
          id: '@everyone',
          allow: ['ViewChannel', 'ReadMessageHistory'],
          deny: ['SendMessages', 'CreateInstantInvite']
        },
        {
          id: config.STRAY_SPORE_ROLE_ID,
          allow: ['SendMessages', 'UseApplicationCommands', 'AddReactions']
        },
        {
          id: config.TEMP_HOST_ROLE_ID,
          allow: ['ViewChannel', 'SendMessages']
        },
        {
          id: 'BOT',
          allow: ['ViewChannel', 'SendMessages', 'ManageMessages', 'CreateInstantInvite']
        }
      ]
    },
    [CHANNELS.CHAMBER_OF_OATHS]: {
      name: 'chamber-of-oaths',
      description: 'Members complete final oath here',
      overwrites: [
        {
          id: '@everyone',
          deny: ['ViewChannel']
        },
        {
          id: config.ROLE_BASE_MEMBER,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'UseApplicationCommands']
        },
        {
          id: config.ROLE_BASE_OFFICER,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'UseApplicationCommands']
        },
        {
          id: config.ROLE_BASE_VETERAN,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'UseApplicationCommands']
        },
        {
          id: 'BOT',
          allow: ['ViewChannel', 'SendMessages', 'ManageMessages']
        }
      ]
    },
    [CHANNELS.SPOREHALL]: {
      name: 'sporehall',
      description: 'Guests wait here, use /vc to join hosts',
      overwrites: [
        {
          id: '@everyone',
          deny: ['ViewChannel']
        },
        {
          id: config.STRAY_SPORE_ROLE_ID,
          allow: ['ViewChannel', 'SendMessages', 'UseApplicationCommands']
        },
        {
          id: config.TEMP_HOST_ROLE_ID,
          allow: ['ViewChannel', 'SendMessages', 'Connect', 'MoveMembers']
        },
        {
          id: config.ROLE_FINAL_MYCE,
          allow: ['ViewChannel', 'SendMessages']
        },
        {
          id: config.ROLE_FINAL_GALLIES,
          allow: ['ViewChannel', 'SendMessages']
        },
        {
          id: config.ROLE_FINAL_GCRUS,
          allow: ['ViewChannel', 'SendMessages', 'MoveMembers']
        },
        {
          id: config.ROLE_FINAL_BBEAR,
          allow: ['ViewChannel', 'SendMessages', 'MoveMembers']
        },
        {
          id: config.ROLE_FINAL_RAPO,
          allow: ['ViewChannel', 'SendMessages', 'MoveMembers']
        },
        {
          id: config.ROLE_FINAL_RALLYLT,
          allow: ['ViewChannel', 'SendMessages', 'MoveMembers']
        },
        {
          id: 'BOT',
          allow: ['ViewChannel', 'SendMessages', 'MoveMembers']
        }
      ]
    },
    [CHANNELS.RENT_A_WAR_CHAMBER]: {
      name: '➕⚔️-rent-a-war-chamber',
      description: 'Join to create temp VC',
      overwrites: [
        {
          id: '@everyone',
          deny: ['Connect']
        },
        {
          id: config.ROLE_FINAL_MYCE,
          allow: ['ViewChannel', 'Connect']
        },
        {
          id: config.ROLE_FINAL_GALLIES,
          allow: ['ViewChannel', 'Connect']
        },
        {
          id: config.ROLE_FINAL_GCRUS,
          allow: ['ViewChannel', 'Connect']
        },
        {
          id: config.ROLE_FINAL_BBEAR,
          allow: ['ViewChannel', 'Connect']
        },
        {
          id: config.ROLE_FINAL_RAPO,
          allow: ['ViewChannel', 'Connect']
        },
        {
          id: config.ROLE_FINAL_RALLYLT,
          allow: ['ViewChannel', 'Connect']
        },
        {
          id: 'BOT',
          allow: ['ViewChannel', 'Connect', 'MoveMembers', 'ManageChannels']
        }
      ]
    }
  },
  categories: {
    [CHANNELS.BATTLEFRONT]: {
      name: 'Battlefront',
      description: 'Temporary voice channels',
      overwrites: [
        {
          id: '@everyone',
          deny: ['ViewChannel', 'Connect']
        },
        {
          id: 'BOT',
          allow: ['ViewChannel', 'Connect', 'ManageChannels', 'MoveMembers']
        }
      ]
    }
  }
};

export async function execute(interaction) {
  if (!(await checkOwnerPermission(interaction))) return;

  const subcommand = interaction.options.getSubcommand();
  const guild = interaction.guild;

  switch (subcommand) {
    case 'audit':
      await auditPermissions(interaction, guild);
      break;
    case 'apply-defaults':
      const dryRun = interaction.options.getBoolean('dry-run') ?? false;
      await applyDefaultPermissions(interaction, guild, dryRun);
      break;
    case 'save-current':
      const output = interaction.options.getString('output', true);
      const templateName = interaction.options.getString('name');
      await saveCurrentPermissions(interaction, guild, output, templateName);
      break;
    case 'load-template':
      const template = interaction.options.getString('template', true);
      const templateDryRun = interaction.options.getBoolean('dry-run') ?? false;
      await loadTemplate(interaction, guild, template, templateDryRun);
      break;
    case 'show-template':
      const showTemplate = interaction.options.getString('template', true);
      await showTemplateInfo(interaction, showTemplate);
      break;
  }
}

async function auditPermissions(interaction, guild) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const issues = [];
  const warnings = [];
  const everyoneRole = guild.roles.everyone;

  // Check @everyone permissions
  const dangerousPerms = [
    'SendMessages', 'Connect', 'CreateInstantInvite', 
    'ChangeNickname', 'UseExternalEmojis', 'AddReactions', 'UseApplicationCommands'
  ];
  
  const everyoneHas = dangerousPerms.filter(perm => 
    everyoneRole.permissions.has(PermissionFlagsBits[perm])
  );
  
  if (everyoneHas.length > 0) {
    issues.push(`🚨 @everyone has: ${everyoneHas.join(', ')}`);
  }

  // Special check: @everyone should have ViewChannel enabled at role level
  // but overridden with Deny in most channels
  if (!everyoneRole.permissions.has(PermissionFlagsBits.ViewChannel)) {
    warnings.push(`⚠️ @everyone lacks ViewChannel - this blocks Spore Box access`);
  }

  // Check key channels exist and are configured
  const keyChannels = Object.entries(DEFAULT_PERMISSIONS.channels)
    .filter(([id]) => id && id !== '0');

  for (const [channelId, template] of keyChannels) {
    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
      issues.push(`❌ ${template.name} channel missing (ID: ${channelId})`);
      continue;
    }

    // Check if @everyone is properly denied ViewChannel (except Spore Box)
    const everyoneOverwrite = channel.permissionOverwrites.cache.get(guild.id);
    if (channelId !== config.SPORE_BOX_CHANNEL_ID) {
      if (!everyoneOverwrite || !everyoneOverwrite.deny.has('ViewChannel')) {
        issues.push(`🔓 ${template.name} doesn't deny ViewChannel for @everyone`);
      }
    }
  }

  // Check bot permissions
  const botMember = guild.members.me;
  const criticalPerms = ['ManageRoles', 'ManageChannels', 'MoveMembers', 'CreateInstantInvite'];
  const botMissing = criticalPerms.filter(perm => 
    !botMember.permissions.has(PermissionFlagsBits[perm])
  );
  
  if (botMissing.length > 0) {
    issues.push(`🤖 Bot missing: ${botMissing.join(', ')}`);
  }

  // Check role hierarchy
  const managedRoles = [
    config.STRAY_SPORE_ROLE_ID,
    config.ROLE_LGBTQ,
    config.ROLE_ALLY,
    config.TEMP_HOST_ROLE_ID
  ].filter(Boolean);

  const botRole = guild.members.me.roles.highest;
  const hierarchyIssues = managedRoles.filter(roleId => {
    const role = guild.roles.cache.get(roleId);
    return role && role.position >= botRole.position;
  });

  if (hierarchyIssues.length > 0) {
    issues.push(`📊 Bot role too low to manage: ${hierarchyIssues.map(id => 
      guild.roles.cache.get(id)?.name || id
    ).join(', ')}`);
  }

  // Compile results
  let result = [];
  if (issues.length > 0) {
    result.push('**🚨 SECURITY ISSUES:**');
    result.push(...issues.map(i => `• ${i}`));
  }
  if (warnings.length > 0) {
    result.push('**⚠️ WARNINGS:**');
    result.push(...warnings.map(w => `• ${w}`));
  }
  if (issues.length === 0 && warnings.length === 0) {
    result.push('✅ **No major permission issues detected!**');
  }

  await interaction.editReply(result.join('\n'));
}

async function applyDefaultPermissions(interaction, guild, dryRun) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const changes = [];
  const botId = guild.members.me.id;

  // Apply channel permissions
  for (const [channelId, template] of Object.entries(DEFAULT_PERMISSIONS.channels)) {
    if (!channelId || channelId === '0') continue;

    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
      changes.push(`❌ ${template.name}: Channel not found`);
      continue;
    }

    for (const overwrite of template.overwrites) {
      const targetId = overwrite.id === '@everyone' ? guild.id : 
                     overwrite.id === 'BOT' ? botId : overwrite.id;
      
      if (!targetId || targetId === '0') continue;

      const targetName = targetId === guild.id ? '@everyone' :
                        targetId === botId ? 'Glowwarden' :
                        guild.roles.cache.get(targetId)?.name || targetId;

      try {
        if (!dryRun) {
          const permissions = {};
          (overwrite.allow || []).forEach(perm => permissions[perm] = true);
          (overwrite.deny || []).forEach(perm => permissions[perm] = false);
          
          await channel.permissionOverwrites.edit(targetId, permissions);
        }
        changes.push(`✅ ${template.name}: Set permissions for ${targetName}`);
      } catch (e) {
        changes.push(`❌ ${template.name}: Failed for ${targetName} - ${e.message}`);
      }
    }
  }

  // Apply category permissions
  for (const [categoryId, template] of Object.entries(DEFAULT_PERMISSIONS.categories)) {
    if (!categoryId || categoryId === '0') continue;

    const category = guild.channels.cache.get(categoryId);
    if (!category || category.type !== ChannelType.GuildCategory) {
      changes.push(`❌ ${template.name}: Category not found`);
      continue;
    }

    for (const overwrite of template.overwrites) {
      const targetId = overwrite.id === '@everyone' ? guild.id : 
                     overwrite.id === 'BOT' ? botId : overwrite.id;
      
      if (!targetId || targetId === '0') continue;

      const targetName = targetId === guild.id ? '@everyone' :
                        targetId === botId ? 'Glowwarden' :
                        guild.roles.cache.get(targetId)?.name || targetId;

      try {
        if (!dryRun) {
          const permissions = {};
          (overwrite.allow || []).forEach(perm => permissions[perm] = true);
          (overwrite.deny || []).forEach(perm => permissions[perm] = false);
          
          await category.permissionOverwrites.edit(targetId, permissions);
        }
        changes.push(`✅ ${template.name}: Set permissions for ${targetName}`);
      } catch (e) {
        changes.push(`❌ ${template.name}: Failed for ${targetName} - ${e.message}`);
      }
    }
  }

  const prefix = dryRun ? '**🔍 DRY RUN - Preview of changes:**' : '**✅ Applied default permissions:**';
  const result = changes.length > 0 
    ? `${prefix}\n${changes.map(c => `• ${c}`).join('\n')}`
    : '✅ All permissions already match defaults!';

  await interaction.editReply(result);
}

async function saveCurrentPermissions(interaction, guild, outputType, templateName) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const snapshot = {
    timestamp: new Date().toISOString(),
    savedBy: interaction.user.tag,
    guildId: guild.id,
    guildName: guild.name,
    channels: {},
    categories: {}
  };

  // Capture all channels with overwrites
  for (const channel of guild.channels.cache.values()) {
    if (channel.permissionOverwrites.cache.size === 0) continue;

    const overwrites = [...channel.permissionOverwrites.cache.values()].map(ow => ({
      id: ow.id === guild.id ? '@everyone' : ow.id,
      name: ow.id === guild.id ? '@everyone' : 
            (guild.roles.cache.get(ow.id)?.name || 
             guild.members.cache.get(ow.id)?.displayName || 'Unknown'),
      allow: ow.allow.toArray(),
      deny: ow.deny.toArray()
    }));

    const channelData = {
      name: channel.name,
      type: channel.type,
      overwrites,
      parentId: channel.parentId
    };

    if (channel.type === ChannelType.GuildCategory) {
      snapshot.categories[channel.id] = channelData;
    } else {
      snapshot.channels[channel.id] = channelData;
    }
  }

  try {
    if (outputType === 'config') {
      // Generate new config structure
      const configUpdate = generateConfigUpdate(snapshot);
      await fs.writeFile('permission-config-update.js', configUpdate);
      await interaction.editReply(
        '✅ **Current permissions saved to `permission-config-update.js`**\n' +
        '📝 Review the file and merge desired changes into your config.\n' +
        `📊 Captured ${Object.keys(snapshot.channels).length} channels, ${Object.keys(snapshot.categories).length} categories`
      );
    } else {
      // Save as template
      if (!templateName) {
        return interaction.editReply('❌ Template name required when saving as template.');
      }
      
      const templatesDir = 'permission-templates';
      await fs.mkdir(templatesDir, { recursive: true });
      await fs.writeFile(
        path.join(templatesDir, `${templateName}.json`),
        JSON.stringify(snapshot, null, 2)
      );
      
      await interaction.editReply(
        `✅ **Template "${templateName}" saved!**\n` +
        `📁 Saved to: permission-templates/${templateName}.json\n` +
        `📊 Captured ${Object.keys(snapshot.channels).length} channels, ${Object.keys(snapshot.categories).length} categories`
      );
    }
  } catch (e) {
    await interaction.editReply(`❌ Save failed: ${e.message}`);
  }
}

async function loadTemplate(interaction, guild, templateName, dryRun) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const templatePath = path.join('permission-templates', `${templateName}.json`);
    const data = await fs.readFile(templatePath, 'utf8');
    const template = JSON.parse(data);

    const changes = [];
    const botId = guild.members.me.id;

    // Apply channel permissions from template
    for (const [channelId, channelData] of Object.entries(template.channels)) {
      const channel = guild.channels.cache.get(channelId);
      if (!channel) {
        changes.push(`❌ ${channelData.name}: Channel not found`);
        continue;
      }

      for (const overwrite of channelData.overwrites) {
        const targetId = overwrite.id === '@everyone' ? guild.id : 
                        overwrite.id === 'BOT' ? botId : overwrite.id;

        try {
          if (!dryRun) {
            const permissions = {};
            overwrite.allow.forEach(perm => permissions[perm] = true);
            overwrite.deny.forEach(perm => permissions[perm] = false);
            
            await channel.permissionOverwrites.edit(targetId, permissions);
          }
          changes.push(`✅ ${channelData.name}: Set permissions for ${overwrite.name}`);
        } catch (e) {
          changes.push(`❌ ${channelData.name}: Failed for ${overwrite.name} - ${e.message}`);
        }
      }
    }

    const prefix = dryRun ? '**🔍 DRY RUN - Template preview:**' : `**✅ Applied template "${templateName}":**`;
    const result = changes.length > 0 
      ? `${prefix}\n${changes.map(c => `• ${c}`).join('\n')}`
      : '✅ No changes needed!';

    await interaction.editReply(result);
  } catch (e) {
    await interaction.editReply(`❌ Failed to load template: ${e.message}`);
  }
}

async function showTemplateInfo(interaction, templateName) {
  // Implementation for showing template details
  await interaction.reply({ 
    content: `Template info for "${templateName}" - feature coming soon!`, 
    flags: MessageFlags.Ephemeral 
  });
}

function generateConfigUpdate(snapshot) {
  return `// Generated permission config update - ${snapshot.timestamp}
// Saved by: ${snapshot.savedBy}
// Guild: ${snapshot.guildName} (${snapshot.guildId})

export const PERMISSION_TEMPLATES = ${JSON.stringify({
  default: {
    channels: snapshot.channels,
    categories: snapshot.categories
  }
}, null, 2)};

// To use: import and apply with /perms load-template default`;
}

export async function autocomplete(interaction) {
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'load-template' || subcommand === 'show-template') {
    try {
      const files = await fs.readdir('permission-templates').catch(() => []);
      const templates = files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
      
      const focused = interaction.options.getFocused().toLowerCase();
      const choices = templates
        .filter(name => name.toLowerCase().includes(focused))
        .slice(0, 25)
        .map(name => ({ name, value: name }));
      
      await interaction.respond(choices);
    } catch {
      await interaction.respond([]);
    }
  }
}