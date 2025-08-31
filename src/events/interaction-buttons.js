// ============= src/events/interaction-buttons.js =============
import { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { CHANNELS } from '../channels.js';
import { config } from '../config.js';
import { sendOathCompletionDM } from '../services/oath-completion-service.js';

const id = v => (v && /^\d+$/.test(String(v))) ? String(v) : null;

const roles = () => ({
  flairL:  id(config.ROLE_LGBTQ),
  flairA:  id(config.ROLE_ALLY),
  stray:   id(config.STRAY_SPORE_ROLE_ID), // ← comma was missing before
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

    const isFlair = interaction.customId === 'flair:lgbt' || interaction.customId === 'flair:ally';
    const isOath  = interaction.customId.startsWith('oath:accept:');
    if (!isFlair && !isOath) return;

    // ✅ Use CHANNELS for channel checks
    const inSporeBox = CHANNELS.SPORE_BOX && String(interaction.channelId) === String(CHANNELS.SPORE_BOX);
    const inOaths    = CHANNELS.CHAMBER_OF_OATHS && String(interaction.channelId) === String(CHANNELS.CHAMBER_OF_OATHS);

    if (isFlair) {
      const { flairL, flairA, stray, baseMem, baseOff, baseVet } = roles();
      const member = await interaction.guild.members.fetch(interaction.user.id);

      // 🔒 already signed? (has either flair) -> stop
      const alreadyFlair =
        (flairL && member.roles.cache.has(flairL)) ||
        (flairA && member.roles.cache.has(flairA));
      if (alreadyFlair) {
        return interaction.reply({
          content: 'You’ve already signed the decree (you carry a flair). If you need it changed, ping a Steward.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const flavor  = interaction.customId.endsWith('lgbt') ? 'lgbt' : 'ally';
      const flairId = flavor === 'lgbt' ? flairL : flairA;
      if (flairId) await member.roles.add(flairId).catch(() => {});

      // Are they already a base (member/officer/vet)?
      const hasBase =
        (baseVet && member.roles.cache.has(baseVet)) ||
        (baseOff && member.roles.cache.has(baseOff)) ||
        (baseMem && member.roles.cache.has(baseMem));

      // Guest flow (Spore Box OR no base role): add Stray Spore + directions; no oath
      if (inSporeBox || (!inOaths && !hasBase)) {
        if (stray) await member.roles.add(stray).catch(() => {});
        const hallId = CHANNELS.SPOREHALL;
        const hall   = hallId ? `<#${hallId}>` : 'the waiting hall';
        const msg = [
          `Signed. You now carry your flair and are a **Stray Spore**.`,
          `Head to ${hall} and wait for your host, or use **/vc** in ${hall} to be escorted to their War Chamber.`,
          `*Unrooted Stray Spores are swept at dawn.*`,
        ].join('\n');
        return interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
      }

      // Member flow (Chamber of Oaths with base role): show oath button
      if (inOaths && hasBase) {
        const tier = member.roles.cache.has(baseVet) ? 'vet'
                   : member.roles.cache.has(baseOff) ? 'off'
                   : 'mem';

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`oath:accept:${interaction.user.id}:${tier}:${flavor}`)
            .setLabel('🗡️ Accept Oath')
            .setStyle(ButtonStyle.Success)
        );

        return interaction.reply({
          content: sceneText({ userMention: member.toString(), tier, flavor }),
          components: [row],
          flags: MessageFlags.Ephemeral,
        });
      }

      // Fallback (wrong channel)
      return interaction.reply({
        content: 'Please sign where appropriate: guests in **Spore Box**, members in **Chamber of Oaths**.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Oath acceptance
    if (isOath) {
      const [, , userId, tier, flavor] = interaction.customId.split(':');
      if (userId !== interaction.user.id) {
        return interaction.reply({ content: 'This oath is not yours.', flags: MessageFlags.Ephemeral });
      }

      const { baseMem, baseOff, baseVet, final, stray } = roles();
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
        if (stray && member.roles.cache.has(stray)) {
          await member.roles.remove(stray).catch(() => {});
        }
      }

      await sendOathCompletionDM(member, tier, flavor).catch(() => {});

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
      await interaction.reply({
        content: '⚠️ Something went wrong with this interaction.',
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
    }
  }
}
