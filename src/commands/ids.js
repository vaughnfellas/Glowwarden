import {
  SlashCommandBuilder,
  ChannelType,
  MessageFlags,
  AttachmentBuilder,
} from 'discord.js';
import { checkOwnerPermission } from '../utils/owner.js';

function fmtRow(cols, widths) {
  return cols.map((c, i) => String(c).padEnd(widths[i], ' ')).join('  ');
}

function toTable(rows) {
  if (rows.length === 0) return '— none —';
  const widths = rows[0].map((_, i) => Math.max(...rows.map(r => String(r[i]).length)));
  return rows.map(r => fmtRow(r, widths)).join('\n');
}

function makeFile(name, text) {
  return new AttachmentBuilder(Buffer.from(text, 'utf8'), { name });
}

function maybeReplyBig(interaction, content, filename, ephemeral = true) {
  // If content is long, send as attachment
  if (content.length > 1800) {
    const file = makeFile(filename, content);
    return interaction.reply({ files: [file], flags: ephemeral ? MessageFlags.Ephemeral : undefined });
  }
  return interaction.reply({ content: '```\n' + content + '\n```', flags: ephemeral ? MessageFlags.Ephemeral : undefined });
}

export const data = new SlashCommandBuilder()
  .setName('ids')
  .setDescription('List server IDs for roles, channels, or categories.')
  .addSubcommand(sc =>
    sc.setName('roles')
      .setDescription('List all roles with IDs.')
      .addStringOption(o => o
        .setName('format')
        .setDescription('text / csv / json')
        .addChoices(
          { name: 'text (default)', value: 'text' },
          { name: 'csv', value: 'csv' },
          { name: 'json', value: 'json' },
        )
      )
      .addBooleanOption(o => o.setName('ephemeral').setDescription('Only you can see (default true)'))
  )
  .addSubcommand(sc =>
    sc.setName('channels')
      .setDescription('List channels with IDs.')
      .addStringOption(o => o
        .setName('type')
        .setDescription('Filter channel type')
        .addChoices(
          { name: 'all (default)', value: 'all' },
          { name: 'text', value: 'text' },
          { name: 'voice', value: 'voice' },
          { name: 'category', value: 'category' },
          { name: 'stage', value: 'stage' },
          { name: 'forum', value: 'forum' },
          { name: 'announcement', value: 'announcement' },
        )
      )
      .addStringOption(o => o
        .setName('format')
        .setDescription('text / csv / json')
        .addChoices(
          { name: 'text (default)', value: 'text' },
          { name: 'csv', value: 'csv' },
          { name: 'json', value: 'json' },
        )
      )
      .addBooleanOption(o => o.setName('ephemeral').setDescription('Only you can see (default true)'))
  )
  .addSubcommand(sc =>
    sc.setName('categories')
      .setDescription('List all categories with IDs.')
      .addStringOption(o => o
        .setName('format')
        .setDescription('text / csv / json')
        .addChoices(
          { name: 'text (default)', value: 'text' },
          { name: 'csv', value: 'csv' },
          { name: 'json', value: 'json' },
        )
      )
      .addBooleanOption(o => o.setName('ephemeral').setDescription('Only you can see (default true)'))
  );

export async function execute(interaction) {
  // Check if user is owner
  if (!(await checkOwnerPermission(interaction))) return;

  const sub = interaction.options.getSubcommand();
  const format = interaction.options.getString('format') || 'text';
  const ephemeral = interaction.options.getBoolean('ephemeral') ?? true;
  const g = interaction.guild;

  if (sub === 'roles') {
    const roles = [...g.roles.cache.values()]
      .sort((a, b) => b.position - a.position)
      .map(r => ({ name: r.name, id: r.id }));

    let content;
    if (format === 'csv') {
      content = 'name,id\n' + roles.map(r => `"${r.name.replace(/"/g, '""')}",${r.id}`).join('\n');
      return interaction.reply({ files: [makeFile('roles.csv', content)], flags: ephemeral ? MessageFlags.Ephemeral : undefined });
    }
    if (format === 'json') {
      content = JSON.stringify(roles, null, 2);
      return interaction.reply({ files: [makeFile('roles.json', content)], flags: ephemeral ? MessageFlags.Ephemeral : undefined });
    }
    // text
    const rows = [['ROLE', 'ID'], ...roles.map(r => [r.name, r.id])];
    return maybeReplyBig(interaction, toTable(rows), 'roles.txt', ephemeral);
  }

  if (sub === 'channels') {
    const type = interaction.options.getString('type') || 'all';
    const want = new Set([
      'all',
      'text', 'voice', 'category', 'stage', 'forum', 'announcement',
    ]);

    if (!want.has(type)) return interaction.reply({ content: 'Unknown type.', flags: MessageFlags.Ephemeral });

    const typeMap = {
      text: ChannelType.GuildText,
      voice: ChannelType.GuildVoice,
      category: ChannelType.GuildCategory,
      stage: ChannelType.GuildStageVoice,
      forum: ChannelType.GuildForum,
      announcement: ChannelType.GuildAnnouncement,
    };

    let chans = [...g.channels.cache.values()];
    if (type !== 'all') {
      chans = chans.filter(c => c.type === typeMap[type]);
    }
    // Sort by type then position
    chans.sort((a, b) => (a.type - b.type) || (a.rawPosition - b.rawPosition));

    const data = chans.map(c => ({
      name: c.name,
      id: c.id,
      type: Object.keys(typeMap).find(k => typeMap[k] === c.type) || 'other',
      parent: c.parentId || '',
    }));

    let content;
    if (format === 'csv') {
      content = 'name,id\n' + data.map(d =>
        `"${d.name.replace(/"/g, '""')}",${d.id},${d.type},${d.parent}`
      ).join('\n');
      return interaction.reply({ files: [makeFile('channels.csv', content)], flags: ephemeral ? MessageFlags.Ephemeral : undefined });
    }
    if (format === 'json') {
      content = JSON.stringify(data, null, 2);
      return interaction.reply({ files: [makeFile('channels.json', content)], flags: ephemeral ? MessageFlags.Ephemeral : undefined });
    }
    const rows = [['CHANNEL', 'ID', 'TYPE', 'PARENT'],
      ...data.map(d => [d.name, d.id, d.type, d.parent])];
    return maybeReplyBig(interaction, toTable(rows), 'channels.txt', ephemeral);
  }

  if (sub === 'categories') {
    const cats = [...g.channels.cache.values()]
      .filter(c => c.type === ChannelType.GuildCategory)
      .sort((a, b) => a.rawPosition - b.rawPosition)
      .map(c => ({ name: c.name, id: c.id }));

    let content;
    if (format === 'csv') {
      content = 'name,id\n' + cats.map(c => `"${c.name.replace(/"/g, '""')}",${c.id}`).join('\n');
      return interaction.reply({ files: [makeFile('categories.csv', content)], flags: ephemeral ? MessageFlags.Ephemeral : undefined });
    }
    if (format === 'json') {
      content = JSON.stringify(cats, null, 2);
      return interaction.reply({ files: [makeFile('categories.json', content)], flags: ephemeral ? MessageFlags.Ephemeral : undefined });
    }
    const rows = [['CATEGORY', 'ID'], ...cats.map(c => [c.name, c.id])];
    return maybeReplyBig(interaction, toTable(rows), 'categories.txt', ephemeral);
  }
}