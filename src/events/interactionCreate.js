// src/events/interactionCreate.js
import { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

// --- from your temp VC flow ---
import { createCharacterNameModal, handleCharacterNameSubmit, grantAccessToMember } from '../services/temp-vc-service.js';

// --- from your oath / character system ---
import { CHANNELS } from '../channels.js';
import { config } from '../config.js';
import { CharacterDB } from '../database/characters.js';
import * as addaltCommand from '../commands/addalt.js';

export const name = Events.InteractionCreate;
export const once = false;

// helpers (same idea as your existing code)
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
function determineUserTier(member) {
  const r = roles();
  if (r.baseVet && member.roles.cache.has(r.baseVet)) return 'vet';
  if (r.baseOff && member.roles.cache.has(r.baseOff)) return 'off';
  if (r.baseMem && member.roles.cache.has(r.baseMem)) return 'mem';
  return null;
}

export async function execute(interaction) {
  try {
    // ===== Slash commands =====
    if (interaction.isChatInputCommand()) {
      const cmd = interaction.client.commands.get(interaction.commandName);
      if (!cmd) return;
      try { await cmd.execute(interaction); }
      catch (err) {
        console.error(`Error executing /${interaction.commandName}:`, err);
        const msg = { content: 'There was an error executing this command!', ephemeral: true };
        interaction.replied || interaction.deferred ? await interaction.followUp(msg) : await interaction.reply(msg);
      }
      return;
    }

    // ===== Autocomplete =====
    if (interaction.isAutocomplete()) {
      const cmd = interaction.client.commands.get(interaction.commandName);
      if (cmd?.autocomplete) {
        try { await cmd.autocomplete(interaction); }
        catch (err) { console.error(`Autocomplete error for /${interaction.commandName}:`, err); }
      }
      return;
    }

    // ===== Buttons =====
    if (interaction.isButton()) {
      const { customId, member, channelId } = interaction;

      // temp VC — user presses "Set WoW Name"
      if (customId === 'setname') {
        const modal = createCharacterNameModal();
        return interaction.showModal(modal);
      }

      // temp VC — "Get Access" (grants Stray Spore & returns deep-link)
      if (customId.startsWith('access_')) {
        const channelIdForAccess = customId.split('_')[1];
        const result = await grantAccessToMember(member, channelIdForAccess);
        return interaction.reply({ content: result.message, ephemeral: true });
      }

      // Oath system — flair button in Chamber of Oaths
      if (channelId === CHANNELS.CHAMBER_OF_OATHS && customId.startsWith('flair:')) {
        const flavor = customId.split(':')[1]; // 'lgbt' or 'ally'
        const tier = determineUserTier(member);
        if (!tier) return interaction.reply({ content: '❌ You need a base role (Member/Officer/Veteran) first.', ephemeral: true });

        const r = roles();
        const finalRoleId = r.final[`${tier}:${flavor}`];
        if (finalRoleId && member.roles.cache.has(finalRoleId)) {
          return interaction.reply({ content: '✅ You already completed the oath with this flair.', ephemeral: true });
        }

        // Show modal to collect character name, etc.
        const modal = new ModalBuilder()
          .setCustomId(`character_modal:${flavor}`)
          .setTitle('🏰 Sign the Imperial Decree');

        const nameInput  = new TextInputBuilder().setCustomId('character_name').setLabel("Your Main WoW Character's Name").setStyle(TextInputStyle.Short).setMaxLength(32).setRequired(true);
        const classInput = new TextInputBuilder().setCustomId('character_class').setLabel('Character Class (Optional)').setStyle(TextInputStyle.Short).setMaxLength(20);
        const realmInput = new TextInputBuilder().setCustomId('character_realm').setLabel('Realm (Optional)').setStyle(TextInputStyle.Short).setMaxLength(30);

        modal.addComponents(
          new ActionRowBuilder().addComponents(nameInput),
          new ActionRowBuilder().addComponents(classInput),
          new ActionRowBuilder().addComponents(realmInput),
        );
        return interaction.showModal(modal);
      }

      // addalt select-open button flows handled below (select/modal branches)
      // fallthrough
    }

    // ===== Modal submits =====
    if (interaction.isModalSubmit()) {
      const { customId, member } = interaction;

      // temp VC — simple name collector modal
      if (customId === 'character_name_modal') {
        return handleCharacterNameSubmit(interaction);
      }

      // Oath system — character modal
      if (customId.startsWith('character_modal:')) {
        await interaction.deferReply({ ephemeral: true });

        const flavor = customId.split(':')[1];
        const characterName  = interaction.fields.getTextInputValue('character_name').trim();
        const characterClass = interaction.fields.getTextInputValue('character_class')?.trim() || null;
        const characterRealm = interaction.fields.getTextInputValue('character_realm')?.trim() || null;

        const nameRegex = /^[a-zA-ZÀ-ÿ\s'\-]+$/;
        if (!nameRegex.test(characterName)) {
          return interaction.editReply({ content: '⛔ Character names can only contain letters, spaces, apostrophes, and hyphens.' });
        }

        const tier = determineUserTier(member);
        if (!tier) return interaction.editReply({ content: '❌ Could not determine your base tier. Contact an admin.' });

        // unique per-user name check
        const userId = member.id;
        if (await CharacterDB.characterExists(userId, characterName)) {
          return interaction.editReply({ content: `⛔ You already registered **${characterName}**.` });
        }

        // roles
        const r = roles();
        const finalRoleId = r.final[`${tier}:${flavor}`];
        const flairRoleId = flavor === 'lgbt' ? r.flairL : r.flairA;
        const baseRoleId  = tier === 'mem' ? r.baseMem : tier === 'off' ? r.baseOff : r.baseVet;

        const toAdd = [finalRoleId, flairRoleId].filter(Boolean);
        if (toAdd.length) await member.roles.add(toAdd, 'Oath ceremony completion');
        if (baseRoleId && config.CEREMONY_REMOVE_BASE_ON_FINAL) {
          await member.roles.remove(baseRoleId, 'Oath ceremony completion');
        }

        // DB + nickname
        await CharacterDB.addCharacter(userId, characterName, characterClass, characterRealm, true);
        try { await member.setNickname(characterName); } catch (e) { /* ignore */ }

        // (Your DM/public welcome steps can be added here if desired)

        return interaction.editReply({ content: '🎉 Oath completed! Welcome to the Holy Gehy Empire.' });
      }

      // addalt flow
      if (customId.startsWith('addalt_modal:')) {
        const [, userId, selectedClass] = customId.split(':');
        if (userId !== interaction.user.id) {
          return interaction.reply({ content: 'This modal is not for you.', ephemeral: true });
        }
        const characterName  = interaction.fields.getTextInputValue('character_name').trim();
        const characterRealm = interaction.fields.getTextInputValue('character_realm')?.trim() || null;
        const isMainInput    = interaction.fields.getTextInputValue('is_main')?.trim().toLowerCase();
        const isMain         = isMainInput === 'yes' || isMainInput === 'y';

        const nameRegex = /^[a-zA-ZÀ-ÿ\s'\-]+$/;
        if (!nameRegex.test(characterName)) {
          return interaction.reply({ content: '⛔ Character names can only contain letters, spaces, apostrophes, and hyphens.', ephemeral: true });
        }
        if (await CharacterDB.characterExists(userId, characterName)) {
          return interaction.reply({ content: `⛔ You already have a character named **${characterName}** registered.`, ephemeral: true });
        }

        const displayClass = selectedClass === 'none' ? null : selectedClass;
        await CharacterDB.addCharacter(userId, characterName, displayClass, characterRealm, isMain);
        if (isMain) {
          try { await interaction.member.setNickname(characterName); } catch (e) {}
        }

        const classText = displayClass ? ` ${displayClass}` : '';
        const mainText  = isMain ? ' as your **main**' : ' as an **alt**';
        return interaction.reply({ content: `✅ **${characterName}**${classText} has been registered${mainText}!`, ephemeral: true });
      }
      return;
    }

    // ===== String selects (addalt) =====
    if (interaction.isStringSelectMenu() && interaction.customId?.startsWith('addalt_class:')) {
      const userId = interaction.customId.split(':')[1];
      if (userId !== interaction.user.id) {
        return interaction.reply({ content: 'This selection is not for you.', ephemeral: true });
      }
      const selectedClass = interaction.values[0];
      const modal = addaltCommand.createAddAltModal(selectedClass, userId);
      return interaction.showModal(modal);
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
    if (!interaction.replied && !interaction.deferred) {
      try { await interaction.reply({ content: '⚠️ Something went wrong processing your request.', ephemeral: true }); }
      catch (_) {}
    }
  }
}
