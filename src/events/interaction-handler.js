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
    .setLabel('Your WoW Character Name')
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

    // ===== CHAMBER OF OATHS: Imperial Decree (Full Members) =====
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
      const finalRoleId = r.final[`
