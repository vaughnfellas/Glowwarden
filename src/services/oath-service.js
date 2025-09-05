// oath-service.js - Handles oath-related functionality
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { CHANNELS } from '../channels.js';
import { config } from '../config.js';
import { CharacterDB } from '../database/characters.js';

// Get role information based on flair
function getRoleInfo(flavor) {
  const info = {
    'lgbt': {
      title: 'Mycelioglitter',
      description: 'You are now a full member of the Holy Gehy Empire, blessed with the rainbow spores of pride.',
      color: 0x9932CC, // Purple
      roleId: config.ROLE_LGBTQ
    },
    'ally': {
      title: 'Glitter Ally', 
      description: 'You stand as a cherished ally within the Holy Gehy Empire, bearing the sacred trust of fellowship.',
      color: 0x4169E1, // Royal Blue
      roleId: config.ROLE_ALLY
    },
  };

  return info[flavor] || {
    title: 'Imperial Citizen',
    description: 'Welcome to the Holy Gehy Empire.',
    color: 0x808080,
    roleId: null
  };
}

// Determine final role based on base role and flair
function getFinalRole(baseRoleId, flairType) {
  // Map of base role + flair combinations to final roles
  const roleMap = {
    // Member base role
    [`${config.ROLE_BASE_MEMBER}:lgbt`]: config.ROLE_FINAL_MYCE,
    [`${config.ROLE_BASE_MEMBER}:ally`]: config.ROLE_FINAL_GALLIES,
    
    // Officer base role
    [`${config.ROLE_BASE_OFFICER}:lgbt`]: config.ROLE_FINAL_GCRUS,
    [`${config.ROLE_BASE_OFFICER}:ally`]: config.ROLE_FINAL_BBEAR,
    
    // Veteran base role
    [`${config.ROLE_BASE_VETERAN}:lgbt`]: config.ROLE_FINAL_RAPO,
    [`${config.ROLE_BASE_VETERAN}:ally`]: config.ROLE_FINAL_RALLYLT,
  };

  const key = `${baseRoleId}:${flairType}`;
  return roleMap[key] || null;
}

// Create welcome DM with instructions
export function createWelcomeDM(member, flavor) {
  const { title, description, color } = getRoleInfo(flavor);
  
  const embed = new EmbedBuilder()
    .setTitle(`Welcome, ${title} ${member.displayName}!`)
    .setDescription(description)
    .setColor(color)
    .setThumbnail(member.user.displayAvatarURL())
    .addFields([
      {
        name: '🎭 Character Management',
        value: [
          'Manage your WoW character roster with these commands:',
          '• `/alt` - Complete character management system',
          '',
          '*Your main character was set during the oath ceremony. Use `/alt` to manage your characters anytime!*'
        ].join('\n'),
        inline: false,
      },
     
      {
        name: '🏰 War Chambers (Temp VCs)',
        value: [
          'Rent private voice channels for your guests:',
          '• Join the *+ Rent A War Chamber* voice channel',
          '• A personal chamber will be created automatically',
          '• You become the chamber owner with full permissions',
          '• Chambers auto-delete after 5 minutes of being empty'
        ].join('\n'),
        inline: false,
      },
      {
        name: '🧭 Moving Your Guests',
        value: [
          '**Option 1:** Have your guest use `/vc` in the appropriate channel',
          '• They select your name from the autocomplete',
          '• They\'ll be moved directly to your War Chamber',
          '',
          '**Option 2:** Move them manually',
          '• Right-click their name in voice chat',
          '• Select "Move to" → your War Chamber',
          '• (You need Move Members permission in both channels)'
        ].join('\n'),
        inline: false,
      },
      {
        name: '⚔️ Need Help?',
        value: [
          'If you encounter any issues or need assistance:',
          '• Ping **@TheCourt** for moderator help',
          '• They can assist with technical issues, role problems, or general questions',
          '• Remember: we\'re here to support each other!'
        ].join('\n'),
        inline: false,
      }
    ])
    .setFooter({ 
      text: 'The spores welcome you, and the Empire grows stronger with your presence.' 
    })
    .setTimestamp();

  return embed;
}

// Send welcome DM to user
export async function sendOathCompletionDM(member, flavor) {
  try {
    const embed = createWelcomeDM(member, flavor);
    await member.send({ embeds: [embed] });
    console.log(`📬 Sent oath completion DM to ${member.user.tag} (${flavor})`);
    return true;
  } catch (error) {
    console.error(`Failed to send oath completion DM to ${member.user.tag}:`, error);
    return false;
  }
}

// Get public welcome text for announcements
export function getPublicWelcomeText(member, characterName, characterClass, flavor) {
  const { title } = getRoleInfo(flavor);
  const charInfo = characterClass ? `${characterName} the ${characterClass}` : characterName;
  
  const welcomes = {
    'lgbt': `🌈 **Welcome to the Holy Gehy Empire, Mycelioglitter ${member}!** The rainbow spores sing the name of ${charInfo}.`,
    'ally': `🤝 **Welcome to the Holy Gehy Empire, Glitter Ally ${member}!** Your fellowship as ${charInfo} strengthens our bonds.`,
  };

  return welcomes[flavor] || `**Welcome to the Holy Gehy Empire, ${title} ${member}!** ${charInfo} joins our ranks.`;
}

// Create the RP scene text for oath ceremony
export function createOathSceneText(userMention, flavor, characterName, characterClass) {
  const lines = [];
  const nameWithClass = characterClass ? `${characterName}, ${characterClass}` : characterName;
  
  lines.push(`📜 **Narrator:** Attendants guide ${userMention} through a hidden door of living bark. Candles stir; the spore-song hums.`);
  lines.push(`*"${nameWithClass} approaches the sacred chamber..."*`);

  if (flavor === 'lgbt') {
    lines.push('A chamber draped in rainbow moss welcomes you. Mushroom-folk pour shimmering spore-tea as fragrant smoke curls through the air. Saint Fungus and Geebus drift by with warm smiles. ☕');
    lines.push(`Tap **Accept Oath** to seal your mantle as **Mycelioglitter ${characterName}**.`);
  } else if (flavor === 'ally') {
    lines.push('Lantern-light and cushions await. Companions beckon you to sit, share tea, and breathe easy among friends. Saint Fungus raises a mug; Geebus offers a pipe with a wink. ☕');
    lines.push(`Tap **Accept Oath** to join the ranks of the **Glitter Allies** as **${characterName}**.`);
  } else {
    lines.push(`Your path as **${characterName}** will be recognized upon oath. Tap **Accept Oath** to proceed.`);
  }

  return lines.join('\n');
}

// Create oath acceptance button
export function createOathAcceptButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('accept_oath')
      .setLabel('Accept Oath')
      .setStyle(ButtonStyle.Success)
      .setEmoji('📜')
  );
}

// Process oath completion - assign roles and register character
export async function processOathCompletion(member, flavor, characterName, characterClass, characterRealm, characterRole) {
  try {
    console.log(`Processing oath completion for ${member.user.tag}`);
    
    // 1. Find the user's base role
    let baseRoleId = null;
    for (const roleId of [config.ROLE_BASE_MEMBER, config.ROLE_BASE_OFFICER, config.ROLE_BASE_VETERAN]) {
      if (member.roles.cache.has(roleId)) {
        baseRoleId = roleId;
        break;
      }
    }
    
    if (!baseRoleId) {
      console.error(`No base role found for ${member.user.tag}`);
      return { success: false, error: 'No base role found' };
    }
    
    // 2. Add flair role
    const flairInfo = getRoleInfo(flavor);
    if (flairInfo.roleId) {
      try {
        await member.roles.add(flairInfo.roleId);
        console.log(`Added flair role ${flairInfo.roleId} to ${member.user.tag}`);
      } catch (error) {
        console.error(`Failed to add flair role to ${member.user.tag}:`, error);
        return { success: false, error: 'Failed to add flair role' };
      }
    }
    
    // 3. Determine and add final role
    const finalRoleId = getFinalRole(baseRoleId, flavor);
    if (finalRoleId) {
      try {
        await member.roles.add(finalRoleId);
        console.log(`Added final role ${finalRoleId} to ${member.user.tag}`);
        
        // Remove base role if configured to do so
        if (config.CEREMONY_REMOVE_BASE_ON_FINAL) {
          await member.roles.remove(baseRoleId);
          console.log(`Removed base role ${baseRoleId} from ${member.user.tag}`);
        }
      } catch (error) {
        console.error(`Failed to add final role to ${member.user.tag}:`, error);
        return { success: false, error: 'Failed to add final role' };
      }
    }
    
    // 4. Register character as main
    try {
      // Check if character exists first
      const exists = await CharacterDB.characterExists(member.user.id, characterName);
      
      if (exists) {
        await CharacterDB.setMainCharacter(member.user.id, characterName);
      } else {
        await CharacterDB.addCharacter(
          member.user.id, 
          characterName, 
          characterClass || null, 
          characterRealm || null, 
          true, // isMain = true
          characterRole || null
        );
      }
      
      // Update nickname
      try {
        if (member.manageable) {
          await member.setNickname(characterName);
        }
      } catch (nickError) {
        console.warn(`Could not set nickname for ${member.user.tag}:`, nickError);
      }
      
      console.log(`Registered main character ${characterName} for ${member.user.tag}`);
    } catch (error) {
      console.error(`Failed to register character for ${member.user.tag}:`, error);
      return { success: false, error: 'Failed to register character' };
    }
    
    // 5. Send welcome DM
    await sendOathCompletionDM(member, flavor);
    
    return { success: true };
  } catch (error) {
    console.error(`Error in processOathCompletion for ${member.user.tag}:`, error);
    return { success: false, error: error.message };
  }
}

// Check if decree exists and is pinned, create if not
export async function ensureDecreeExists(client) {
  try {
    const guild = client.guilds.cache.get(config.GUILD_ID);
    if (!guild) return false;
    
    const oathChannel = guild.channels.cache.get(CHANNELS.CHAMBER_OF_OATHS);
    if (!oathChannel?.isTextBased()) return false;
    
    // Check for pinned decree
    const pins = await oathChannel.messages.fetchPinned();
    const existingDecree = pins.find(msg => 
      msg.embeds.length > 0 && 
      msg.embeds[0].title?.includes('Imperial Decree')
    );
    
    if (existingDecree) {
      console.log('Imperial Decree already exists and is pinned');
      return true;
    }
    
    // Create new decree
    console.log('No pinned Imperial Decree found, creating one...');
    
    const embed = new EmbedBuilder()
      .setTitle('📜 **Imperial Decree — Welcome Traveler**')
      .setDescription(
        [
          '*Hear the call, wayfarer! You now stand before the radiant banners of the Empire, where Pride is power, spores are sacred, and fellowship endures forever.*',
          '',
          '🛡️ **The Imperial Decree**',
          '• All are welcome beneath our rainbow standard — LGBTQ+ and Allies alike.',
          '• Heresy of hate shall not pass our gates — bigotry, slurs, or mockery of identity are banishable offenses.',
          '• **Claim your true name** — declare your WoW character name as you sign.',
          '• Honor the fellowship — laughter, respect, and solidarity guide our quests more than gold or gear.',
          '',
          '**Place your seal upon this decree and declare your truth:**',
          '*When you sign below, you\'ll be prompted to enter your character information for the guild records.*',
        ].join('\n')
      )
      .setColor(0x8B4513)
      .setFooter({ text: 'May the spores guide your path, champion.' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('flair:lgbt').setLabel('🌈 LGBTQIA2S+').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('flair:ally').setLabel('🤝 Ally').setStyle(ButtonStyle.Secondary),
    );
    
    const message = await oathChannel.send({ embeds: [embed], components: [row] });
    await message.pin();
    
    return true;
  } catch (error) {
    console.error('Failed to ensure decree exists:', error);
    return false;
  }
}
