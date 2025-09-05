// src/events/interactionCreate.js
import { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
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
  sendTipsDM
} from '../services/oath-service.js';

export const name = 'interactionCreate';
export const once = false;

// Store temporary oath data while user enters character info
const oathData = new Map(); // userId -> { flair, characterData }

export async function execute(interaction) {
  try {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      try {
        const command = interaction.client.commands.get(interaction.commandName);
        
        if (!command) {
          console.error(`No command matching ${interaction.commandName} was found.`);
          return;
        }
        
        console.log(`Executing command: ${interaction.commandName} by ${interaction.user.tag}`);
        await command.execute(interaction);
      } catch (commandError) {
        console.error(`Error executing command ${interaction.commandName}:`, commandError);
        
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
    
    // Handle autocomplete
    else if (interaction.isAutocomplete()) {
      try {
        const command = interaction.client.commands.get(interaction.commandName);
        
        if (!command?.autocomplete) {
          return;
        }
        
        await command.autocomplete(interaction);
      } catch (autocompleteError) {
        console.error(`Error in autocomplete for ${interaction.commandName}:`, autocompleteError);
        try {
          await interaction.respond([]);
        } catch (respondError) {
          console.error('Failed to send empty autocomplete response:', respondError);
        }
      }
    }
    
    // Handle button interactions
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
        else {
          console.warn(`Unhandled button interaction: ${customId}`);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
              content: 'This button interaction is not currently supported.', 
              flags: MessageFlags.Ephemeral 
            });
          }
        }
      } catch (buttonError) {
        console.error(`Error handling button interaction ${interaction.customId}:`, buttonError);
        
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
    
    // Handle select menu interactions
    else if (interaction.isStringSelectMenu()) {
      try {
        const customId = interaction.customId;
        
        // Alt command select menus
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
        }
        else {
          console.warn(`Unhandled select menu interaction: ${customId}`);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
              content: 'This select menu interaction is not currently supported.', 
              flags: MessageFlags.Ephemeral 
            });
          }
        }
      } catch (selectError) {
        console.error(`Error handling select menu interaction ${interaction.customId}:`, selectError);
        
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
    
    // Handle modal submissions
    else if (interaction.isModalSubmit()) {
      try {
        const customId = interaction.customId;
        
        // Handle character info modal
        if (customId === 'ceremony_character_modal') {
          await handleCharacterModal(interaction);
        }
        // Handle alt command modals
        else if (customId.startsWith('alt_')) {
          await alt.handleModalSubmit(interaction);
        }
        else {
          console.warn(`Unhandled modal submission: ${customId}`);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
              content: 'This modal submission is not currently supported.', 
              flags: MessageFlags.Ephemeral 
            });
          }
        }
      } catch (modalError) {
        console.error(`Error handling modal submission ${interaction.customId}:`, modalError);
        
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

// Handle flair selection (LGBTQIA2S+ or Ally)
async function handleFlairSelection(interaction) {
  const flair = interaction.customId === CEREMONY_IDS.lgbtButton ? 'lgbt' : 'ally';
  
  // Store oath data
  oathData.set(interaction.user.id, {
    flair,
    characterData: {}
  });
  
  // Create modal for character name and realm
  const modal = new ModalBuilder()
    .setCustomId('ceremony_character_modal')
    .setTitle('Character Information');
  
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

// Handle character modal submission
async function handleCharacterModal(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  try {
    const userId = interaction.user.id;
    const userData = oathData.get(userId);
    
    if (!userData) {
      await interaction.editReply({
        content: 'Session expired. Please start the oath process again.'
      });
      return;
    }
    
    // Get character name and realm from modal
    const characterName = interaction.fields.getTextInputValue('character_name')?.trim();
    const realm = interaction.fields.getTextInputValue('character_realm')?.trim();
    
    // Validate inputs
    if (!characterName || characterName.length < 2) {
      await interaction.editReply({
        content: 'Please provide a valid character name (at least 2 characters).'
      });
      return;
    }
    
    if (!realm || realm.length < 2) {
      await interaction.editReply({
        content: 'Please provide a valid realm name (at least 2 characters).'
      });
      return;
    }
    
    // Update stored data
    userData.characterData.wowName = characterName;
    userData.characterData.realm = realm;
    oathData.set(userId, userData);
    
    // Create class selection menu
    const classOptions = CLASS_OPTIONS.map(cls => 
      new StringSelectMenuOptionBuilder()
        .setLabel(cls.name)
        .setValue(cls.value)
        .setEmoji(cls.emoji)
    );
    
    const classSelect = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ceremony_class_select')
        .setPlaceholder('Select your character class')
        .addOptions(classOptions)
    );
    
    await interaction.editReply({
      content: `Character: **${characterName}** of **${realm}**\n\nPlease select your character class:`,
      components: [classSelect]
    });
  } catch (error) {
    console.error('Error handling character modal:', error);
    await interaction.editReply({
      content: 'There was an error processing your character information. Please try again.'
    });
  }
}

// Handle class selection
async function handleClassSelection(interaction) {
  await interaction.deferUpdate();
  
  try {
    const userId = interaction.user.id;
    const userData = oathData.get(userId);
    
    if (!userData) {
      await interaction.editReply({
        content: 'Session expired. Please start the oath process again.',
        components: []
      });
      return;
    }
    
    // Get selected class
    const selectedClass = interaction.values[0];
    userData.characterData.chosenClass = selectedClass;
    oathData.set(userId, userData);
    
    // Create role selection menu
    const roleOptions = ROLE_OPTIONS.map(role => 
      new StringSelectMenuOptionBuilder()
        .setLabel(role.name)
        .setValue(role.value)
        .setEmoji(role.emoji)
    );
    
    const roleSelect = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ceremony_role_select')
        .setPlaceholder('Select your character role')
        .addOptions(roleOptions)
    );
    
    // Get class emoji
    const classInfo = CLASS_OPTIONS.find(c => c.value === selectedClass);
    const classEmoji = classInfo ? classInfo.emoji : '';
    
    await interaction.editReply({
      content: `Character: **${userData.characterData.wowName}** of **${userData.characterData.realm}**\nClass: ${classEmoji} **${selectedClass}**\n\nPlease select your character role:`,
      components: [roleSelect]
    });
  } catch (error) {
    console.error('Error handling class selection:', error);
    await interaction.editReply({
      content: 'There was an error processing your class selection. Please try again.',
      components: []
    });
  }
}

// Handle role selection
async function handleRoleSelection(interaction) {
  await interaction.deferUpdate();
  
  try {
    const userId = interaction.user.id;
    const userData = oathData.get(userId);
    
    if (!userData) {
      await interaction.editReply({
        content: 'Session expired. Please start the oath process again.',
        components: []
      });
      return;
    }
    
    // Get selected role
    const selectedRole = interaction.values[0];
    userData.characterData.chosenRole = selectedRole === 'none' ? null : selectedRole;
    oathData.set(userId, userData);
    
    // Get class and role emojis
    const classInfo = CLASS_OPTIONS.find(c => c.value === userData.characterData.chosenClass);
    const classEmoji = classInfo ? classInfo.emoji : '';
    
    const roleInfo = ROLE_OPTIONS.find(r => r.value === selectedRole);
    const roleEmoji = roleInfo ? roleInfo.emoji : '';
    
    // Create oath text
    const oathText = [
   `By the light of the sacred mushrooms and the rainbow spores that bind us, I, **${userData.characterData.wowName}**, ${classEmoji} **${userData.characterData.chosenClass}**${selectedRole !== 'none' ? ` ${roleEmoji} **${selectedRole}**` : ''} of **${userData.characterData.realm}** pledge to honor the tenets of the Holy Gehy Empire:`,
  '',
  '• To embrace all souls who seek refuge beneath our banners',
  '• To nurture the sacred bonds of our fellowship',
  '• To share in both triumph and tribulation as one community',
  '• To spread joy and revelry throughout our realm',
  '',
  '*The Empire remembers your oath, and the spores bear witness.*'
].join('\n');

    
    // Create submit button
    const submitButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(CEREMONY_IDS.submitButton)
        .setLabel('Sign Oath')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📜')
    );
    
    await interaction.editReply({
      content: oathText,
      components: [submitButton]
    });
  } catch (error) {
    console.error('Error handling role selection:', error);
    await interaction.editReply({
      content: 'There was an error processing your role selection. Please try again.',
      components: []
    });
  }
}

// Handle oath submission
async function handleOathSubmission(interaction) {
  await interaction.deferUpdate();
  
  try {
    const userId = interaction.user.id;
    const userData = oathData.get(userId);
    
    if (!userData) {
      await interaction.editReply({
        content: 'Session expired. Please start the oath process again.',
        components: []
      });
      return;
    }
    
    // Process oath completion
    const result = await processOathCompletion(
      interaction.member,
      userData.flair,
      userData.characterData
    );
    
    if (!result.success) {
      await interaction.editReply({
        content: `Failed to complete oath: ${result.error || 'Unknown error'}`,
        components: []
      });
      return;
    }
    
    // Post short public welcome
    const channel = interaction.client.channels.cache.get(CHANNELS.CHAMBER_OF_OATHS);
    if (channel?.isTextBased()) {
      await postShortPublicWelcome({
        channel,
        member: interaction.member,
        flair: userData.flair,
        wowName: userData.characterData.wowName,
        realm: userData.characterData.realm
      });
    }
    
    // Create tips with DM button
    const tips = buildOnboardingTips(userData.characterData);
    
    const dmButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(CEREMONY_IDS.dmTipsButton)
        .setLabel('Send this to my DMs')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📨')
    );
    
    // Clean up stored data
    oathData.delete(userId);
    
    await interaction.editReply({
      content: `✅ **Oath Completed!**\n\nWelcome to the Holy Gehy Empire, ${interaction.member.displayName}!\n\n${tips}`,
      components: [dmButton]
    });
  } catch (error) {
    console.error('Error handling oath submission:', error);
    await interaction.editReply({
      content: 'There was an error processing your oath. Please try again or contact an administrator.',
      components: []
    });
  }
}

// Handle DM tips button
async function handleDMTips(interaction) {
  await interaction.deferUpdate();
  
  try {
    // Get tips from previous message
    const message = interaction.message;
    const content = message.content;
    
    // Extract tips (everything after the welcome line)
    const tipsStart = content.indexOf('✅ **Oath Completed!**');
    const tips = tipsStart >= 0 ? content.substring(tipsStart) : content;
    
    // Send tips via DM
    const success = await sendTipsDM(interaction.user, tips);
    
    if (success) {
      await interaction.followUp({
        content: 'Tips sent to your DMs!',
        flags: MessageFlags.Ephemeral
      });
    } else {
      await interaction.followUp({
        content: 'Failed to send tips to your DMs. Please make sure you have DMs enabled for this server.',
        flags: MessageFlags.Ephemeral
      });
    }
  } catch (error) {
    console.error('Error handling DM tips:', error);
    await interaction.followUp({
      content: 'There was an error sending tips to your DMs.',
      flags: MessageFlags.Ephemeral
    });
  }
}
