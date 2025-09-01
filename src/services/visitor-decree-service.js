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

const CFG = {
  sporeBoxId: CHANNELS.SPORE_BOX,
  sporehallId: CHANNELS.SPOREHALL,
  lgbtqRoleId: process.env.ROLE_LGBTQ || '',
  allyRoleId: process.env.ROLE_ALLY || '',
  straySporeRoleId: process.env.STRAY_SPORE_ROLE_ID || '',
};

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
  if (!CFG.sporeBoxId) return null;
  const ch = await client.channels.fetch(CFG.sporeBoxId).catch(() => null);
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

// --- Handle button interactions for the decree
export async function handleDecreeInteraction(interaction) {
  const { customId, member } = interaction;
  
  // Handle flair role assignment
  if (customId === 'flair:lgbt' || customId === 'flair:ally') {
    const roleId = customId === 'flair:lgbt' ? CFG.lgbtqRoleId : CFG.allyRoleId;
    const roleName = customId === 'flair:lgbt' ? 'LGBTQIA2S+' : 'Ally';
    
    // Add the selected flair role
    if (roleId) {
      try {
        await member.roles.add(roleId);
      } catch (err) {
        console.error(`[decree] Failed to add ${roleName} role:`, err);
        await interaction.reply({ 
          content: `⚠️ Failed to assign ${roleName} role. Please contact a moderator.`, 
          ephemeral: true 
        });
        return;
      }
    }
    
    // Add the Stray Spore role
    if (CFG.straySporeRoleId) {
      try {
        await member.roles.add(CFG.straySporeRoleId);
      } catch (err) {
        console.error('[decree] Failed to add Stray Spore role:', err);
      }
    }
    
    // Send success message with next steps
    const hall = CFG.sporehallId ? `<#${CFG.sporehallId}>` : 'the waiting hall';
    await interaction.reply({
      content: [
        `✅ **Welcome to the Empire!** You've been marked as a **${roleName}**.`,
        `Please proceed to ${hall} and wait for your host.`,
        `You can use **/vc** in ${hall} to be escorted to your host's War Chamber.`,
        `*Stray Spores are swept at dawn if not rooted.*`
      ].join('\n'),
      ephemeral: true
    });
  }
}

// --- Initialize the service
export function initVisitorDecreeService(client) {
  console.log('[decree] Visitor Decree service initialized');
  
  // Ensure the decree is pinned
  ensureVisitorDecreePinned(client).catch(err =>
    console.warn('[decree] ensureVisitorDecreePinned:', err?.message || err)
  );
  
  // Set up the interaction handler
  client.on('interactionCreate', interaction => {
    if (!interaction.isButton()) return;
    
    const { customId } = interaction;
    if (customId.startsWith('flair:')) {
      handleDecreeInteraction(interaction).catch(err => 
        console.error('[decree] Error handling decree interaction:', err)
      );
    }
  });
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
