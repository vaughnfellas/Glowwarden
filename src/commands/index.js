// ============= src/commands/index.js =============
import { Events, MessageFlags } from 'discord.js';

import * as straysCommand from './strays.js';
import * as generateInviteCommand from './generate-invite.js';
import * as vcCommand from './vc.js';
import * as decreeCommand from './decree.js';
import * as idsCommand from './ids.js';
import * as permsCommand from './perms.js';
import * as visitorDecreeCommand from '../services/visitor-decree-service.js';
import * as addaltCommand from './addalt.js';
import * as glowwarden from './glowwarden.js';

import { CharacterDB } from '../database/characters.js';

// ONE source of truth: export a single map with everything
export const commands = new Map([
  [glowwarden.data.name, glowwarden],
  [straysCommand.data.name, straysCommand],
  [generateInviteCommand.data.name, generateInviteCommand],
  [vcCommand.data.name, vcCommand],
  [decreeCommand.data.name, decreeCommand],
  [idsCommand.data.name, idsCommand],
  [permsCommand.data.name, permsCommand],
  [visitorDecreeCommand.data.name, visitorDecreeCommand],

  // pseudo-commands implemented inside addalt.js
  [addaltCommand.data.name, addaltCommand],
  [addaltCommand.switchData.name, {
    execute: addaltCommand.executeSwitch,
    autocomplete: addaltCommand.autocompleteSwitchCharacters,
  }],
  [addaltCommand.rosterData.name, {
    execute: addaltCommand.executeRoster,
  }],
  [addaltCommand.deleteAltData.name, {
    execute: addaltCommand.executeDeleteAlt,
    autocomplete: addaltCommand.autocompleteDeleteCharacters,
  }],
]);

export function loadCommands(client) {
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      // ===== addalt select menu =====
      if (interaction.isStringSelectMenu() && interaction.customId.startsWith('addalt_class:')) {
        try {
          const userId = interaction.customId.split(':')[1];
          if (userId === interaction.user.id) {
            const selectedClass = interaction.values[0];
            const modal = addaltCommand.createAddAltModal(selectedClass, userId);
            await interaction.showModal(modal);
          }
        } catch (err) {
          console.error('Error handling addalt class selection:', err);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '⚠️ Something went wrong with class selection.', flags: MessageFlags.Ephemeral }).catch(() => {});
          }
        }
        return;
      }

      // ===== addalt modal =====
      if (interaction.isModalSubmit() && interaction.customId.startsWith('addalt_modal:')) {
        try {
          const [, userId, selectedClass] = interaction.customId.split(':');
          if (userId !== interaction.user.id) {
            return interaction.reply({ content: 'This is not your character creation.', flags: MessageFlags.Ephemeral });
          }

          const name = interaction.fields.getTextInputValue('character_name').trim();
          const realm = interaction.fields.getTextInputValue('character_realm')?.trim() || null;
          const isMainText = interaction.fields.getTextInputValue('is_main')?.trim().toLowerCase() || '';
          const isMain = isMainText === 'yes' || isMainText === 'y' || isMainText === 'true';

          const nameRegex = /^[a-zA-ZÀ-ÿ\s'\-]+$/;
          if (!nameRegex.test(name)) {
            return interaction.reply({ content: '⛔ Character names can only contain letters, spaces, apostrophes, and hyphens.', flags: MessageFlags.Ephemeral });
          }

          // FIXED: Added await
          if (await CharacterDB.characterExists(userId, name)) {
            return interaction.reply({ content: `⛔ You already have a character named **${name}** registered.`, flags: MessageFlags.Ephemeral });
          }

          const characterClass = selectedClass === 'none' ? null : selectedClass;
          // FIXED: Added await
          await CharacterDB.addCharacter(userId, name, characterClass, realm, isMain);

          // FIXED: Added await
          const characters = await CharacterDB.getCharacters(userId);
          if (characters.length === 1 || isMain) {
            try {
              await interaction.member.setNickname(name);
            } catch (error) {
              if (error.code === 50013) {
                console.log(`No permission to set nickname for ${interaction.member.user.tag}`);
              } else {
                console.error('Failed to set nickname:', error);
              }
            }
          }

          const classText = selectedClass !== 'none' ? ` ${selectedClass}` : '';
          const realmText = realm ? ` of ${realm}` : '';
          const mainText = isMain ? ' as your **main character**' : ' as an alt';

          return interaction.reply({
            content: `✅ **${name}**${classText}${realmText} has been added to your roster${mainText}!\n\nUse \`/switch\` to change to this character.`,
            flags: MessageFlags.Ephemeral,
          });
        } catch (err) {
          console.error('Error handling character registration:', err);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '⚠️ Something went wrong while registering your character.', flags: MessageFlags.Ephemeral }).catch(e => console.error('Failed to send error response:', e));
          }
        }
        return;
      }

      // ===== deletealt buttons =====
      if (interaction.isButton()) {
        if (interaction.customId.startsWith('confirm_delete:')) {
          try {
            const [, userId, encodedName] = interaction.customId.split(':');
            if (userId !== interaction.user.id) {
              return interaction.reply({ content: 'This is not your character deletion.', flags: MessageFlags.Ephemeral });
            }

            const characterName = decodeURIComponent(encodedName);
            // FIXED: Added await
            if (!(await CharacterDB.characterExists(userId, characterName))) {
              return interaction.update({ content: `⛔ Character **${characterName}** no longer exists.`, components: [], flags: MessageFlags.Ephemeral });
            }

            // FIXED: Added await
            const character = await CharacterDB.getCharacter(userId, characterName);
            const wasMain = character.isMain;

            // FIXED: Added await
            await CharacterDB.removeCharacter(userId, characterName);

            let additionalMessage = '';
            if (wasMain) {
              // FIXED: Added await
              const remaining = await CharacterDB.getCharacters(userId);
              if (remaining.length > 0) {
                additionalMessage = "\n\nSince this was your main character, you should set a new main using `/switch` and typing 'yes' when asked if it's your main.";
              }
            }

            return interaction.update({ content: `✅ Character **${characterName}** has been deleted from your roster.${additionalMessage}`, components: [], flags: MessageFlags.Ephemeral });
          } catch (err) {
            console.error('Error handling character deletion:', err);
            if (!interaction.replied && !interaction.deferred) {
              await interaction.update({ content: '⚠️ Something went wrong while deleting your character.', components: [], flags: MessageFlags.Ephemeral }).catch(e => console.error('Failed to send error response:', e));
            }
          }
          return;
        }

        if (interaction.customId.startsWith('cancel_delete:')) {
          return interaction.update({ content: '⏹ Character deletion cancelled.', components: [], flags: MessageFlags.Ephemeral });
        }

        return;
      }

      // ===== chat input & autocomplete =====
      if (interaction.isChatInputCommand()) {
        const cmd = commands.get(interaction.commandName);
        if (cmd) {
          try { await cmd.execute(interaction); }
          catch (err) {
            console.error(`Error executing /${interaction.commandName}:`, err);
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({ content: '⚠️ Something went wrong.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }
          }
        }
      } else if (interaction.isAutocomplete()) {
        const cmd = commands.get(interaction.commandName);
        if (cmd?.autocomplete) {
          try { await cmd.autocomplete(interaction); }
          catch (err) { console.error(`Error in autocomplete for /${interaction.commandName}:`, err); }
        }
      }
    } catch (error) {
      console.error('Critical error in interaction handler:', error);
    }
  });

  console.log(`Loaded ${commands.size} commands`);
}