// ============= src/events/interaction-buttons.js =============
import { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, EmbedBuilder } from 'discord.js';
import { CHANNELS } from '../channels.js';
import { config } from '../config.js';
import { sendOathCompletionDM } from '../services/oath-completion-service.js';
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
    // Only handle interactions that should be handled in this file
    // Let interaction-buttons.js handle: flair buttons, class_select, character_modal, oath acceptance
    // This file handles: addalt_class, addalt_modal, delete confirmation buttons
    
    const isAddAltClassSelect = interaction.isStringSelectMenu() && interaction.customId?.startsWith('addalt_class:');
    const isAddAltModal = interaction.isModalSubmit() && interaction.customId?.startsWith('addalt_modal:');
    const isDeleteButton = interaction.isButton() && (
      interaction.customId?.startsWith('confirm_delete:') || 
      interaction.customId?.startsWith('cancel_delete:')
    );
    
    // Only handle addalt-specific interactions and delete buttons here
    if (!isAddAltClassSelect && !isAddAltModal && !isDeleteButton && !interaction.isChatInputCommand() && !interaction.isAutocomplete()) {
      return; // Let other handlers deal with other interactions
    }

    // Handle addalt class selection
    if (isAddAltClassSelect) {
      const userId = interaction.customId.split(':')[1];
      if (userId !== interaction.user.id) {
        return interaction.reply({ 
          content: 'This is not your character creation.', 
          flags: MessageFlags.Ephemeral 
        });
      }

      const selectedClass = interaction.values[0];
      const modal = addaltCommand.createAddAltModal(selectedClass, userId);
      
      return interaction.showModal(modal);
    }
    
    // Handle addalt modal submissions
    if (isAddAltModal) {
      const [, userId, selectedClass] = interaction.customId.split(':');
      if (userId !== interaction.user.id) {
        return interaction.reply({
          content: 'This is not your character creation.',
          flags: MessageFlags.Ephemeral
        });
      }

      const name = interaction.fields.getTextInputValue('character_name').trim();
      const realm = interaction.fields.getTextInputValue('character_realm')?.trim() || null;
      const isMainText = interaction.fields.getTextInputValue('is_main')?.trim().toLowerCase() || '';
      const isMain = isMainText === 'yes' || isMainText === 'y' || isMainText === 'true';
      
      // Validate name
      const nameRegex = /^[a-zA-ZÀ-ÿ\s'\-]+$/;
      if (!nameRegex.test(name)) {
        return interaction.reply({
          content: '⛔ Character names can only contain letters, spaces, apostrophes, and hyphens.',
          flags: MessageFlags.Ephemeral,
        });
      }
      
      // Check if character already exists
      if (CharacterDB.characterExists(userId, name)) {
        return interaction.reply({
          content: `⛔ You already have a character named **${name}** registered.`,
          flags: MessageFlags.Ephemeral,
        });
      }
      
      // Add the new character
      const characterClass = selectedClass === 'none' ? null : selectedClass;
      CharacterDB.addCharacter(userId, name, characterClass, realm, isMain);
      
      // Try to set nickname if it's their first character or main
      const characters = CharacterDB.getCharacters(userId);
      if (characters.length === 1 || isMain) {
        try {
          await interaction.member.setNickname(name);
        } catch (error) {
          // Check if it's a permissions error
          if (error.code === 50013) {
            console.log(`No permission to set nickname for ${interaction.member.user.tag}`);
          } else {
            console.error('Failed to set nickname:', error);
          }
          // Continue anyway - this is not critical
        }
      }
      
      // Respond to the user
      const classText = selectedClass !== 'none' ? ` ${selectedClass}` : '';
      const realmText = realm ? ` of ${realm}` : '';
      const mainText = isMain ? ' as your **main character**' : ' as an alt';
      
      return interaction.reply({
        content: `✅ **${name}**${classText}${realmText} has been added to your roster${mainText}!\n\nUse \`/switch\` to change to this character.`,
        flags: MessageFlags.Ephemeral
      });
    }
    
    // Handle delete confirmation buttons
    if (isDeleteButton) {
      if (interaction.customId.startsWith('confirm_delete:')) {
        const [, userId, encodedName] = interaction.customId.split(':');
        if (userId !== interaction.user.id) {
          return interaction.reply({
            content: 'This is not your character deletion.',
            flags: MessageFlags.Ephemeral
          });
        }

        const characterName = decodeURIComponent(encodedName);
        
        if (!CharacterDB.characterExists(userId, characterName)) {
          return interaction.update({
            content: `⛔ Character **${characterName}** no longer exists.`,
            components: [],
            flags: MessageFlags.Ephemeral
          });
        }
        
        const character = CharacterDB.getCharacter(userId, characterName);
        const wasMain = character.isMain;
        
        // Delete the character
        CharacterDB.removeCharacter(userId, characterName);
        
        // If it was the main, suggest setting a new main
        let additionalMessage = '';
        if (wasMain) {
          const remainingChars = CharacterDB.getCharacters(userId);
          if (remainingChars.length > 0) {
            additionalMessage = "\n\nSince this was your main character, you should set a new main using `/switch` and typing 'yes' when asked if it's your main.";
          }
        }
        
        return interaction.update({
          content: `✅ Character **${characterName}** has been deleted from your roster.${additionalMessage}`,
          components: [],
          flags: MessageFlags.Ephemeral
        });

      } else if (interaction.customId.startsWith('cancel_delete:')) {
        return interaction.update({
          content: '❌ Character deletion cancelled.',
          components: [],
          flags: MessageFlags.Ephemeral
        });
      }
    }

    // Handle regular commands
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (command) {
        try {
          await command.execute(interaction);
        } catch (err) {
          console.error(`Error executing /${interaction.commandName}:`, err);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
              content: '⚠️ Something went wrong.', 
              flags: MessageFlags.Ephemeral 
            }).catch(() => {});
          }
        }
      }
    } else if (interaction.isAutocomplete()) {
      const command = commands.get(interaction.commandName);
      if (command?.autocomplete) {
        try {
          await command.autocomplete(interaction);
        } catch (err) {
          console.error(`Error in autocomplete for /${interaction.commandName}:`, err);
        }
      }
    }

  } catch (error) {
    console.error('Critical error in command interaction handler:', error);
  }
}