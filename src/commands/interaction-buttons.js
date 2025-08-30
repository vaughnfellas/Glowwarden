// ============= src/events/interaction-buttons.js =============
import { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { config } from '../config.js';

const id = v => v && /^\d+$/.test(String(v)) ? String(v) : null;

const roles = () => ({
  flairL: id(config.ROLE_LGBTQ),
  flairA: id(config.ROLE_ALLY),
  baseMem: id(config.ROLE_BASE_MEMBER),
  baseOff: id(config.ROLE_BASE_OFFICER),
  baseVet: id(config.ROLE_BASE_VETERAN),
  final: {
    'mem:lgbt': id(config.ROLE_FINAL_MYCE),
    'mem:ally': id(config.ROLE_FINAL_GALLIES),
    'off:lgbt': id(config.ROLE_FINAL_GCRUS),
    'off:ally': id(config.ROLE_FINAL_BBEAR),
    'vet:lgbt': id(config.ROLE_FINAL_RAPO),
    'vet:ally': id(config.ROLE_FINAL_RALLYLT),
  },
});

function sceneText({ userMention, tier, flavor }) {
  const lines = [];
  lines.push(`📜 **Narrator:** Attendants guide ${userMention} through a hidden door of living bark. Candles stir; the spore-song hums.`);

  if (tier === 'mem' && flavor === 'lgbt') {
    lines.push('A chamber draped in rainbow moss welcomes you. Mushroom-folk pour shimmering spore-tea as fragrant smoke curls through the air. Saint Fungus and Geebus drift by with warm smiles. ☕');
    lines.push('Tap **Accept Oath** to seal your mantle as **Mycelioglitter**.');
  } else if (tier === 'mem' && flavor === 'ally') {
    lines.push('Lantern-light and cushions await. Companions beckon you to sit, share tea, and breathe easy among friends. Saint Fungus raises a mug; Geebus offers a pipe with a wink. ☕');
    lines.push('Tap **Accept Oath** to join the ranks of the **Glitter Allies**.');
  } else if (tier === 'off' && flavor === 'lgbt') {
    lines.push('A spore-scribe unfurls a scroll. Ink shimmers as your name is inscribed. Saint Fungus clasps a cloak of woven rainbow threads; Geebus pins a radiant brooch.');
    lines.push('Tap **Accept Oath** to rise as a **Glitter Crusader**.');
  } else if (tier === 'off' && flavor === 'ally') {
    lines.push('Heralds unfurl a resplendent standard as your vows are entered in the ledger. Saint Fungus sets a starlit mantle upon you; Geebus lays a medallion at your breast.');
    lines.push('Tap **Accept Oath** to be sworn as a **Banner Bearer**.');
  } else if (tier === 'vet' && flavor === 'lgbt') {
    lines.push('Torches roar as you kneel upon the moss-stone floor. Saint Fungus raises a crystal-tipped staff; Geebus rests a hand upon your shoulder.');
    lines.push('Tap **Accept Oath** to stand as a **Rainbow Apostle**.');
  } else if (tier === 'vet' && flavor === 'ally') {
    lines.push('You are called before the gathered host. Names and deeds are spoken with reverence. Arms encircle you in warm embrace, voices rise in praise.');
    lines.push('Tap **Accept Oath** to take up the mantle of **Rainbow Ally Lieutenant**.');
  } else {
    lines.push('Your path will be recognized upon oath. Tap **Accept Oath** to proceed.');
  }

  return lines.join('\n');
}

export const name = Events.InteractionCreate;
export const once = false;

export async function execute(interaction) {
  try {
    if (!interaction.isButton()) return;

    // Guard: wrong channel -> ephemeral reply (avoid timeouts)
    if (interaction.channelId !== String(config.DECREE_CHANNEL_ID)) {
      return interaction.reply({ ephemeral: true, content: 'Please use the decree in the Chamber of Oaths.' });
    }

    // Flair selection
    if (interaction.customId === 'flair:lgbt' || interaction.customId === 'flair:ally') {
      const { flairL, flairA, baseMem, baseOff, baseVet } = roles();
      const member = await interaction.guild.members.fetch(interaction.user.id);

      // 🔒 Flair lock — if user already has 🌈 or 🤝, don't let them re-sign
      if ((flairL && member.roles.cache.has(flairL)) || (flairA && member.roles.cache.has(flairA))) {
        return interaction.reply({
          ephemeral: true,
          content: 'You already carry a flair (🌈 or 🤝). If you need it changed, ping a Steward.',
        });
      }

      const flavor = interaction.customId.endsWith('lgbt') ? 'lgbt' : 'ally';
      const flairId = flavor === 'lgbt' ? flairL : flairA;
      if (flairId) await member.roles.add(flairId).catch(() => {});

      // Add Stray Spore role
      if (config.STRAY_SPORE_ROLE_ID) {
        await member.roles.add(config.STRAY_SPORE_ROLE_ID).catch(() => {});
      }

      const tier =
        (baseVet && member.roles.cache.has(baseVet)) ? 'vet' :
        (baseOff && member.roles.cache.has(baseOff)) ? 'off' :
        'mem';

      // Create go-to-sporehall message
      const goText = config.SPOREHALL_CHANNEL_ID ? 
        `🍄🍄 **YOU MUST GO TO <#${config.SPOREHALL_CHANNEL_ID}>** 🍄🍄\n` +
        `🌿 Welcome, Stray Spore.\n\n` +
        `Please wait patiently — your host will come to pluck you from <#${config.SPOREHALL_CHANNEL_ID}>.\n` +
        `If you find your roots itch with impatience, you may also call upon **/vc** inside the hall\n` +
        `and choose your host to be guided straight to their War Chamber.\n\n` +
        `🌙 Until then, remain still and mindful. Your journey will begin soon.\n\n` +
        `🌿 The roots of the Empire welcome you — be still, and you will be guided.\n` +
        `(you can click <#${config.SPOREHALL_CHANNEL_ID}> in any message to jump there)` : '';

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`oath:accept:${interaction.user.id}:${tier}:${flavor}`)
          .setLabel('🗡️ Accept Oath')
          .setStyle(ButtonStyle.Success)
      );

      return interaction.reply({
        content: sceneText({ userMention: member.toString(), tier, flavor }) + (goText ? `\n\n${goText}` : ''),
        components: [row],
        ephemeral: true,
      });
    }

    // Oath acceptance
    if (interaction.customId.startsWith('oath:accept:')) {
      const [, , userId, tier, flavor] = interaction.customId.split(':');
      if (userId !== interaction.user.id) {
        return interaction.reply({ ephemeral: true, content: 'This oath is not yours.' });
      }

      const { baseMem, baseOff, baseVet, final } = roles();
      const member = await interaction.guild.members.fetch(interaction.user.id);

      const key = `${tier}:${flavor}`;
      const finalRole = final[key];
      if (!finalRole) {
        return interaction.reply({ ephemeral: true, content: 'I could not determine your mantle. Ask a Steward.' });
      }

      await member.roles.add(finalRole).catch(() => {});
      if (String(config.CEREMONY_REMOVE_BASE_ON_FINAL).toLowerCase() === 'true') {
        for (const r of [baseMem, baseOff, baseVet]) {
          if (r && member.roles.cache.has(r)) await member.roles.remove(r).catch(() => {});
        }
      }

      const welcomes = {
        'mem:lgbt': `**Welcome to the Holy Gehy Empire, Mycelioglitter, ${member}!**`,
        'mem:ally': `**Welcome to the Holy Gehy Empire, Glitter Ally, ${member}!**`,
        'off:lgbt': `**Welcome to the Holy Gehy Empire, Glitter Crusader, ${member}!**`,
        'off:ally': `**Welcome to the Holy Gehy Empire, Banner Bearer, ${member}!**`,
        'vet:lgbt': `**Welcome to the Holy Gehy Empire, Rainbow Apostle, ${member}!**`,
        'vet:ally': `**Welcome to the Holy Gehy Empire, Rainbow Ally Lieutenant, ${member}!**`,
      };

      return interaction.update({
        content: `✅ Your oath is sealed.\n${welcomes[key]}`,
        components: [],
      });
    }
  } catch (err) {
    console.error('interaction error:', err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ ephemeral: true, content: '⚠️ Something went wrong with this interaction.' }).catch(() => {});
    }
  }
}