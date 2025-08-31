// ============= src/services/sporebox-service.js =============
import { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } from 'discord.js';
import { CHANNELS } from '../channels.js';

// Read needed envs once
const CFG = {
  sporeBoxId: CHANNELS.SPORE_BOX,           
  sporehallId: CHANNELS.SPOREHALL,          
  hostRoleId: process.env.HOST_ALERT_ROLE_ID || '',       
  ttlSec: Number(process.env.SPOREBOX_WELCOME_TTL_SEC || 900),
  
  // Roles - keeping these for now since they're used in the service
  lgbtqRoleId: process.env.ROLE_LGBTQ || '',
  allyRoleId: process.env.ROLE_ALLY || '',
  straySporeRoleId: process.env.STRAY_SPORE_ROLE_ID || '',
};

function hasFlairRole(member) {
  const flairIds = [CFG.lgbtqRoleId, CFG.allyRoleId].filter(Boolean);
  return flairIds.some(id => member.roles.cache.has(id));
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