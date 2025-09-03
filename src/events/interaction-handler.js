// ============= src/events/interaction-handler.js =============
import { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } from 'discord.js';
import { CHANNELS } from '../channels.js';
import { config } from '../config.js';
import { sendOathCompletionDM, getPublicWelcomeText } from '../services/oath-completion-service.js';
import { CharacterDB } from '../database/characters.js';
import * as addaltCommand from '../commands/addalt.js';

const id = v => (v && /^\d+$/.test(String(v))) ? String(v) : null;

const roles = () => ({
  flairL:  id(config.ROLE_LGBTQ),
  flairA:  id(config.ROLE_ALLY),
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
    .setLabel("Your Main WoW Character's Name")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Enter your main character\'s name (e.g., Thrall)')
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

function determineUserTier(member) {
  const r = roles();
  if (r.baseVet && member.roles.cache.has(r.baseVet)) return 'vet';
  if (r.baseOff && member.roles.cache.has(r.baseOff)) return 'off';
  if (r.baseMem && member.roles.cache.has(r.baseMem)) return 'mem';
  return null;
}

export const name = Events.InteractionCreate;
export const once = false;

export async function execute(interaction) {
  try {
    const { customId, member, channelId } = interaction;

    // ===== CHAMBER OF OATHS: Flair Button Click =====
    if (interaction.isButton() && channelId === CHANNELS.CHAMBER_OF_OATHS && customId?.startsWith('flair:')) {
      const flavor = customId.split(':')[1]; // 'lgbt' or 'ally'
      
      const tier = determineUserTier(member);
      if (!tier) {
        return interaction.reply({
          content: '❌ You need a base role (Member/Officer/Veteran) before taking the oath. Contact an administrator.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const r = roles();
      const finalRoleId = r.final[`${tier}:${flavor}`];
      if (finalRoleId && member.roles.cache.has(finalRoleId)) {
        return interaction.reply({
          content: '✅ You have already completed the oath ceremony with this flair!',
          flags: MessageFlags.Ephemeral,
        });
      }
      
      // Show character name modal for oath ceremony
      const modal = createCharacterNameModal(flavor);
      return interaction.showModal(modal);
    }

    // ===== CHAMBER OF OATHS: Character Modal Submission (The Final Step) =====
    if (interaction.isModalSubmit() && customId?.startsWith('character_modal:')) {
      await interaction.deferReply({ ephemeral: true });

      const flavor = customId.split(':')[1];
      
      const characterName = interaction.fields.getTextInputValue('character_name').trim();
      const characterClass = interaction.fields.getTextInputValue('character_class')?.trim() || null;
      const characterRealm = interaction.fields.getTextInputValue('character_realm')?.trim() || null;
      
      // Validate character name
      const nameRegex = /^[a-zA-ZÀ-ÿ\s'\-]+$/;
      if (!nameRegex.test(characterName)) {
        return interaction.editReply({
          content: '⛔ Character names can only contain letters, spaces, apostrophes, and hyphens.',
        });
      }

      const tier = determineUserTier(member);
      if (!tier) {
        return interaction.editReply({
          content: '❌ Could not determine your tier (Member/Officer/Veteran). Please contact an administrator.',
        });
      }

      // Check for duplicate character name
      const userId = member.id;
      if (await CharacterDB.characterExists(userId, characterName)) {
        return interaction.editReply({
          content: `⛔ You already have a character named **${characterName}** registered. Use \`/deletealt\` if you need to re-register.`,
        });
      }

      // --- Perform all actions ---
      const r = roles();
      const finalRoleId = r.final[`${tier}:${flavor}`];
      const flairRoleId = flavor === 'lgbt' ? r.flairL : r.flairA;
      const baseRoleId = tier === 'mem' ? r.baseMem : tier === 'off' ? r.baseOff : r.baseVet;

      // 1. Add roles
      const rolesToAdd = [finalRoleId, flairRoleId].filter(Boolean);
      if (rolesToAdd.length > 0) {
        await member.roles.add(rolesToAdd, 'Oath Ceremony Completion');
      }

      // 2. Remove base role
      if (baseRoleId && config.CEREMONY_REMOVE_BASE_ON_FINAL) {
        await member.roles.remove(baseRoleId, 'Oath Ceremony Completion');
      }

      // 3. Add character to database as main
      await CharacterDB.addCharacter(userId, characterName, characterClass, characterRealm, true);

      // 4. Set nickname
      try {
        await member.setNickname(characterName);
      } catch (error) {
        console.log(`Could not set nickname for ${member.user.tag}:`, error.message);
      }

      // 5. Send welcome DM
      await sendOathCompletionDM(member, tier, flavor);

      // 6. Post public welcome message
      const publicChannel = interaction.guild.channels.cache.get(CHANNELS.THE_GRAND_BALLROOM);
      if (publicChannel?.isTextBased()) {
        const publicWelcome = getPublicWelcomeText(member, tier, flavor);
        await publicChannel.send(publicWelcome);
      }

      // 7. Confirm completion to the user
      return interaction.editReply({
        content: `🎉 **Oath Completed!** Welcome to your new role in the Holy Gehy Empire. Check your DMs for important information about your new abilities!`,
      });
    }

    // ===== ADDALT & OTHER INTERACTIONS (No changes needed here) =====
    if (interaction.isStringSelectMenu() && customId?.startsWith('addalt_class:')) {
      const userId = customId.split(':')[1];
      if (userId !== interaction.user.id) {
        return interaction.reply({ content: 'This selection menu is not for you.', flags: MessageFlags.Ephemeral });
      }
      const selectedClass = interaction.values[0];
      const modal = addaltCommand.createAddAltModal(selectedClass, userId);
      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && customId?.startsWith('addalt_modal:')) {
      const [, userId, selectedClass] = customId.split(':');
      if (userId !== interaction.user.id) {
        return interaction.reply({ content: 'This modal is not for you.', flags: MessageFlags.Ephemeral });
      }
      const characterName = interaction.fields.getTextInputValue('character_name').trim();
      const characterRealm = interaction.fields.getTextInputValue('character_realm')?.trim() || null;
      const isMainInput = interaction.fields.getTextInputValue('is_main')?.trim().toLowerCase();
      const isMain = isMainInput === 'yes' || isMainInput === 'y';
      const nameRegex = /^[a-zA-ZÀ-ÿ\s'\-]+$/;
      if (!nameRegex.test(characterName)) {
        return interaction.reply({ content: '⛔ Character names can only contain letters, spaces, apostrophes, and hyphens.', flags: MessageFlags.Ephemeral });
      }
      if (await CharacterDB.characterExists(userId, characterName)) {
        return interaction.reply({ content: `⛔ You already have a character named **${characterName}** registered.`, flags: MessageFlags.Ephemeral });
      }
      const displayClass = selectedClass === 'none' ? null : selectedClass;
      await CharacterDB.addCharacter(userId, characterName, displayClass, characterRealm, isMain);
      if (isMain) {
        try {
          await member.setNickname(characterName);
        } catch (error) {
          console.log(`No permission to set nickname for ${member.user.tag}:`, error.message);
        }
      }
      const classText = displayClass ? ` ${displayClass}` : '';
      const mainText = isMain ? ' as your **main character**' : ' as an **alt character**';
      return interaction.reply({ content: `✅ **${characterName}**${classText} has been registered${mainText}!`, flags: MessageFlags.Ephemeral });
    }

    // ===== SLASH COMMANDS =====
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
      }
      try {
        await command.execute(interaction);
      } catch (error) {
        console.error('Error executing command:', error);
        const errorMessage = { content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
      }
    }

  } catch (error) {
    console.error('Critical error in interaction handler:', error);
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({ content: '⚠️ Something went wrong processing your request.', flags: MessageFlags.Ephemeral });
      } catch (e) {
        console.error('Failed to send error response:', e);
      }
    }
  }
}
