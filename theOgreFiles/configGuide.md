# ⚙️ Configuration Guide — Sacred Seals of the Glowwarden

Glowwarden centralizes configuration in **`src/config.js`**.  
Environment variables are drawn from the host at startup and normalized for use across the bot.  
Missing critical values cause the process to fail outside of development — for the Warden refuses to awaken unprepared.

---

## 📜 Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DISCORD_TOKEN`          | Discord bot token used for login. | Yes | – |
| `CLIENT_ID`              | Discord application (client) ID. | Yes | – |
| `GUILD_ID`               | Guild where slash commands are registered. | Yes | – |
| `SUPABASE_URL`           | Supabase project URL. | Yes | – |
| `SUPABASE_SERVICE_KEY`   | Supabase service role key (server-side). | Yes | – |
| `SUPABASE_ANON_KEY`      | Optional anon key for public requests. | No | – |
| `STRAY_SPORE_ROLE_ID`    | Role granted to invited guests (Stray Spores). | Yes (for VC) | – |
| `TEMP_HOST_ROLE_ID`      | Role granted to War Chamber hosts. | Yes (for VC) | – |
| `BATTLEFRONT_CATEGORY_ID`| Category where temporary VCs are created. | Yes (for VC) | – |
| `RENT_WAR_CHAMBER_VC_ID` | Lobby channel for spawning War Chambers. | Yes (for VC) | – |
| `NODE_ENV`               | Runtime environment: `development` or `production`. | No | `development` |

Additional seals control features such as invite mappings, oath acknowledgements, and sweep intervals.

---

## 🔑 `config.js`

The file **`src/config.js`**:
- Reads all variables once at startup.  
- Validates required keys.  
- Halts the process if critical values are missing (outside of dev).  

Thus, it acts as the **single source of truth** for configuration across commands, events, and services.

---

## 📢 Logging

The bot uses standard console methods with level separation:

- `console.log` → informational messages.  
- `console.warn` → warnings, recoverable anomalies.  
- `console.error` → errors and failures requiring attention.  

> *Logs are the Glowwarden’s whispers — heed them well.*

---

## 🧭 Feature Flags & Limits

- `PUBLIC_ACK` → toggles **public oath acknowledgements**.  
- `SWEEP_INTERVAL_SEC` → sets interval (in seconds) for cleaning temporary rooms.  
- `CEREMONY_REMOVE_BASE_ON_FINAL` → enables automatic removal of base roles once final flair is assigned.  

---

## 🔄 Updating Configuration

1. Edit the `.env` file or update host environment variables.  
2. Restart the bot (`npm start` locally or redeploy on Discloud).  
3. Run `/status` to verify the new values are live.  

> *A mis-set seal may silence the Warden; always confirm your rituals.*
