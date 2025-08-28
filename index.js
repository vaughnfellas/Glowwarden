import 'dotenv/config';
import { Client, GatewayIntentBits, PermissionFlagsBits, ChannelType } from 'discord.js';

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const SPORE_BOX_CHANNEL_ID = process.env.SPORE_BOX_CHANNEL_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || '0';
const DEFAULT_USES = parseInt(process.env.DEFAULT_USES || '4', 10);
const MAX_USES = parseInt(process.env.MAX_USES || '10', 10);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'strays') return;

  // Clamp requested uses to [1, MAX_USES] with DEFAULT_USES fallback
  const requested = interaction.options.getInteger('count') ?? DEFAULT_USES;
  const uses = Math.min(Math.max(requested, 1), MAX_USES);

  try {
    // Resolve #spore-box
    const spore = await client.channels.fetch(SPORE_BOX_CHANNEL_ID);
    if (!spore || spore.type !== ChannelType.GuildText) {
      await interaction.reply({ content: '❌ I can’t find **#spore-box**. Check `SPORE_BOX_CHANNEL_ID` in your `.env`.', ephemeral: true });
      return;
    }

    // Check perms: View + Create Invite
    const me = await interaction.guild.members.fetchMe();
    const perms = spore.permissionsFor(me);
    if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.CreateInstantInvite])) {
      await interaction.reply({ content: '❌ I need **Create Invite** (and View) in **#spore-box**.', ephemeral: true });
      return;
    }

    // Ephemeral "working..." so we can edit later
    await interaction.deferReply({ ephemeral: true });

    // Create invite (24h, N uses)
    const invite = await spore.createInvite({
      maxAge: 86400, // 24h (seconds)
      maxUses: uses,
      unique: true,
      reason: `Strays by ${interaction.user.tag} (${interaction.user.id})`
    });

    // 1) RP flourish (public message in the same channel)
    try {
      await interaction.channel?.send(
        `🌿 ${interaction.user} loosens a spore-satchel; **${uses}** guest passes swirl into being.`
      );
    } catch {
      // Not critical if the command channel is locked for sending
    }

    // 2) DM the invite to the user
    let dmSent = true;
    try {
      await interaction.user.send(
        [
          `Here are your guest passes for **#spore-box** (valid 24h, **${uses}** uses):`,
          invite.url,
          '',
          '_If you need a temp voice channel, ping a mod or use the Inn once it’s open._'
        ].join('\n')
      );
    } catch {
      dmSent = false;
    }

    // 3) Ephemeral confirmation (fallback with link if DMs are closed)
    if (dmSent) {
      await interaction.editReply('✉️ Your passes have been sent to your DMs.');
    } else {
      await interaction.editReply(
        `⚠️ I couldn’t DM you (privacy settings). Here’s your invite (only you can see this):\n${invite.url}`
      );
    }

    // Log to #hall-of-records if configured
    if (LOG_CHANNEL_ID !== '0') {
      try {
        const log = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (log?.isTextBased()) {
          const expiresTs = Math.floor(Date.now() / 1000) + 86400;
          await log.send(
            [
              `📜 **Strays Issued**`,
              `• By: ${interaction.user} (${interaction.user.tag})`,
              `• Uses: **${uses}**`,
              `• Link: ${invite.url}`,
              `• Expires: <t:${expiresTs}:R>`,
              `• Channel: <#${SPORE_BOX_CHANNEL_ID}>`
            ].join('\n')
          );
        }
      } catch {
        // logging is best-effort
      }
    }
  } catch (err) {
    console.error('Invite error:', err);
    // Try to reply or update the deferred message
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply('❌ Could not create invite (check bot perms).');
      } else {
        await interaction.reply({ content: '❌ Could not create invite (check bot perms).', ephemeral: true });
      }
    } catch {}
  }
});

client.login(TOKEN);
