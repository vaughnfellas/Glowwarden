# 🌌 Glowwarden Bot

## 📖 Overview
Glowwarden is the Discord bot of the **Holy Gehy Empire**.  
It manages player characters, temporary voice channels, and invite-driven roles while providing operational utilities for moderators.

Core features:
- **Alt / Character Management** – players register and maintain their World of Warcraft characters.
- **Temporary War Chambers** – automated creation and cleanup of temporary voice channels.
- **Invite Role Mapping** – invite links assign configured roles and initiate the oath ceremony.
- **Administration Utilities** – diagnostic commands for permissions, IDs, latency, and status.

---

## 🏛️ Architecture

index.js
├─ commands/
│ └─ slash command modules (alt, decree, vc, etc.)
├─ events/
│ ├─ ready.js
│ ├─ interactionCreate.js
│ └─ voiceStateUpdate.js
├─ services/
│ ├─ temp-vc-service.js
│ ├─ invite-role-service.js
│ └─ oath-service.js
└─ db.js (Supabase client singleton)

markdown
Copy code

Singletons:
- **config.js** – environment values and feature flags
- **channels.js** – channel/role ID map
- **db.js** – single Supabase client shared by all modules

---

## ⚙️ Setup and Installation

### Prerequisites
- Node.js **20+**
- npm
- A Supabase project (for persistent storage)
- A Discord application and bot token

### Installation
```bash
git clone <repository>
cd Glowwarden
npm install
Environment Variables
Create a .env file or set variables in your host. Minimum required:

Variable	Purpose
DISCORD_TOKEN	Discord bot token
CLIENT_ID	Discord application ID
GUILD_ID	Target guild ID
SUPABASE_URL	Supabase project URL
SUPABASE_SERVICE_KEY	Supabase service role key

See docs/CONFIG.md for the complete list.

Scripts
npm start – run the bot

npm run dev – run with development settings

npm test – execute Node test runner

npm run deploy:commands – register slash commands

🗡️ Command Overview
Glowwarden exposes multiple slash commands grouped by feature areas.
See docs/COMMANDS.md for full reference.

🎧 Event Overview
ready – initializes services and deploys commands

interactionCreate – routes slash commands and component interactions

voiceStateUpdate – manages temporary voice channels

📂 Database
Glowwarden uses a single Supabase client for persistence.

Table	Purpose
characters	Stores user character rosters
invite_mappings	Maps invite codes to role IDs

🧪 Testing
Run unit tests with:

bash
Copy code
npm test
Uses Node’s built-in test runner.

Place tests in *.test.js.

Mock Discord.js and Supabase calls when possible.

🚀 Deployment
Local
Run with:

bash
Copy code
npm start
(Ensure .env is configured.)

Discloud
Deploy using discloud.config.
index.js is the entry point.

Glowwarden handles graceful shutdown on SIGINT/SIGTERM:

Closes Supabase subscriptions.

Destroys the Discord client.

🔧 Troubleshooting / FAQ
Problem	Solution
Missing DISCORD_TOKEN or Supabase keys	Verify .env values and rerun npm start.
Commands not appearing	Run npm run deploy:commands; ensure the bot has Use Application Commands.
Temp VC not created	Check bot permissions: Manage Channels, Move Members.
Database errors	Confirm Supabase URL/key and ensure service is reachable.

🤝 Contributing
Use ES modules for all imports/exports.

Reuse the shared Supabase client from src/db.js.

Do not hardcode ephemeral: true; use MessageFlags.Ephemeral.

Avoid duplicate Supabase clients; follow existing patterns.

The Glowwarden endures as the Empire’s vigilant keeper. Configure wisely, deploy carefully, and may your chambers never fall silent.