// ============= src/services/sporebox-service.js =============
import { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } from 'discord.js';

// Read needed envs once
const CFG = {
  sporeBoxId: process.env.SPORE_BOX_CHANNEL_ID,           
  sporehallId: process.env.SPOREHALL_CHANNEL_ID,          
  hostRoleId: process.env.HOST_ALERT_ROLE_ID || '',       
  ttlSec: Number(process.env.SPOREBOX_WELCOME_TTL_SEC || 900),
  
  // Roles
  lgbtqRoleId: process.env.ROLE_LGBTQ || '',
  allyRoleId: process.env.ROLE_ALLY || '',
  straySporeRoleId: process.env.STRAY_SPORE_ROLE_ID || '',

  // Base roles: if a user already has one, we skip the Spore Box welcome
  baseMem: process.env.ROLE_BASE_MEMBER || '',
  baseOff: process.env.ROLE_BASE_OFFICER || '',
  baseVet: process.env.ROLE_BASE_VETERAN || '',
};

function hasBaseTier(member) {
  const ids = [CFG.baseMem, CFG.baseOff, CFG.baseVet].filter(Boolean);
  return ids.some(id => member.roles.cache.has(id));
}

function createVisitorDecree() {
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
    new ButtonBuilder()
      .setCustomId('visitor:flair:lgbt')
      .setLabel('🌈 LGBTQIA2S+')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('visitor:flair:ally')
      .setLabel('🤝 Ally')
      .setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row] };
}

function welcomeText(member) {
  const hall = CFG.sporehallId ? `<#${CFG.sporehallId}>` : 'the waiting hall';
  return [
    `**Welcome, ${member}!** You've entered as an invited guest.`,
    `Please sign the Visitor Decree below to declare your identity and receive access.`,
    `After signing, go to ${hall} and wait for your host.`,
    `Tip: inside ${hall} you can use **/vc** to be escorted to your host's War Chamber.`,
    `*Stray Spores are swept at dawn if not rooted.*`
  ].join('\n');
}

export function initSporeBoxService(client) {
  if (!CFG.sporeBoxId) {
    console.warn('[sporebox] SPORE_BOX_CHANNEL_ID not set — service disabled.');
    return;
  }

  // Handle flair selection buttons
  client.on(Events.InteractionCreate, async (ix) => {
    try {
      if (!ix.isButton()) return;
      
      // Handle visitor flair buttons
      if (ix.customId === 'visitor:flair:lgbt' || ix.customId === 'visitor:flair:ally') {
        if (ix.channelId !== CFG.sporeBoxId) {
          return ix.reply({ content: 'Please use the visitor decree in Spore Box.', flags: MessageFlags.Ephemeral });
        }

        const member = await ix.guild.members.fetch(ix.user.id);
        const flavor = ix.customId.endsWith('lgbt') ? 'lgbt' : 'ally';
        
        // Check if already has flair
        const hasLgbt = CFG.lgbtqRoleId && member.roles.cache.has(CFG.lgbtqRoleId);
        const hasAlly = CFG.allyRoleId && member.roles.cache.has(CFG.allyRoleId);
        
        if (hasLgbt || hasAlly) {
          return ix.reply({
            content: 'You already carry a flair. If you need it changed, ping a Steward.',
            flags: MessageFlags.Ephemeral,
          });
        }

        // Add appropriate flair role
        const flairRoleId = flavor === 'lgbt' ? CFG.lgbtqRoleId : CFG.allyRoleId;
        if (flairRoleId) {
          console.log(`Adding flair role ${flairRoleId} to ${member.user.tag}`);
          await member.roles.add(flairRoleId).catch(console.error);
        }

        // Add Stray Spore role
        if (CFG.straySporeRoleId) {
          console.log(`Adding Stray Spore role ${CFG.straySporeRoleId} to ${member.user.tag}`);
          await member.roles.add(CFG.straySporeRoleId).catch(console.error);
        }

        const hall = CFG.sporehallId ? `<#${CFG.sporehallId}>` : 'the waiting hall';
        const flairName = flavor === 'lgbt' ? 'LGBTQIA2S+' : 'Ally';
        
        return ix.reply({
          content: [
            `✅ **Decree signed as ${flairName}!**`,
            `🌿 You are now a Stray Spore.`,
            ``,
            `**Next step:** Go to ${hall} and wait for your host.`,
            `You can use **/vc** there to join your host's War Chamber directly.`,
          ].join('\n'),
          flags: MessageFlags.Ephemeral,
        });
      }

      // Handle host ping button
      if (ix.customId?.startsWith('sporebox:host:')) {
        const [, , userId] = ix.customId.split(':');
        if (userId !== ix.user.id) {
          return ix.reply({ content: 'This button is not for you.', flags: MessageFlags.Ephemeral });
        }

        const ch = ix.guild.channels.cache.get(CFG.sporeBoxId);
        if (!ch?.isTextBased()) {
          return ix.reply({ content: 'Host line is unavailable right now.', flags: MessageFlags.Ephemeral });
        }

        const mention = CFG.hostRoleId ? `<@&${CFG.hostRoleId}>` : '@here';
        await ch.send(`${mention} ${ix.user} is ready for onboarding in Spore Box.`).catch(() => {});
        return ix.reply({ content: '✨ A host has been pinged. Someone will greet you shortly!', flags: MessageFlags.Ephemeral });
      }
    } catch (e) {
      if (!ix.replied && !ix.deferred) ix.reply({ content: '⚠️ Something went wrong.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  });

  // Welcome new guests (who don't already have a base tier)
  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      if (member.user.bot) return;
      if (hasBaseTier(member)) return; // mapped codes get a base role; skip the guest welcome

      const ch = member.guild.channels.cache.get(CFG.sporeBoxId);
      if (!ch?.isTextBased()) return;

      // Send welcome message with visitor decree
      const welcomeMsg = await ch.send({
        content: welcomeText(member),
        ...createVisitorDecree(),
      }).catch(() => null);

      if (welcomeMsg && CFG.ttlSec > 0) {
        setTimeout(() => welcomeMsg.delete().catch(() => {}), CFG.ttlSec * 1000);
      }

      console.log('[sporebox] greeted', member.user.tag, 'in', `#${ch.name}`);
    } catch (e) {
      console.warn('[sporebox] error:', e?.message);
    }
  });

  console.log('[sporebox] service initialized');
}