// ============= src/events/interaction-buttons.js =============
import { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { CHANNELS } from '../channels.js';
import { config } from '../config.js';
import { sendOathCompletionDM } from '../services/oath-completion-service.js';
import { createAddAltModal } from '../commands/addalt.js';
import { CharacterDB } from '../database/characters.js';

const id = v => (v && /^\d+$/.test(String(v))) ? String(v) : null;

const roles = () => ({
  flairL:  id(config.ROLE_LGBTQ),
  flairA:  id(config.ROLE_ALLY),
  stray:   id(config.STRAY_SPORE_ROLE_ID),
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

function sceneText({ userMention, tier, flavor, characterName, characterClass }) {
  const lines = [];
  const nameWithClass = characterClass ? `${characterName}, ${characterClass}` : characterName;
  
  lines.push(`📜 **Narrator:** Attendants guide ${userMention} through a hidden door of living bark. Candles stir; the spore-song hums.`);
  lines.push(`*"${nameWithClass} approaches the sacred chamber..."*`);

  if (tier === 'mem' && flavor === 'lgbt') {
    lines.push('A chamber draped in rainbow moss welcomes you. Mushroom-folk pour shimmering spore-tea as fragrant smoke curls through the air. Saint Fungus and Geebus drift by with warm smiles. ☕');
    lines.push(`Tap **Accept Oath** to seal your mantle as **Mycelioglitter ${characterName}**.`);
  } else if (tier === 'mem' && flavor === 'ally') {
    lines.push('Lantern-light and cushions await. Companions beckon you to sit, share tea, and breathe easy among friends. Saint Fungus raises a mug; Geebus offers a pipe with a wink. ☕');
    lines.push(`Tap **Accept Oath** to join the ranks of the **Glitter Allies** as **${characterName}**.`);
  } else if (tier === 'off' && flavor === 'lgbt') {
    lines.push('A spore-scribe unfurls a scroll. Ink shimmers as your name is inscribed. Saint Fungus clasps a cloak of woven rainbow threads; Geebus pins a radiant brooch.');
    lines.push(`Tap **Accept Oath** to rise as **Glitter Crusader ${characterName}**.`);
  } else if (tier === 'off' && flavor === 'ally') {
    lines.push('Heralds unfurl a resplendent standard as your vows are entered in the ledger. Saint Fungus sets a starlit mantle upon you; Geebus lays a medallion at your breast.');
    lines.push(`Tap **Accept Oath** to be sworn as **Banner Bearer ${characterName}**.`);
  } else if (tier === 'vet' && flavor === 'lgbt') {
    lines.push('Torches roar as you kneel upon the moss-stone floor. Saint Fungus raises a crystal-tipped staff; Geebus rests a hand upon your shoulder.');
    lines.push(`Tap **Accept Oath** to stand as **Rainbow Apostle ${characterName}**.`);
  } else if (tier === 'vet' && flavor === 'ally') {
    lines.push('You are called before the gathered host. Names and deeds are spoken with reverence. Arms encircle you in warm embrace, voices rise in praise.');
    lines.push(`Tap **Accept Oath** to take up the mantle of **Rainbow Ally Lieutenant ${characterName}**.`);
  } else {
    lines.push(`Your path as **${characterName}** will be recognized upon oath. Tap **Accept Oath** to proceed.`);
  }

  return lines.join('\n');
}

export const name = Events.InteractionCreate;
export const once = false;

export async function execute(interaction) {
  try {
    if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) return;

    const isFlair = interaction.customId === 'flair:lgbt' || interaction.customId === 'flair:ally';
    const isClassSelect = interaction.customId?.startsWith('class_select:');
    const isAddAltClassSelect = interaction.customId?.startsWith('addalt_class:');
    const isCharacterModal = interaction.customId?.startsWith('character_modal:');
    const isAddAltModal = interaction.customId?.startsWith('addalt_modal:');
    const isOath = interaction.customId?.startsWith('oath:accept:');
    
    if (!isFlair && !isClassSelect && !isAddAltClassSelect && !isCharacterModal && !isAddAltModal && !isOath) return;

    const inSporeBox = CHANNELS.SPORE_BOX && String(interaction.channelId) === String(CHANNELS.SPORE_BOX);
    const inOaths = CHANNELS.CHAMBER_OF_OATHS && String(interaction.channelId) === String(CHANNELS.CHAMBER_OF_OATHS);

    // Handle initial flair button click - show class selection for oath ceremony
    if (isFlair) {
      const { flairL, flairA } = roles();
      const member = await interaction.guild.members.fetch(interaction.user.id);

      // Check if already signed
      const alreadyFlair =
        (flairL && member.roles.cache.has(flairL)) ||
        (flairA && member.roles.cache.has(flairA));
      if (alreadyFlair) {
        return interaction.reply({
          content: 'You've already signed the decree (you carry a flair). If you need it changed, ping a Steward.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const flavor = interaction.customId.endsWith('lgbt') ? 'lgbt' : 'ally';
      
      // Import the class select menu from decree.js
      const { createClassSelectMenu } = await import('../commands/decree.js');
      const classMenu = createClassSelectMenu(flavor);
      
      return interaction.reply({
        content: '⚔️ **Choose your class, champion!**\n*Select your class from the menu below, then you\'ll enter your character details.*',
        components: [classMenu],
        flags: MessageFlags.Ephemeral,
      });
    }

    // Handle class selection for oath ceremony
    if (isClassSelect) {
      const flavor = interaction.customId.split(':')[1];
      const selectedClass = interaction.values[0];
      
      const { createCharacterNameModal } = await import('../commands/decree.js');
      const modal = createCharacterNameModal(flavor, selectedClass);
      
      return interaction.showModal(modal);
    }

    // Handle addalt class selection (separate from oath)
    if (isAddAltClassSelect) {
      const userId = interaction.customId.split(':')[1];
      if (userId !== interaction.user.id) {
        return interaction.reply({ content: 'This is not your character creation.', flags: MessageFlags.Ephemeral });
      }

      const selectedClass = interaction.values[0];
      const modal = createAddAltModal(selectedClass, userId);
      
      return interaction.showModal(modal);
    }

    // Handle oath ceremony character modal submission
    if (isCharacterModal) {
      const parts = interaction.customId.split(':');
      const flavor = parts[1];
      const selectedClass = parts[2];
      const characterName = interaction.fields.getTextInputValue('character_name').trim();
      const characterRealm = interaction.fields.getTextInputValue('character_realm')?.trim() || '';

      const characterClass = selectedClass === 'none' ? '' : selectedClass;

      // Validate character name
      const nameRegex = /^[a-zA-ZÀ-ÿ\s'\-]+$/;
      if (!nameRegex.test(characterName)) {
        return interaction.reply({
          content: '⛔ Character names can only contain letters, spaces, apostrophes, and hyphens.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const { flairL, flairA, stray, baseMem, baseOff, baseVet } = roles();
      const member = await interaction.guild.members.fetch(interaction.user.id);

      // Set nickname and flair role
      try {
        await member.setNickname(characterName);
        const flairId = flavor === 'lgbt' ? flairL : flairA;
        if (flairId) await member.roles.add(flairId).catch(() => {});

        // Also save this as their first character in the database
        const charClass = characterClass || null;
        const realm = characterRealm || null;
        
        if (!CharacterDB.characterExists(member.user.id, characterName)) {
          CharacterDB.addCharacter(member.user.id, characterName, charClass, realm, true); // First character is main
        }
      } catch (error) {
        console.error('Failed to set nickname:', error);
        // Continue anyway - the role assignment is more important
      }

      // Check if they have base roles
      const hasBase =
        (baseVet && member.roles.cache.has(baseVet)) ||
        (baseOff && member.roles.cache.has(baseOff)) ||
        (baseMem && member.roles.cache.has(baseMem));

      // Guest flow (Spore Box OR no base role)
      if (inSporeBox || (!inOaths && !hasBase)) {
        if (stray) await member.roles.add(stray).catch(() => {});
        const hallId = CHANNELS.SPOREHALL;
        const hall = hallId ? `<#${hallId}>` : 'the waiting hall';
        
        const realmText = characterRealm ? ` of ${characterRealm}` : '';
        const classText = characterClass ? `, ${characterClass}` : '';
        
        const msg = [
          `📜 **Decree signed!** Welcome, **${characterName}${classText}${realmText}**!`,
          `You now carry your flair and are a **Stray Spore**.`,
          `Head to ${hall} and wait for your host, or use **/vc** in ${hall} to be escorted to their War Chamber.`,
          `*Unrooted Stray Spores are swept at dawn.*`,
        ].join('\n');
        
        return interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
      }

      // Member flow (Chamber of Oaths with base role)
      if (inOaths && hasBase) {
        const tier = member.roles.cache.has(baseVet) ? 'vet'
                   : member.roles.cache.has(baseOff) ? 'off'
                   : 'mem';

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`oath:accept:${interaction.user.id}:${tier}:${flavor}:${encodeURIComponent(characterName)}:${encodeURIComponent(characterClass || '')}`)
            .setLabel('⚔️ Accept Oath')
            .setStyle(ButtonStyle.Success)
        );

        return interaction.reply({
          content: sceneText({ 
            userMention: member.toString(), 
            tier, 
            flavor, 
            characterName,
            characterClass 
          }),
          components: [row],
          flags: MessageFlags.Ephemeral,
        });
      }

      // Fallback
      return interaction.reply({
        content: 'Please sign where appropriate: guests in **Spore Box**, members in **Chamber of Oaths**.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Handle addalt modal submission
    if (isAddAltModal) {
      const parts = interaction.customId.split(':');
      const userId = parts[1];
      const selectedClass = parts[2];
      
      if (userId !== interaction.user.id) {
        return interaction.reply({ content: 'This is not your character creation.', flags: MessageFlags.Ephemeral });
      }

      const characterName = interaction.fields.getTextInputValue('character_name').trim();
      const characterRealm = interaction.fields.getTextInputValue('character_realm')?.trim() || null;
      const isMainInput = interaction.fields.getTextInputValue('is_main')?.trim().toLowerCase() || '';
      const isMain = isMainInput === 'yes' || isMainInput === 'y' || isMainInput === 'true';

      // Validate name
      const nameRegex = /^[a-zA-ZÀ-ÿ\s'\-]+$/;
      if (!nameRegex.test(characterName)) {
        return interaction.reply({
          content: '⛔ Character names can only contain letters, spaces, apostrophes, and hyphens.',
          flags: MessageFlags.Ephemeral,
        });
      }

      // Check if character already exists
      if (CharacterDB.characterExists(userId, characterName)) {
        return interaction.reply({
          content: `⛔ You already have a character named **${characterName}** registered.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      try {
        // Add character to database
        const characterClass = selectedClass === 'none' ? null : selectedClass;
        CharacterDB.addCharacter(userId, characterName, characterClass, characterRealm, isMain);

        // Get updated character count
        const characters = CharacterDB.getCharacters(userId);

        // Try to set nickname if it's their first character or main
        const member = interaction.member;
        if (characters.length === 1 || isMain) {
          try {
            await member.setNickname(characterName);
          } catch (error) {
            console.error('Failed to set nickname:', error);
          }
        }

        const classText = characterClass ? `, ${characterClass}` : '';
        const realmText = characterRealm ? ` of ${characterRealm}` : '';
        const mainText = isMain ? ' 👑' : '';

        const embed = new EmbedBuilder()
          .setColor(isMain ? 0xFFD700 : 0x8B4513)
          .setTitle('📝 **Character Registered**')
          .setDescription(`
**${characterName}${classText}${realmText}** has been added to your roster!${mainText}

*Total characters: ${characters.length}*

Use \`/switch\` to swap between your characters anytime.
${characters.length === 1 || isMain ? '\n*Your nickname has been updated to reflect this character.*' : ''}
          `)
          .setTimestamp()
          .setFooter({ text: 'For the Empire!' });

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

      } catch (error) {
        console.error('Failed to add character:', error);
        return interaction.reply({
          content: '⛔ Something went wrong adding your character. Try again later.',
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    // Handle oath acceptance (existing code)
    if (isOath) {
      const parts = interaction.customId.split(':');
      const [, , userId, tier, flavor, encodedName, encodedClass] = parts;
      
      if (userId !== interaction.user.id) {
        return interaction.reply({ content: 'This oath is not yours.', flags: MessageFlags.Ephemeral });
      }

      const characterName = decodeURIComponent(encodedName || '');
      const characterClass = decodeURIComponent(encodedClass || '');

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

      const nameWithClass = characterClass ? `${characterName}, ${characterClass}` : characterName;
      const welcomes = {
        'mem:lgbt': `**Welcome to the Holy Gehy Empire, Mycelioglitter ${nameWithClass}!**`,
        'mem:ally': `**Welcome to the Holy Gehy Empire, Glitter Ally ${nameWithClass}!**`,
        'off:lgbt': `**Welcome to the Holy Gehy Empire, Glitter Crusader ${nameWithClass}!**`,
        'off:ally': `**Welcome to the Holy Gehy Empire, Banner Bearer ${nameWithClass}!**`,
        'vet:lgbt': `**Welcome to the Holy Gehy Empire, Rainbow Apostle ${nameWithClass}!**`,
        'vet:ally': `**Welcome to the Holy Gehy Empire, Rainbow Ally Lieutenant ${nameWithClass}!**`,
      };

      return interaction.update({
        content: `✅ **Your oath is sealed.**\n\n${welcomes[key]}\n\n*The spores sing your name, and the Empire grows stronger with your presence.*`,
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