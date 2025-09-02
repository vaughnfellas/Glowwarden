# Spore Inviter Bot - Project Structure

## Quick Start

1. **Setup**: Copy `.env.example` to `.env` and fill in your Discord bot token, client ID, and role/channel IDs
2. **Deploy Commands**: `npm run deploy:commands` 
3. **Start Bot**: `npm start`
4. **Health Check**: Visit `http://localhost:3000/healthz`

## Architecture Overview

This Discord bot manages a role-based guild system with temporary voice channels, character registration, and tiered invite system. The bot uses SQLite for character storage and in-memory tracking for voice channels and invites.

**Core Flow**: Guests → Stray Spores → Full Members (via oath ceremony) → Generate invites for others

---

## Root Files

### `index.js` (Entry Point)
- **Purpose**: Bot initialization and service startup
- **Key Actions**: 
  - Creates Discord client with required intents
  - Loads commands and events
  - Initializes services when ready
  - Starts health server and periodic cleanup

### `package.json`
- **Scripts**:
  - `npm start` - Run the bot
  - `npm run deploy:commands` - Deploy slash commands to Discord
  - `npm run check:env` - Validate environment setup

---

## `/src` Directory

### Core Configuration

#### `config.js`
**Purpose**: Central configuration with environment validation
- Loads and validates all environment variables
- Provides type conversion helpers (`toBool`, `toInt`, `snowflake`)
- Maps roles, channels, and system settings
- **Dependencies**: `channels.js`, `.env`

#### `channels.js`
**Purpose**: Single source of truth for Discord channel/role IDs
- Maps descriptive names to Discord snowflake IDs
- Includes helper `getChannelNameById()` for debugging
- **Update this file** when server structure changes

### Commands (`/src/commands/`)

#### `index.js`
**Purpose**: Command registry and interaction router
- **Exports**: `commands` Map, `loadCommands()` function
- **Handles**: Slash commands, autocomplete, modals, buttons
- **Special Logic**: AddAlt character management flows

#### Core Commands
| Command               | Purpose                   | Permissions       | Key Features                          |
|---------              |---------                  |-------------      |--------------                         |
| `/strays`             | Generate guest passes     | ManageGuild       | 1-10 uses, 24h expiry, auto-role      |
| `/generate-invite`    | Advanced invite system    | ManageGuild       | Tier-specific (stray/officer/veteran) |
| `/vc`                 | Move to host's chamber    | Stray Spore role  | Autocomplete for active hosts         |
| `/decree`             | Post guild rules          | Owner only        | Role selection buttons                |
| `/addalt`             | Character registration    | Any member        | Class selection, main/alt tracking    |
| `/glowwarden`         | Debug command availability| Any member        | Permission troubleshooting            |

#### Utility Commands
- **`ids.js`**: Export role/channel IDs (owner only)
- **`perms.js`**: Permission auditing and templates (owner only)

### Services (`/src/services/`)

#### `invite-service.js`
**Purpose**: Role-based invite creation and tracking
- **Core Function**: `createRoleInvite()` - creates invites that auto-assign roles
- **Tracking**: Maps invite codes to role assignments
- **Integration**: Works with `invite-role-service.js` for role assignment

#### `temp-vc-service.js`
**Purpose**: War Chamber (temporary voice channel) management
- **Trigger**: Join "Rent-a-War-Chamber" voice channel
- **Features**: Auto-creation, host permissions, empty-room cleanup
- **Cleanup**: Configurable deletion timer, periodic sweeps

#### `oath-completion-service.js`
**Purpose**: Welcome messaging after role ceremonies
- **DM Content**: Invite generation instructions, voice channel guide
- **Theming**: Role-specific lore and instructions
- **Integration**: Called from interaction handlers

#### Role & Decree Services
- **`visitor-decree-service.js`**: Manages #spore-box welcome message
- **`sporebox-service.js`**: Alternative spore-box decree management
- **`invite-role-service.js`**: Assigns roles based on any invite usage

### Events (`/src/events/`)

#### `interaction-handler.js`
**Purpose**: Handle all button clicks, modals, and select menus
- **Visitor Decree**: Spore-box role assignment flow
- **Imperial Decree**: Chamber of Oaths ceremony flow  
- **Character Management**: AddAlt modals and confirmations
- **Error Handling**: Graceful failures with user feedback

#### Other Events
- **`ready.js`**: Service initialization, bot presence, cleanup scheduling
- **`voice-state-update.js`**: War Chamber creation/cleanup triggers

### Database (`/src/database/`)

#### `characters.js`
**Purpose**: SQLite character storage for alt/main tracking
- **Schema**: `characters(id, user_id, name, class, realm, is_main, created_at)`
- **Key Features**: Automatic main character management, duplicate prevention
- **File**: `characters.db` in project root (backup this file!)

### Utilities (`/src/utils/`)

#### `env.js`
**Purpose**: Environment variable processing (alternative to config.js)
- Provides `requireEnv()` for mandatory variables
- Normalizes types and provides defaults

#### `owner.js`
**Purpose**: Owner permission checking
- **Functions**: `isOwner()`, `checkOwnerPermission()`
- **Config**: Uses `OWNER_IDS` environment variable

---

## Key Workflows

### New Member Onboarding
1. **Guest arrives** → Clicks flair in #spore-box → Gets Stray Spore role
2. **Goes to Sporehall** → Uses `/vc` to join host's War Chamber
3. **Host promotes them** → Member gets base role (Member/Officer/Veteran)
4. **Takes oath** → Clicks flair in Chamber of Oaths → Gets final tier role

### Invite Generation
1. **Members use `/strays`** → Creates Stray Spore invites (1-10 uses)
2. **Officers/Owners use `/generate-invite`** → Creates tier-specific invites
3. **Auto-role assignment** → New joiners get appropriate roles automatically

### Voice Channel Management
1. **Join "Rent-a-War-Chamber"** → Bot creates private War Chamber
2. **Host gets elevated permissions** → Can manage their chamber
3. **Auto-cleanup** → Empty chambers deleted after timeout

---

## Environment Setup

### Required Variables
```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
GUILD_ID=your_server_id
```

### Role Configuration
All role IDs must be set for the full system to work:
- Flair roles: `ROLE_LGBTQ`, `ROLE_ALLY`
- Base progression: `ROLE_BASE_MEMBER`, `ROLE_BASE_OFFICER`, `ROLE_BASE_VETERAN`
- Final tiers: `ROLE_FINAL_*` (6 combinations of base + flair)

### Channel Configuration
Set in `src/channels.js`:
- `CHAMBER_OF_OATHS` - Main role ceremony channel
- `SPORE_BOX` - Guest welcome channel
- `SPOREHALL` - Guest waiting area
- `BATTLEFRONT` - Category for War Chambers

---

## Troubleshooting

### Commands Not Appearing
1. **Check deployment**: `npm run deploy:commands`
2. **Verify permissions**: Commands need "Use Application Commands" channel permission
3. **Check role restrictions**: Some commands require ManageGuild or owner permissions
4. **Use `/glowwarden`**: Shows which commands are available/blocked and why

### Role Assignment Issues
1. **Check role hierarchy**: Bot role must be above roles it assigns
2. **Verify role IDs**: Use `/ids roles` to export current role IDs
3. **Check invite tracking**: Use `/generate-invite list` to see active invites

### Voice Channel Problems
1. **Check category permissions**: Bot needs Manage Channels in BATTLEFRONT category
2. **Verify voice permissions**: Bot needs Connect/Move Members in voice channels
3. **Manual cleanup**: Visit `/sweep` endpoint to trigger cleanup

### Database Issues
- **File location**: `characters.db` in project root
- **Backup**: Copy `characters.db` file before major changes
- **Reset**: Delete `characters.db` to start fresh (loses all character data)

---

## Development Notes

### Adding New Commands
1. Create command file in `/src/commands/`
2. Add to `commands` Map in `/src/commands/index.js`
3. Add to deployment array in `src/deploy-commands.js`
4. Run `npm run deploy:commands`

### Circular Import Warning
Avoid importing from `/src/commands/index.js` in command files - use `interaction.client.commands` instead

### Storage Limitations
- **In-memory**: Voice channel tracking, invite mapping (lost on restart)
- **Persistent**: Character database only (SQLite file)
- **No browser storage**: Bot runs server-side, not in browser

### Performance Considerations
- **Invite cleanup**: Runs every 30 minutes
- **Voice cleanup**: Configurable via `SWEEP_INTERVAL_SEC`
- **Database**: SQLite is single-threaded, suitable for moderate usage


DID YOU RUN node src/deploy-commands.js?