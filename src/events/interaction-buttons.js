// ============= src/events/interaction-buttons.js =============
import { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
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

    // These are the only buttons we handle here
    const isFlair = interaction.customId === 'flair:lgbt' || interaction.customId === 'flair:ally';
    const isOath  = interaction.customId.startsWith('oath:accept:');
    if (!isFlair && !isOath) return;

    // Allow clicks in either Chamber of Oaths OR Spore Box
    const allowed = new Set(
      [config.DECREE_CHANNEL_ID, config.SPORE_BOX_CHANNEL_ID].filter(Boolean).map(String)
    );
    if (!allowed.has(interaction.channelId)) {
      return interaction.reply({
        content: 'Please use the decree in the Chamber of Oaths or the pinned decree in Spore Box.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Flair selection
    if (isFlair) {
      const { flairL, flairA, baseMem, baseOff, baseVet } = roles();
      const member = await interaction.guild.members.fetch(interaction.user.id);

      // 🔒 already signed? (has either flair) -> stop
      if ((flairL && member.roles.cache.has(flairL)) || (flairA && member.roles.cache.has(flairA))) {
        return interaction.reply({
          content: 'You already carry a flair (🌈 or 🤝). If you need it changed, ping a Steward.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const flavor = interaction.customId.endsWith('lgbt') ? 'lgbt' : 'ally';
      const flairId = flavor === 'lgbt' ? flairL : flairA;

      // Add flair role
      if (flairId) await member.roles.add(flairId).catch(console.error);

      // Add Stray Spore role (if configured)
      if (config.STRAY_SPORE_ROLE_ID) {
        await member.roles.add(config.STRAY_SPORE_ROLE_ID).catch(console.error);
      }

      const tier =
        (baseVet && member.roles.cache.has(baseVet)) ? 'vet' :
        (baseOff && member.roles.cache.has(baseOff)) ? 'off' :
        'mem';

      const goText = config.SPOREHALL_CHANNEL_ID
        ? `🍄🍄 **YOU MUST GO TO <#${config.SPOREHALL_CHANNEL_ID}>** 🍄🍄
🌿 Welcome, Stray Spore.

Please wait patiently – your host will come to pluck you from <#${config.SPOREHALL_CHANNEL_ID}>.
If you find your roots itch with impatience, you may also call upon **/vc** inside the hall
and choose your host to be guided straight to their War Chamber.

🌙 Until then, remain still and mindful. Your journey will begin soon.

🌿 The roots of the Empire welcome you – be still, and you will be guided.
(you can click <#${config.SPOREHALL_CHANNEL_ID}> in any message to jump there)`
        : '';

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`oath:accept:${interaction.user.id}:${tier}:${flavor}`)
          .setLabel('🗡️ Accept Oath')
          .setStyle(ButtonStyle.Success)
      );

      return interaction.reply({
        content: sceneText({ userMention: member.toString(), tier, flavor }) + (goText ? `\n\n${goText}` : ''),
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
    }

    // Oath acceptance
    if (isOath) {
      const [, , userId, tier, flavor] = interaction.customId.split(':');
      if (userId !== interaction.user.id) {
        return interaction.reply({ content: 'This oath is not yours.', flags: MessageFlags.Ephemeral });
      }

      const { baseMem, baseOff, baseVet, final } = roles();
      const member = await interaction.guild.members.fetch(interaction.user.id);

      const key = `${tier}:${flavor}`;
      const finalRole = final[key];
      if (!finalRole) {
        return interaction.reply({ content: 'I could not determine your mantle. Ask a Steward.', flags: MessageFlags.Ephemeral });
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
      await interaction.reply({ content: '⚠️ Something went wrong with this interaction.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
}
