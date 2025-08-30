🧙‍♂️ Spore Inviter — For the Grand Ogre
# ⚠️ Here Be Spores ⚠️  
*A scroll for the Grand Ogre’s eyes only...*

Welcome to **Spore Inviter**, the ogre-forged contraption that wrangles guests, spores, and war chambers. Handle with care (and perhaps a club).

📦 Setup

Clone this repo:

git clone https://github.com/vaughnfellas/spore-inviter.git
cd spore-inviter


Install dependencies:

npm install


Create a .env file (copy from .env.example):

cp .env.example .env


Fill in the real values (bot token, IDs, etc).

Run locally:

npm run dev


Deploy slash commands (guild or global):

npm run deploy:commands

⚙️ Environment Variables
Variable	Purpose
DISCORD_TOKEN	Your bot token (from Developer Portal).
CLIENT_ID	Bot’s Application ID.
GUILD_ID	(Optional) Guild/server ID for faster command deploys. Leave empty for global.
SPORE_BOX_CHANNEL_ID	Text channel where guest invites get posted.
LOBBY_VC_ID	The “join-to-create” voice channel ID (➕⚔️-rent-a-war-chamber).
TEMP_VC_CATEGORY_ID	Category where temp War Chambers are created.
TEMP_VC_NAME_FMT	Template for temp VC names ({user} replaced with display name).
TEMP_HOST_ROLE_ID	Role granted to temp VC owners.
LOG_CHANNEL_ID	Channel where bot logs activity (optional).
SWEEP_CRON	Cron schedule for auto-clean sweeps (default every 10m).
TEMP_VC_DELETE_AFTER	Seconds before an empty VC is deleted.
ENABLE_TEMP_VCS	true/false — enable temporary VC feature.
ENABLE_INVITE_SYSTEM	true/false — enable guest-pass system.
ENABLE_LOGGING	true/false — enable bot logging.
ENABLE_AUTO_SWEEP	true/false — enable background sweeper.
BOT_STATUS	Custom status message (default “Watching for spores...”).
BOT_ACTIVITY_TYPE	Status type (PLAYING, WATCHING, LISTENING, COMPETING).
🛠 Features

Guest Pass Invites 🪪
Controlled invites into #spore-box, with default/max uses.

Temporary Voice Channels 🎙
Create “War Chambers” on demand, auto-clean when empty.

Role Management 🛡
Temp VC owners get a role (removed when VC is deleted).

Sweeper 🧹
Periodic cron job removes leftover empty VCs.

Logging 📜
Events and sweeps can be logged to a designated channel.

🚀 Deployment

Render/Heroku/Other PaaS: will use

npm start


Local dev:

npm run dev


Slash command deploy:

npm run deploy:commands

🐾 Notes from the Grand Ogre

.env is sacred. .env.example is safe to share.

Do not check in your real token or IDs.

Sweepers sweep, spores spore, War Chambers war.