import { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const id = v => v && /^\d+$/.test(String(v)) ? String(v) : null;

const roles = () => ({
  flairL: id(process.env.ROLE_LGBTQ),
  flairA: id(process.env.ROLE_ALLY),
  baseMem: id(process.env.ROLE_BASE_MEMBER),
  baseOff: id(process.env.ROLE_BASE_OFFICER),
  baseVet: id(process.env.ROLE_BASE_VETERAN),
  final: {
    'mem:lgbt': id(process.env.ROLE_FINAL_MYCE),
    'mem:ally': id(process.env.ROLE_FINAL_GALLIES),
    'off:lgbt': id(process.env.ROLE_FINAL_GCRUS),
    'off:ally': id(process.env.ROLE_FINAL_BBEAR),
    'vet:lgbt': id(process.env.ROLE_FINAL_RAPO),
    'vet:ally': id(process.env.ROLE_FINAL_RALLYLT),
  },
});

function tierName(t) { return t === 'vet' ? 'Veteran' : t === 'off' ? 'Officer' : 'Member'; }

function sceneText({ userMention, tier, flavor }) {
  const lines = [];

  // shared entrance flourish
  lines.push(`📜 **Narrator:** Attendants guide ${userMention} through a hidden door of living bark. Candles stir; the spore-song hums.`);

  if (tier === 'mem' && flavor === 'lgbt') {
    lines.push('A chamber draped in rainbow moss welcomes you. Mushroom-folk pour shimmering spore-tea as fragrant smoke curls through the air. Saint Fungus and Geebus drift by with warm smiles. ☕');
    lines.push('Tap **Accept Oath** to seal your mantle as **Mycelioglitter**.');
  } else if (tier === 'mem' && flavor === 'ally') {
    lines.push('Lantern-light and cushions await. Companions beckon you to sit, share tea, and breathe easy among friends. Saint Fungus raises a mug; Geebus offers a pipe with a wink. ☕');
    lines.push('Tap **Accept Oath** to join the ranks of the **Glitter Allies**.');
  } else if (tier === 'off' && flavor === 'lgbt') {
    lines.push('A spore-scribe unfurls a scroll. Ink shimmers as your name is inscribed. Saint Fungus clasps a cloak of woven rainbow threads about your shoulders; Geebus pins a radiant brooch.');
    lines.push('Tap **Accept Oath** to rise as a **Glitter Crusader**.');
  } else if (tier === 'off' && flavor === 'ally') {
    lines.push('Heralds unfurl a resplendent standard as your vows are entered in the ledger. Saint Fungus sets a starlit mantle upon you; Geebus lays a medallion at your breast.');
    lines.push('Tap **Accept Oath** to be sworn as a **Banner Bearer**.');
  } else if (tier === 'vet' && flavor === 'lgbt') {
    lines.push('Torches roar as you kneel upon the moss-stone floor. Saint Fungus raises a crystal-tipped staff; Geebus rests a hand upon your shoulder. The hall holds its breath.');
    lines.push('Tap **Accept Oath** to stand as a **Rainbow Apostle**.');
  } else if (tier === 'vet' && flavor === 'ally') {
    lines.push('You are called before the gathered host. Names and deeds are spoken with reverence. Arms encircle you in warm embrace, voices rise in praise.');
    lines.push('Tap **Accept Oath** to take up the mantle of **Rainbow Ally Lieutenant**.');
  } else {
    // fallback if somehow base role not present yet
    lines.push('Your path will be recognized upon oath. Tap **Accept Oath** to proceed.');
  }

  return lines.join('\n');
}

export default {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isButton()) return;

    // flair pick
    if (interaction.customId === 'flair:lgbt' || interaction.customId === 'flair:ally') {
      if (interaction.channelId !== String(process.env.DECREE_CHANNEL_ID)) return;

      const { flairL, flairA, baseMem, baseOff, baseVet } = roles();
      const member = await interaction.guild.members.fetch(interaction.user.id);

      const flavor = interaction.customId.endsWith('lgbt') ? 'lgbt' : 'ally';
      const flairId = flavor === 'lgbt' ? flairL : flairA;
      if (flairId) await member.roles.add(flairId).catch(()=>{});

      const isMem = baseMem && member.roles.cache.has(baseMem);
      const isOff = baseOff && member.roles.cache.has(baseOff);
      const isVet = baseVet && member.roles.cache.has(baseVet);
      const tier = isVet ? 'vet' : isOff ? 'off' : isMem ? 'mem' : 'mem'; // default to member if none yet

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`oath:accept:${interaction.user.id}:${tier}:${flavor}`)
          .setLabel('🗡️ Accept Oath')
          .setStyle(ButtonStyle.Success)
      );

      return interaction.reply({
        content: sceneText({ userMention: member.toString(), tier, flavor }),
        components: [row],
        ephemeral: true
      });
    }

    // oath accept
    if (interaction.customId.startsWith('oath:accept:')) {
      const [, , userId, tier, flavor] = interaction.customId.split(':');
      if (userId !== interaction.user.id) {
        return interaction.reply({ ephemeral: true, content: 'This oath is not yours.' });
      }

      const { baseMem, baseOff, baseVet, final } = roles();
      const member = await interaction.guild.members.fetch(interaction.user.id);

      const key = `${tier}:${flavor}`;
      const finalRole = final[key];
      if (!finalRole) return interaction.reply({ ephemeral: true, content: 'I could not determine your mantle. Ask a Steward.' });

      await member.roles.add(finalRole).catch(()=>{});

      if (String(process.env.CEREMONY_REMOVE_BASE_ON_FINAL).toLowerCase() === 'true') {
        for (const r of [baseMem, baseOff, baseVet]) {
          if (r && member.roles.cache.has(r)) await member.roles.remove(r).catch(()=>{});
        }
      }

      // personal welcome
      const welcomes = {
        'mem:lgbt': `**Welcome to the Holy Gehy Empire, Mycelioglitter, ${member}!**`,
        'mem:ally': `**Welcome to the Holy Gehy Empire, Glitter Ally, ${member}!**`,
        'off:lgbt': `**Welcome to the Holy Gehy Empire, Glitter Crusader, ${member}!**`,
        'off:ally': `**Welcome to the Holy Gehy Empire, Banner Bearer, ${member}!**`,
        'vet:lgbt': `**Welcome to the Holy Gehy Empire, Rainbow Apostle, ${member}!**`,
        'vet:ally': `**Welcome to the Holy Gehy Empire, Rainbow Ally Lieutenant, ${member}!**`,
      };

      return interaction.update({ content: `✅ Your oath is sealed.\n${welcomes[key]}`, components: [] });
    }
  }
};
