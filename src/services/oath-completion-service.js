// ============= src/services/oath-completion-service.js =============
import { EmbedBuilder } from 'discord.js';
import { config } from '../config.js';

function getTierInfo(tier, flavor) {
  const info = {
    'mem:lgbt': {
      title: 'Mycelioglitter',
      description: 'You are now a full member of the Holy Gehy Empire, blessed with the rainbow spores of pride.',
      color: 0x9932CC, // Purple
    },
    'mem:ally': {
      title: 'Glitter Ally', 
      description: 'You stand as a cherished ally within the Holy Gehy Empire, bearing the sacred trust of fellowship.',
      color: 0x4169E1, // Royal Blue
    },
    'off:lgbt': {
      title: 'Glitter Crusader',
      description: 'You have risen to lead within the Holy Gehy Empire, wielding both rainbow spores and sacred authority.',
      color: 0xFF6347, // Tomato Red
    },
    'off:ally': {
      title: 'Banner Bearer',
      description: 'You carry the standards of the Empire, leading allies and members alike with wisdom and strength.',
      color: 0x32CD32, // Lime Green
    },
    'vet:lgbt': {
      title: 'Rainbow Apostle',
      description: 'Ancient wisdom flows through you. You are a pillar of the Empire, revered for your long service.',
      color: 0xFFD700, // Gold
    },
    'vet:ally': {
      title: 'Rainbow Ally Lieutenant',
      description: 'Your dedication spans ages. You stand among the Empire\'s most trusted guardians and guides.',
      color: 0xFF8C00, // Dark Orange
    },
  };

  return info[`${tier}:${flavor}`] || {
    title: 'Imperial Citizen',
    description: 'Welcome to the Holy Gehy Empire.',
    color: 0x808080,
  };
}

function createWelcomeDM(member, tier, flavor) {
  const { title, description, color } = getTierInfo(tier, flavor);
  const sporehallMention = config.SPOREHALL_CHANNEL_ID ? `<#${config.SPOREHALL_CHANNEL_ID}>` : 'Sporehall';
  
  const embed = new EmbedBuilder()
    .setTitle(`Welcome, ${title} ${member.displayName}!`)
    .setDescription(description)
    .setColor(color)
    .setThumbnail(member.user.displayAvatarURL())
    .addFields([
      {
        name: '🌿 Stray Spore Invites',
        value: [
          'Use `/strays` to generate guest passes for friends:',
          '• Each invite lasts 24 hours',
          '• You can create 1-10 uses per command',
          '• Guests land in #spore-box and must sign the Visitor Decree',
          '• They become Stray Spores until you guide them to full membership'
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
          `**Option 1:** Have your guest use \`/vc\` in ${sporehallMention}`,
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

export async function sendOathCompletionDM(member, tier, flavor) {
  try {
    const embed = createWelcomeDM(member, tier, flavor);
    await member.send({ embeds: [embed] });
    console.log(`📬 Sent oath completion DM to ${member.user.tag} (${tier}:${flavor})`);
    return true;
  } catch (error) {
    console.error(`Failed to send oath completion DM to ${member.user.tag}:`, error);
    return false;
  }
}

// Function to get a tier-appropriate greeting for public channels
export function getPublicWelcomeText(member, tier, flavor) {
  const { title } = getTierInfo(tier, flavor);
  
  const welcomes = {
    'mem:lgbt': `🌈 **Welcome to the Holy Gehy Empire, Mycelioglitter ${member}!** The rainbow spores sing your name.`,
    'mem:ally': `🤝 **Welcome to the Holy Gehy Empire, Glitter Ally ${member}!** Your fellowship strengthens our bonds.`,
    'off:lgbt': `⚔️ **Welcome to the Holy Gehy Empire, Glitter Crusader ${member}!** Lead with pride and wisdom.`,
    'off:ally': `🏳️ **Welcome to the Holy Gehy Empire, Banner Bearer ${member}!** Carry our standards with honor.`,
    'vet:lgbt': `👑 **Welcome to the Holy Gehy Empire, Rainbow Apostle ${member}!** Your wisdom guides us all.`,
    'vet:ally': `🛡️ **Welcome to the Holy Gehy Empire, Rainbow Ally Lieutenant ${member}!** Your service is legendary.`,
  };

  return welcomes[`${tier}:${flavor}`] || `**Welcome to the Holy Gehy Empire, ${title} ${member}!**`;
}