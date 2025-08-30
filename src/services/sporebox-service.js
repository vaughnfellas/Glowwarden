// ============= src/services/sporebox-service.js =============
import { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

// Read needed envs once
const CFG = {
  sporeBoxId: process.env.SPORE_BOX_CHANNEL_ID,           // e.g. 1409826854705168515
  sporehallId: process.env.SPOREHALL_CHANNEL_ID,          // e.g. 1409695442308169925
  decreeUrl: process.env.DECREE_JUMP_URL || '',           // message link of your decree
  hostRoleId: process.env.HOST_ALERT_ROLE_ID || '',       // optional role to ping when guest clicks
  ttlSec: Number(process.env.SPOREBOX_WELCOME_TTL_SEC || 900),

  // Base roles: if a user already has one, we skip the Spore Box welcome
  baseMem: process.env.ROLE_BASE_MEMBER || '',
  baseOff: process.env.ROLE_BASE_OFFICER || '',
  baseVet: process.env.ROLE_BASE_VETERAN || '',
};

function hasBaseTier(member) {
  const ids = [CFG.baseMem, CFG.baseOff, CFG.baseVet].filter(Boolean);
  return ids.some(id => member.roles.cache.has(id));
}

function welcomeText(member) {
  const hall = CFG.sporehallId ? `<#${CFG.sporehallId}>` : 'the waiting hall';
  return [
    `**Welcome, ${member}!** You’ve entered as an invited guest.`,
    `Place your seal on the **Decree** (🌈 or 🤝) to unlock the guest halls.`,
    `After you are marked, go to ${hall} and wait for your host.`,
    `Tip: inside ${hall} you can use **/vc** to be escorted to your host’s War Chamber.`,
    `*Stray Spores are swept at dawn if not rooted.*`
  ].join('\n');
}

function actionRowFor(member) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('🌈 Sign the Decree')
      .setStyle(ButtonStyle.Link)
      .setURL(CFG.decreeUrl || `https://discord.com/channels/${member.guild.id}`),
    new ButtonBuilder()
      .setCustomId(`sporebox:host:${member.id}`)
      .setLabel('📣 Ping a Host')
      .setStyle(ButtonStyle.Primary),
  );
}

export function initSporeBoxService(client) {
  if (!CFG.sporeBoxId) {
    console.warn('[sporebox] SPORE_BOX_CHANNEL_ID not set — service disabled.');
    return;
  }

  // Button: guest asked for a host
  client.on(Events.InteractionCreate, async (ix) => {
    try {
      if (!ix.isButton()) return;
      if (!ix.customId?.startsWith('sporebox:host:')) return;

      const [, , userId] = ix.customId.split(':');
      if (userId !== ix.user.id) {
        return ix.reply({ ephemeral: true, content: 'This button isn’t for you.' });
      }

      const ch = ix.guild.channels.cache.get(CFG.sporeBoxId);
      if (!ch?.isTextBased()) {
        return ix.reply({ ephemeral: true, content: 'Host line is unavailable right now.' });
      }

      const mention = CFG.hostRoleId ? `<@&${CFG.hostRoleId}>` : '@here';
      await ch.send(`${mention} ${ix.user} is ready for onboarding in Spore Box.`).catch(() => {});
      return ix.reply({ ephemeral: true, content: '✨ A host has been pinged. Someone will greet you shortly!' });
    } catch (e) {
      if (!ix.replied && !ix.deferred) ix.reply({ ephemeral: true, content: '⚠️ Something went wrong.' }).catch(() => {});
    }
  });

  // Welcome new guests (who don’t already have a base tier)
  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      if (member.user.bot) return;
      if (hasBaseTier(member)) return; // mapped codes get a base role; skip the guest welcome

      const ch = member.guild.channels.cache.get(CFG.sporeBoxId);
      if (!ch?.isTextBased()) return;

      const msg = await ch.send({
        content: welcomeText(member),
        components: [actionRowFor(member)],
      }).catch(() => null);

      if (msg && CFG.ttlSec > 0) {
        setTimeout(() => msg.delete().catch(() => {}), CFG.ttlSec * 1000);
      }

      console.log('[sporebox] greeted', member.user.tag, 'in', `#${ch.name}`);
    } catch (e) {
      console.warn('[sporebox] error:', e?.message);
    }
  });

  console.log('[sporebox] service initialized');
}
