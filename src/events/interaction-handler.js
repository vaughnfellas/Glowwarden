// ============= src/events/interaction-handler.js =============
import { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } from 'discord.js';
import { CHANNELS } from '../channels.js';
import { config } from '../config.js';
import { sendOathCompletionDM } from '../services/oath-completion-service.js';
import { CharacterDB } from '../database/characters.js';
import * as addaltCommand from '../commands/addalt.js';

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

// Create character name collection modal for Chamber of Oaths
function createCharacterNameModal(flavor) {
  const modal = new ModalBuilder()
    .setCustomId(`character_modal:${flavor}`)
    .setTitle('🏰 Sign the Imperial Decree');

  const characterInput = new TextInputBuilder()
    .setCustomId('character_name')
    .setLabel('Your WoW Character Name')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Enter your character\'s name (e.g., Thrall, Jaina)')
    .setRequired(true)
    .setMaxLength(32);

  const classInput = new TextInputBuilder()
    .setCustomId('character_class')
    .setLabel('Character Class (Optional)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Death Knight, Mage, Warrior, etc.')
    .setRequired(false)
    .setMaxLength(20);

  const realmInput = new TextInputBuilder()
    .setCustomId('character_realm')
    .setLabel('Realm (Optional)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Stormrage, Tichondrius, etc.')
    .setRequired(false)
    .setMaxLength(30);

  const firstRow = new ActionRowBuilder().addComponents(characterInput);
  const secondRow = new ActionRowBuilder().addComponents(classInput);
  const thirdRow = new ActionRowBuilder().addComponents(realmInput);

  modal.addComponents(firstRow, secondRow, thirdRow);
  return modal;
}

// Create class selection for oath ceremony
function createClassSelection(userId) {
  const classes = [
    'Death Knight', 'Demon Hunter', 'Druid', 'Evoker', 'Hunter', 'Mage',
    'Monk', 'Paladin', 'Priest', 'Rogue', 'Shaman', 'Warlock', 'Warrior'
  ];

  const embed = new EmbedBuilder()
    .setTitle('🎭 Choose Your Class')
    .setDescription('Select your character\'s class to complete the oath ceremony:')
    .setColor(0x8B4513);

  const options = classes.map(cls => ({ label: cls, value: cls.toLowerCase().replace(' ', '') }));
  options.push({ label: 'No Class/Other', value: 'none' });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`class_select:${userId}`)
    .setPlaceholder('Choose your class...')
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(selectMenu);
  return { embeds: [embed], components: [row] };
}

function determineUserTier(member) {
  const r = roles();
  if (r.baseVet && member.roles.cache.has(r.baseVet)) return 'vet';
  if (r.baseOff && member.roles.cache.has(r.baseOff)) return 'off';
  if (r.baseMem && member.roles.cache.has(r.baseMem)) return 'mem';
  return null;
}

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
    const { customId, member, channelId } = interaction;

    // ===== SPORE BOX: Visitor Decree (Stray Spores) =====
    if (interaction.isButton() && channelId === CHANNELS.SPORE_BOX && customId?.startsWith('flair:')) {
      const flavor = customId.split(':')[1]; // 'lgbt' or 'ally'
      const r = roles();
      
      // Add flair role only (no tier role for stray spores)
      const roleId = flavor === 'lgbt' ? r.flairL : r.flairA;
      const roleName = flavor === 'lgbt' ? 'LGBTQIA2S+' : 'Ally';
      
      if (roleId) {
        try {
          await member.roles.add(roleId);
        } catch (err) {
          console.error(`[visitor-decree] Failed to add ${roleName} role:`, err);
          return interaction.reply({ 
            content: `⚠️ Failed to assign ${roleName} role. Please contact a moderator.`, 
            ephemeral: true 
          });
        }
      }
      
      // Add Stray Spore role
      if (r.stray) {
        try {
          await member.roles.add(r.stray);
        } catch (err) {
          console.error('[visitor-decree] Failed to add Stray Spore role:', err);
        }
      }
      
      const hall = CHANNELS.SPOREHALL ? `<#${CHANNELS.SPOREHALL}>` : 'the waiting hall';
      return interaction.reply({
        content: [
          `✅ **Welcome to the Empire!** You've been marked as a **${roleName}** Stray Spore.`,
          `Please proceed to ${hall} and wait for your host.`,
          `You can use **/vc** in ${hall} to be escorted to your host's War Chamber.`,
          `*Stray Spores are swept at dawn if not rooted.*`
        ].join('\n'),
        ephemeral: true
      });
    }

    // ===== CHAMBER OF OATHS: Imperial Decree (Full Members) =====
    if (interaction.isButton() && channelId === CHANNELS.CHAMBER_OF_OATHS && customId?.startsWith('flair:')) {
      const flavor = customId.split(':')[1]; // 'lgbt' or 'ally'
      
      // Show character name modal for oath ceremony
      const modal = createCharacterNameModal(flavor);
      return interaction.showModal(modal);
    }

    // ===== CHAMBER OF OATHS: Character Modal Submission =====
    if (interaction.isModalSubmit() && customId?.startsWith('character_modal:')) {
      const flavor = customId.split(':')[1];
      
      const characterName = interaction.fields.getTextInputValue('character_name').trim();
      const characterClass = interaction.fields.getTextInputValue('character_class')?.trim() || null;
      const characterRealm = interaction.fields.getTextInputValue('character_realm')?.trim() || null;
      
      // Validate character name
      const nameRegex = /^[a-zA-ZÀ-ÿ\s'\-]+$/;
      if (!nameRegex.test(characterName)) {
        return interaction.reply({
          content: '⛔ Character names can only contain letters, spaces, apostrophes, and hyphens.',
          flags: MessageFlags.Ephemeral,
        });
      }

      // Determine user's tier
      const tier = determineUserTier(member);
      if (!tier) {
        return interaction.reply({
          content: '❌ You need a base role (Member/Officer/Veteran) before taking the oath. Contact an administrator.',
          flags: MessageFlags.Ephemeral,
        });
      }

      // Store character info (check if exists first)
      const userId = member.id;
      if (CharacterDB.characterExists(userId, characterName)) {
        return interaction.reply({
          content: `⛔ You already have a character named **${characterName}** registered.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      // Add character to database
      CharacterDB.addCharacter(userId, characterName, characterClass, characterRealm, true); // Main character

      // Set nickname
      try {
        await member.setNickname(characterName);
      } catch (error) {
        console.log(`No permission to set nickname for ${member.user.tag}:`, error.message);
      }

      // Create oath ceremony scene
      const sceneEmbed = new EmbedBuilder()
        .setDescription(sceneText({
          userMention: member.toString(),
          tier,
          flavor,
          characterName,
          characterClass
        }))
        .setColor(0x8B4513);

      const acceptButton = new ButtonBuilder()
        .setCustomId(`accept_oath:${tier}:${flavor}:${userId}`)
        .setLabel('Accept Oath')
        .setStyle(ButtonStyle.Success);

      const row = new ActionRowBuilder().addComponents(acceptButton);

      return interaction.reply({
        embeds: [sceneEmbed],
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ===== OATH ACCEPTANCE =====
    if (interaction.isButton() && customId?.startsWith('accept_oath:')) {
      const [, tier, flavor, originalUserId] = customId.split(':');
      
      if (member.id !== originalUserId) {
        return interaction.reply({
          content: 'This oath is not meant for you.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const r = roles();
      
      // Add flair role
      const flairRoleId = flavor === 'lgbt' ? r.flairL : r.flairA;
      if (flairRoleId) {
        try {
          await member.roles.add(flairRoleId);
        } catch (err) {
          console.error('Failed to add flair role:', err);
        }
      }

      // Add final tier role and remove base role
      const finalRoleId = r.final[`${tier}:${flavor}`];
      const baseRoleId = tier === 'mem' ? r.baseMem : tier === 'off' ? r.baseOff : r.baseVet;
      
      if (finalRoleId) {
        try {
          await member.roles.add(finalRoleId);
        } catch (err) {
          console.error('Failed to add final role:', err);
        }
      }

      // Remove base role
      if (baseRoleId) {
        try {
          await member.roles.remove(baseRoleId);
        } catch (err) {
          console.error('Failed to remove base role:', err);
        }
      }

      // Remove stray spore role if they have it
      if (r.stray) {
        try {
          await member.roles.remove(r.stray);
        } catch (err) {
          // Ignore - they might not have had it
        }
      }

      // Send completion DM
      await sendOathCompletionDM(member, tier, flavor);

      return interaction.update({
        content: `🎉 **Oath Completed!** Welcome to your new role in the Holy Gehy Empire. Check your DMs for important information about invite generation and voice channels.`,
        embeds: [],
        components: [],
      });
    }

    // ===== ADDALT INTERACTIONS =====
    if (interaction.isStringSelectMenu() && customId?.startsWith('addalt_class:')) {
      const userId = customId.split(':')[1];
      if (userId !== interaction.user.id) return;
      
      const selectedClass = interaction.values[0];
      const modal = addaltCommand.createAddAltModal(selectedClass, userId);
      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && customId?.startsWith('addalt_modal:')) {
      const [, userId, selectedClass] = customId.split(':');
      if (userId !== interaction.user.id) return;

      // Handle addalt modal submission logic here...
      // (This is the same logic from your existing code)
    }

    // ===== DELETE CHARACTER BUTTONS =====
    if (interaction.isButton() && customId?.startsWith('confirm_delete:')) {
      // Handle character deletion confirmation...
      // (This is the same logic from your existing code)
    }

    if (interaction.isButton() && customId?.startsWith('cancel_delete:')) {
      return interaction.update({
        content: '❌ Character deletion cancelled.',
        components: [],
        flags: MessageFlags.Ephemeral
      });
    }

  } catch (error) {
    console.error('Critical error in interaction handler:', error);
    
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: '⚠️ Something went wrong processing your request.',
          flags: MessageFlags.Ephemeral
        });
      } catch (e) {
        console.error('Failed to send error response:', e);
      }
    }
  }
}