// oath-service.js - Streamlined oath ceremony functionality
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { CHANNELS } from '../channels.js';
import { config } from '../config.js';
import { CharacterDB } from '../database/characters.js';
import {
  ROLES,
  getRoleName,
  getDisplayRole,
  findBaseRole,
  getFinalRoleId,
  getFlairRoleId,
} from '../roles.js';

// IDs for ceremony interactions
export const CEREMONY_IDS = {
  lgbtButton: 'ceremony:lgbt',
  allyButton: 'ceremony:ally',
  submitButton: 'ceremony:submit',
  dmTipsButton: 'ceremony:dm-tips'
};

// WoW class options with emojis
export const CLASS_OPTIONS = [
  { name: 'Druid', value: 'Druid', emoji: '🐻' },
  { name: 'Hunter', value: 'Hunter', emoji: '🏹' },
  { name: 'Mage', value: 'Mage', emoji: '🔮' },
  { name: 'Paladin', value: 'Paladin', emoji: '🛡️' },
  { name: 'Priest', value: 'Priest', emoji: '✨' },
  { name: 'Rogue', value: 'Rogue', emoji: '🗡️' },
  { name: 'Shaman', value: 'Shaman', emoji: '⚡' },
  { name: 'Warlock', value: 'Warlock', emoji: '🔥' },
  { name: 'Warrior', value: 'Warrior', emoji: '⚔️' },
  { name: 'Other', value: 'Other', emoji: '❓' }
];

// Role options
export const ROLE_OPTIONS = [
  { name: 'Tank', value: 'tank', emoji: '🛡️' },
  { name: 'Healer', value: 'healer', emoji: '💚' },
  { name: 'DPS', value: 'dps', emoji: '⚔️' },
  { name: 'None', value: 'none', emoji: '⏭️' }
];

// Get role information based on flair
function getRoleInfo(flavor) {
  return {
    lgbt: {
      flairRoleId: ROLES.LGBTQIA2S,
      finalRoleMap: {
        [ROLES.MEMBER]: ROLES.MYCELIOGLITTER,
        [ROLES.OFFICER]: ROLES.GLITTER_CRUSADER,
        [ROLES.VETERAN]: ROLES.RAINBOW_APOSTLE,
      },
    },
    ally: {
      flairRoleId: ROLES.ALLY,
      finalRoleMap: {
        [ROLES.MEMBER]: ROLES.GLITTER_ALLY,
        [ROLES.OFFICER]: ROLES.BANNER_BEARER,
        [ROLES.VETERAN]: ROLES.RAINBOW_ALLY_LT,
      },
    },
  }[flavor] || { flairRoleId: null, finalRoleMap: {} };
}

// Create the decree embed and buttons
export function createDecreeEmbed() {
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
      ].join('\n')
    )
    .setColor(0x8B4513)
    .setFooter({ text: 'May the spores guide your path, champion.' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CEREMONY_IDS.lgbtButton)
      .setLabel('🌈 LGBTQIA2S+')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(CEREMONY_IDS.allyButton)
      .setLabel('🤝 Ally')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embed, row };
}

// Create concise onboarding tips
// Create concise onboarding tips
export function buildOnboardingTips({ wowName, chosenClass, chosenRole, realm, classEmoji, roleEmoji }) {
  const cls = chosenClass && chosenClass !== 'Other' ? chosenClass : '—';
  const role = chosenRole || '—';
  const roleDisplay = chosenRole && chosenRole !== 'none' ? ` ${roleEmoji} **${chosenRole}**` : '';

  return [
    `🍄 **Welcome to the Holy Gehy Empire, ${wowName}!** 🍄`,
    '',
    'Your banner has been raised in our halls, the spores sing your name!',
    '',
    '**Character Management:**',
    '• Use `/alt` to manage your roster of champions',
    '• Your oath is recorded in the imperial archives',
    '',
    '**War Chambers:**',
    '• Join the *Rent A War Chamber* voice channel to create your private sanctuary',
    '• As a chamber host, you\'ll receive Stray Spore invites to share with outsiders',
    '• These mystical invites vanish when your chamber closes',
    '',
    '**Need Guidance?**',
    '• Summon @TheCourt for assistance with imperial matters',
    '• Commune with the bot spirits via `/status` or `/ping`',
    '',
    '---',
    '',
    '**Your Sworn Oath:**',
    '',
    `*By the light of the sacred mushrooms and the rainbow spores that bind us,`,
    `I, **${wowName}**, ${classEmoji} **${cls}**${roleDisplay} of **${realm}**,`,
    'pledge to honor the Empire\'s tenets:*',
    '',
    '• To embrace all souls who seek refuge beneath our banners',
    '• To nurture the sacred bonds of our fellowship',
    '• To share in both triumph and tribulation as one community',
    '• To spread joy and revelry throughout our realm',
    '',
    '*The Empire remembers your oath, and the spores bear witness.*'
  ].join('\n');
}


// Post a short welcome message
export async function postShortPublicWelcome({ channel, member, wowName, realm, classEmoji }) {
  // Get the member's display role (their final role)
  const displayRole = getDisplayRole(member);
  const cls = chosenClass && chosenClass !== 'Other' ? chosenClass : '—';
  return channel.send({
    content: `Welcome **${displayRole}** <@${member.id}> — ${classEmoji} **${cls}** of **${realm}**!`
  });
}
// Process oath completion
export async function processOathCompletion(member, flair, characterData) {
  try {
    console.log(`Processing oath for ${member.user.tag} as ${flair}`);
    const { wowName, chosenClass, chosenRole, realm } = characterData;
    
    // 1. Find the user's base role
    const baseRoleId = findBaseRole(member);
    
    if (!baseRoleId) {
      console.error(`No base role found for ${member.user.tag}`);
      return { success: false, error: 'No base role found' };
    }
    
    // 2. Add flair role
    const flairRoleId = getFlairRoleId(flair);
    if (flairRoleId) {
      try {
        await member.roles.add(flairRoleId);
        console.log(`Added flair role ${flairRoleId} to ${member.user.tag}`);
      } catch (error) {
        console.error(`Failed to add flair role to ${member.user.tag}:`, error);
      }
    }
    
    // 3. Add final role based on base role + flair
    const finalRoleId = getFinalRoleId(baseRoleId, flair);
    if (finalRoleId) {
      try {
        await member.roles.add(finalRoleId);
        console.log(`Added final role ${finalRoleId} to ${member.user.tag}`);
      } catch (error) {
        console.error(`Failed to add final role to ${member.user.tag}:`, error);
      }
    }
    
    // 4. Remove base role
    try {
      await member.roles.remove(baseRoleId);
      console.log(`Removed base role ${baseRoleId} from ${member.user.tag}`);
    } catch (error) {
      console.error(`Failed to remove base role from ${member.user.tag}:`, error);
    }
    // 5. Remove base role
    try {
      await member.roles.remove(baseRoleId);
      console.log(`Removed base role ${baseRoleId} from ${member.user.tag}`);
    } catch (error) {
      console.error(`Failed to remove base role from ${member.user.tag}:`, error);
    }
    
    // 6. Register character as main
    try {
      await CharacterDB.addCharacter(
        member.user.id, 
        wowName, 
        chosenClass === 'Other' ? null : chosenClass, 
        realm, 
        true, // isMain = true
        chosenRole === 'none' ? null : chosenRole
      );
      
      // Update nickname
      try {
        if (member.manageable) {
          await member.setNickname(wowName);
        }
      } catch (nickError) {
        console.warn(`Could not set nickname for ${member.user.tag}:`, nickError);
      }
      
      console.log(`Registered main character ${wowName} for ${member.user.tag}`);
    } catch (error) {
      console.error(`Failed to register character for ${member.user.tag}:`, error);
    }
    
    return { success: true };
  } catch (error) {
    console.error(`Error in processOathCompletion for ${member.user.tag}:`, error);
    return { success: false, error: error.message };
  }
}

// Send tips via DM
export async function sendTipsDM(member, tips) {
  try {
    await member.send({ content: tips });
    return true;
  } catch (error) {
    console.error(`Failed to send tips DM to ${member.user.tag}:`, error);
    return false;
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
    
    const { embed, row } = createDecreeEmbed();
    const message = await oathChannel.send({ embeds: [embed], components: [row] });
    await message.pin();
    
    return true;
  } catch (error) {
    console.error('Failed to ensure decree exists:', error);
    return false;
  }
}
