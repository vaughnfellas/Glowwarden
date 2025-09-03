// oath-service.js - Handles oath-related functionality
import { EmbedBuilder } from 'discord.js';
import { CHANNELS } from './channels.js';

// Get role information based on flair
function getRoleInfo(flavor) {
  const info = {
    'lgbt': {
      title: 'Mycelioglitter',
      description: 'You are now a full member of the Holy Gehy Empire, blessed with the rainbow spores of pride.',
      color: 0x9932CC, // Purple
    },
    'ally': {
      title: 'Glitter Ally', 
      description: 'You stand as a cherished ally within the Holy Gehy Empire, bearing the sacred trust of fellowship.',
      color: 0x4169E1, // Royal Blue
    },
  };

  return info[flavor] || {
    title: 'Imperial Citizen',
    description: 'Welcome to the Holy Gehy Empire.',
    color: 0x808080,
  };
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
          '• `/addalt` - Register additional characters with class selection',
          '• `/roster` - View all your registered characters',
          '• `/switch` - Change your active character (updates nickname)',
          '• `/deletealt` - Remove characters from your roster',
          '',
          '*Your main character was set during the oath ceremony. Use `/switch` to change between characters anytime!*'
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
export function getPublicWelcomeText(member, flavor) {
  const { title } = getRoleInfo(flavor);
  
  const welcomes = {
    'lgbt': `🌈 **Welcome to the Holy Gehy Empire, Mycelioglitter ${member}!** The rainbow spores sing your name.`,
    'ally': `🤝 **Welcome to the Holy Gehy Empire, Glitter Ally ${member}!** Your fellowship strengthens our bonds.`,
  };

  return welcomes[flavor] || `**Welcome to the Holy Gehy Empire, ${title} ${member}!**`;
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