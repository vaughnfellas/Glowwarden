// ============= src/services/visitor-decree-service.js =============
import { 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  PermissionFlagsBits
} from 'discord.js';
import { CHANNELS } from '../channels.js';

// --- Build the decree message with fancy styling
export function buildVisitorDecree() {
  const embed = new EmbedBuilder()
    .setTitle('Visitor Decree — Welcome Traveler')
    .setDescription([
      'Hear the call, wayfarer! You now stand before the radiant banners of the Empire, where Pride is power, spores are sacred, and fellowship endures forever.',
      '',
      '🛡 **The Visitor Decree**',
      '• All are welcome beneath our rainbow standard — LGBTQ+ and Allies alike.',
      '• Heresy of hate shall not pass our gates — bigotry, slurs, or mockery of identity are banishable offenses.',
      '• Honor the fellowship — laughter, respect, and solidarity guide our quests.',
      '',
      'Place your seal upon this decree and declare your truth:',
    ].join('\n'));

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('flair:lgbt').setLabel('🌈 LGBTQIA2S+').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('flair:ally').setLabel('🤝 Ally').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row] };
}

// --- Ensure one decree message is pinned in #spore-box
export async function ensureVisitorDecreePinned(client) {
  if (!CHANNELS.SPORE_BOX) return null;
  const ch = await client.channels.fetch(CHANNELS.SPORE_BOX).catch(() => null);
  if (!ch?.isTextBased?.()) return null;

  const pins = await ch.messages.fetchPinned().catch(() => null);
  const existing = pins?.find(m =>
    m.author?.id === client.user.id &&
    m.embeds?.[0]?.title?.startsWith('Visitor Decree')
  );

  if (existing) return existing;

  const payload = buildVisitorDecree();
  const msg = await ch.send(payload);
  await msg.pin().catch(() => {});
  return msg;
}

// --- Initialize the service (no event listeners - handled by consolidated handler)
export function initVisitorDecreeService(client) {
  console.log('[decree] Visitor Decree service initialized');
  
  // Ensure the decree is pinned
  ensureVisitorDecreePinned(client).catch(err =>
    console.warn('[decree] ensureVisitorDecreePinned:', err?.message || err)
  );
}

// --- Slash command definition for /visitor-decree
export const data = new SlashCommandBuilder()
  .setName('visitor-decree')
  .setDescription('Post the Visitor Decree (for Stray Spores) in this channel.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

// --- Slash command execution handler
export async function execute(interaction) {
  const payload = buildVisitorDecree();
  await interaction.channel.send(payload);
  await interaction.reply({ 
    content: 'Decree posted. Pin it for convenience.', 
    flags: MessageFlags.Ephemeral 
  });
}