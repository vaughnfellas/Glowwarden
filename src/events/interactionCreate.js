// src/events/interactionCreate.js
import {
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import * as alt from '../commands/alt.js';
import { config } from '../config.js';
import { CHANNELS } from '../channels.js';
import {
  CEREMONY_IDS,
  CLASS_OPTIONS,
  ROLE_OPTIONS,
  buildOnboardingTips,
  postShortPublicWelcome,
  processOathCompletion,
  sendTipsDM,
} from '../services/oath-service.js';

export const name = 'interactionCreate';
export const once = false;

// Store temporary oath data while user enters character info
// userId -> { flair: 'lgbt'|'ally', characterData: { wowName, realm, chosenClass, chosenRole } }
const oathData = new Map();

export async function execute(interaction) {
  try {
    // Slash commands
    if (interaction.isChatInputCommand()) {
      try {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) {
          console.error(`No command matching ${interaction.commandName} was found.`);
          return;
        }
        console.log(`Executing command: ${interaction.commandName} by ${interaction.user.tag}`);
        await command.execute(interaction);
      } catch (err) {
        console.error(`Error executing command ${interaction.commandName}:`, err);
        const errorMessage = 'There was an error while executing this command!';
        try {
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
          } else {
            await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
          }
        } catch (replyError) {
          console.error('Failed to send command error message:', replyError);
        }
      }
    }

    // Autocomplete
    else if (interaction.isAutocomplete()) {
      try {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command?.autocomplete) return;
        await command.autocomplete(interaction);
      } catch (err) {
        console.error(`Error in autocomplete for ${interaction.commandName}:`, err);
        try {
          await interaction.respond([]);
        } catch (respondError) {
          console.error('Failed to send empty autocomplete response:', respondError);
        }
      }
    }

    // Buttons
    else if (interaction.isButton()) {
      try {
        const customId = interaction.customId;

        // Alt command buttons
        if (customId.startsWith('alt_')) {
          if (customId.includes('confirm_delete') || customId.includes('cancel_delete')) {
            await alt.handleDeleteConfirmation(interaction);
          } else {
            await alt.handleButtonClick(interaction);
          }
        }
        // Ceremony flair buttons
        else if (customId === CEREMONY_IDS.lgbtButton || customId === CEREMONY_IDS.allyButton) {
          await handleFlairSelection(interaction);
        }
        // Ceremony submit button
        else if (customId === CEREMONY_IDS.submitButton) {
          await handleOathSubmission(interaction);
        }
        // DM tips button
        else if (customId === CEREMONY_IDS.dmTipsButton) {
          await handleDMTips(interaction);
        }
        else if (customId === 'vc_set_nick') {
          // Only let the clicker set their own nickname
          if (!interaction.inGuild()) {
            return interaction.reply({ content: 'This action must be used in the server.', flags: MessageFlags.Ephemeral });
          }
          // Show a simple modal to collect WoW name + optional realm
          const modal = new ModalBuilder()
            .setCustomId('vc_set_nick_modal')
            .setTitle('Set WoW Nickname');

          const nameInput = new TextInputBuilder()
            .setCustomId('wow_name')
            .setLabel('WoW Character Name')
            .setStyle(TextInputStyle.Short)
            .setMinLength(2)
            .setMaxLength(32)
            .setRequired(true);

          const realmInput = new TextInputBuilder()
            .setCustomId('wow_realm')
            .setLabel('Realm (optional)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

          const row1 = new ActionRowBuilder().addComponents(nameInput);
          const row2 = new ActionRowBuilder().addComponents(realmInput);
          modal.addComponents(row1, row2);

          await interaction.showModal(modal);
        } else {
          console.warn(`Unhandled button interaction: ${customId}`);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: 'This button interaction is not currently supported.',
              flags: MessageFlags.Ephemeral,
            });
          }
        }
      } catch (err) {
        console.error(`Error handling button interaction ${interaction.customId}:`, err);
        try {
          const errorMessage = 'There was an error processing this button interaction!';
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
          } else {
            await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
          }
        } catch (replyError) {
          console.error('Failed to send button error message:', replyError);
        }
      }
    }

    // Select menus
    else if (interaction.isStringSelectMenu()) {
      try {
        const customId = interaction.customId;

        // Alt command selects
        if (customId.startsWith('alt_')) {
          await alt.handleSelectMenu(interaction);
        }
        // Ceremony class selection
        else if (customId === 'ceremony_class_select') {
          await handleClassSelection(interaction);
        }
        // Ceremony role selection
        else if (customId === 'ceremony_role_select') {
          await handleRoleSelection(interaction);
        } else {
          console.warn(`Unhandled select menu interaction: ${customId}`);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: 'This select menu interaction is not currently supported.',
              flags: MessageFlags.Ephemeral,
            });
          }
        }
      } catch (err) {
        console.error(`Error handling select menu interaction ${interaction.customId}:`, err);
        try {
          const errorMessage = 'There was an error processing this selection!';
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
          } else {
            await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
          }
        } catch (replyError) {
          console.error('Failed to send select error message:', replyError);
        }
      }
    }

    // Modals
    else if (interaction.isModalSubmit()) {
      try {
        const customId = interaction.customId;

        if (customId === 'ceremony_character_modal') {
          await handleCharacterModal(interaction);
        } else if (customId.startsWith('alt_')) {
          await alt.handleModalSubmit(interaction);
        } else if (customId === 'vc_set_nick_modal') {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });

          try {
            if (!interaction.inGuild()) {
              return interaction.editReply('This action must be used in the server.');
            }

            const wowName = interaction.fields.getTextInputValue('wow_name')?.trim();
            const realm = interaction.fields.getTextInputValue('wow_realm')?.trim();

            if (!wowName || wowName.length < 2) {
              return interaction.editReply('Please provide a valid WoW name (at least 2 characters).');
            }

            const desiredNick = realm ? `${wowName} - ${realm}` : wowName;

            await interaction.member.setNickname(desiredNick, 'Set via War Chamber nickname modal');
            await interaction.editReply(`✅ Your nickname has been set to **${desiredNick}**`);
          } catch (err) {
            console.error('Failed to set nickname:', err);
            // Common cause: missing "Manage Nicknames" permission for the bot or user above bot in role list
            await interaction.editReply('⚠️ I couldn't change your nickname. An admin may need to grant me **Manage Nicknames** or move my role higher.');
          }
        } else {
          console.warn(`Unhandled modal submission: ${customId}`);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: 'This modal submission is not currently supported.',
              flags: MessageFlags.Ephemeral,
            });
          }
        }
      } catch (err) {
        console.error(`Error handling modal submission ${interaction.customId}:`, err);
        try {
          const errorMessage = 'There was an error processing this form submission!';
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
          } else {
            await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
          }
        } catch (replyError) {
          console.error('Failed to send modal error message:', replyError);
        }
      }
    }
  } catch (error) {
    console.error('Error in interactionCreate event:', error);
  }
}

// ---------- Ceremony handlers ----------

// Flair selection (LGBTQIA2S+ or Ally)
async function handleFlairSelection(interaction) {
  const flair = interaction.customId === CEREMONY_IDS.lgbtButton ? 'lgbt' : 'ally';

  // Store oath data
  oathData.set(interaction.user.id, {
    flair,
    characterData: {},
  });

  // Character info modal
  const modal = new ModalBuilder().setCustomId('ceremony_character_modal').setTitle('Character Information');

  const characterNameInput = new TextInputBuilder()
    .setCustomId('character_name')
    .setLabel('Character Name')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Enter your WoW character name')
    .setRequired(true)
    .setMinLength(2)
    .setMaxLength(32);

  const realmInput = new TextInputBuilder()
    .setCustomId('character_realm')
    .setLabel('Realm')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., Stormrage, Tichondrius')
    .setRequired(true)
    .setMinLength(2)
    .setMaxLength(32);

  const nameRow = new ActionRowBuilder().addComponents(characterNameInput);
  const realmRow = new ActionRowBuilder().addComponents(realmInput);

  modal.addComponents(nameRow, realmRow);
  await interaction.showModal(modal);
}

// Character modal submission
async function handleCharacterModal(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const userId = interaction.user.id;
    const userData = oathData.get(userId);

    if (!userData) {
      await interaction.editReply({ content: 'Session expired. Please start the oath process again.' });
      return;
    }

    const characterName = interaction.fields.getTextInputValue('character_name')?.trim();
    const realm = interaction.fields.getTextInputValue('character_realm')?.trim();

    if (!characterName || characterName.length < 2) {
      await interaction.editReply({ content: 'Please provide a valid character name (at least 2 characters).' });
      return;
    }
    if (!realm || realm.length < 2) {
      await interaction.editReply({ content: 'Please provide a valid realm name (at least 2 characters).' });
      return;
    }

    userData.characterData.wowName = characterName;
    userData.characterData.realm = realm;
    oathData.set(userId, userData);

    // Class select
    const classOptions = CLASS_OPTIONS.map((cls) =>
      new StringSelectMenuOptionBuilder().setLabel(cls.name).setValue(cls.value).setEmoji(cls.emoji),
    );

    const classSelect = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ceremony_class_select')
        .setPlaceholder('Select your character class')
        .addOptions(classOptions),
    );

    await interaction.editReply({
      content: `Character: **${characterName}** of **${realm}**\n\nPlease select your character class:`,
      components: [classSelect],
    });
  } catch (error) {
    console.error('Error handling character modal:', error);
    await interaction.editReply({
      content: 'There was an error processing your character information. Please try again.',
    });
  }
}

// Class selection
async function handleClassSelection(interaction) {
  await interaction.deferUpdate();

  try {
    const userId = interaction.user.id;
    const userData = oathData.get(userId);

    if (!userData) {
      await interaction.editReply({
        content: 'Session expired. Please start the oath process again.',
        components: [],
      });
      return;
    }

    const selectedClass = interaction.values[0];
    userData.characterData.chosenClass = selectedClass;
    oathData.set(userId, userData);

    const roleOptions = ROLE_OPTIONS.map((role) =>
      new StringSelectMenuOptionBuilder().setLabel(role.name).setValue(role.value).setEmoji(role.emoji),
    );

    const roleSelect = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ceremony_role_select')
        .setPlaceholder('Select your character role')
        .addOptions(roleOptions),
    );

    const classInfo = CLASS_OPTIONS.find((c) => c.value === selectedClass);
    const classEmoji = classInfo ? classInfo.emoji : '';

    await interaction.editReply({
      content: `Character: **${userData.characterData.wowName}** of **${userData.characterData.realm}**\nClass: ${classEmoji} **${selectedClass}**\n\nPlease select your character role:`,
      components: [roleSelect],
    });
  } catch (error) {
    console.error('Error handling class selection:', error);
    await interaction.editReply({
      content: 'There was an error processing your class selection. Please try again.',
      components: [],
    });
  }
}

// Role selection
async function handleRoleSelection(interaction) {
  await interaction.deferUpdate();

  try {
    const userId = interaction.user.id;
    const userData = oathData.get(userId);

    if (!userData) {
      await interaction.editReply({
        content: 'Session expired. Please start the oath process again.',
        components: [],
      });
      return;
    }

    const selectedRole = interaction.values[0];
    userData.characterData.chosenRole = selectedRole === 'none' ? null : selectedRole;
    oathData.set(userId, userData);

    const classInfo = CLASS_OPTIONS.find((c) => c.value === userData.characterData.chosenClass);
    const classEmoji = classInfo ? classInfo.emoji : '';

    const roleInfo = ROLE_OPTIONS.find((r) => r.value === selectedRole);
    const roleEmoji = roleInfo ? roleInfo.emoji : '';

    const oathText = [
      `By the light of the sacred mushrooms and the rainbow spores that bind us, I, **${userData.characterData.wowName}**, ${classEmoji} **${userData.characterData.chosenClass}**${
        selectedRole !== 'none' ? ` ${roleEmoji} **${selectedRole}**` : ''
      } of **${userData.characterData.realm}** pledge to honor the tenets of the Holy Gehy Empire:`,
      '',
      '• To embrace all souls who seek refuge beneath our banners',
      '• To nurture the sacred bonds of our fellowship',
      '• To share in both triumph and tribulation as one community',
      '• To spread joy and revelry throughout our realm',
      '',
      '*The Empire remembers your oath, and the spores bear witness.*',
    ].join('\n');

    const submitButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(CEREMONY_IDS.submitButton).setLabel('Sign Oath').setStyle(ButtonStyle.Success).setEmoji('📜'),
    );

    await interaction.editReply({ content: oathText, components: [submitButton] });
  } catch (error) {
    console.error('Error handling role selection:', error);
    await interaction.editReply({
      content: 'There was an error processing your role selection. Please try again.',
      components: [],
    });
  }
}

// Oath submission
async function handleOathSubmission(interaction) {
  await interaction.deferUpdate();

  try {
    const userId = interaction.user.id;
    const userData = oathData.get(userId);

    if (!userData) {
      await interaction.editReply({
        content: 'Session expired. Please start the oath process again.',
        components: [],
      });
      return;
    }

    // Complete oath
    const result = await processOathCompletion(interaction.member, userData.flair, userData.characterData);
    if (!result.success) {
      await interaction.editReply({
        content: `Failed to complete oath: ${result.error || 'Unknown error'}`,
        components: [],
      });
      return;
    }

    // ---- Public welcome (fixed) ----
    const { wowName, realm, chosenClass } = userData.characterData;
    const classInfo = CLASS_OPTIONS.find((c) => c.value === chosenClass);
    const classEmoji = classInfo ? classInfo.emoji : '';

    const channel = interaction.client.channels.cache.get(CHANNELS.CHAMBER_OF_OATHS);
    if (channel?.isTextBased()) {
      await postShortPublicWelcome({
        channel,
        member: interaction.member,
        wowName,
        realm,
        chosenClass, // e.g., "Mage" value
        classEmoji,  // e.g., "🔮"
      });
    }
    // --------------------------------

    // DM tips button
    const tips = buildOnboardingTips(userData.characterData);
    const dmButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(CEREMONY_IDS.dmTipsButton).setLabel('Send this to my DMs').setStyle(ButtonStyle.Secondary).setEmoji('📨'),
    );

    // Clear session
    oathData.delete(userId);

    await interaction.editReply({
      content: `✅ **Oath Completed!**\n\nWelcome to the Holy Gehy Empire, ${interaction.member.displayName}!\n\n${tips}`,
      components: [dmButton],
    });
  } catch (error) {
    console.error('Error handling oath submission:', error);
    await interaction.editReply({
      content: 'There was an error processing your oath. Please try again or contact an administrator.',
      components: [],
    });
  }
}

// DM tips button
async function handleDMTips(interaction) {
  await interaction.deferUpdate();

  try {
    const message = interaction.message;
    const content = message.content;

    // Extract the tips (everything from the Oath Completed line onward)
    const tipsStart = content.indexOf('✅ **Oath Completed!**');
    const tips = tipsStart >= 0 ? content.substring(tipsStart) : content;

    const success = await sendTipsDM(interaction.user, tips);
    if (success) {
      await interaction.followUp({ content: 'Tips sent to your DMs!', flags: MessageFlags.Ephemeral });
    } else {
      await interaction.followUp({
        content: 'Failed to send tips to your DMs. Please make sure you have DMs enabled for this server.',
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (error) {
    console.error('Error handling DM tips:', error);
    await interaction.followUp({ content: 'There was an error sending tips to your DMs.', flags: MessageFlags.Ephemeral });
  }
}
