# 📜 Slash Commands — The Glowwarden Codex

This bot’s commands are divided by feature area. Syntax examples use standard **slash command** notation.  
Use these commands wisely, for they shape the flow of your guild’s halls and chambers.

---

## 🧙 Alt / Character Management

### `/alt`
- **Purpose:** Manage a user’s character roster (create, list, edit, delete).  
- **Usage:** `/alt`  
- **Permissions:** None  
- **Edge Cases:**  
  - Names must be **2–32 characters**, unique per user.  
  - Invalid or duplicate names trigger errors.  

> *The Codex remembers every hero you bind to your name. Guard your roster well.*  

---

## ⚔️ Temporary Voice Chambers

### `/vc-status`
- **Purpose:** View current War Chambers and learn how to create one.  
- **Usage:** `/vc-status`  
- **Permissions:** None  
- **Edge Cases:**  
  - Fails if required lobby/chamber channels are missing.  

---

### `/vc`
Manage access to **War Chambers**.  

| Subcommand | Syntax | Permissions | Edge Cases |
|------------|--------|-------------|------------|
| **goto**   | `/vc goto host:<name>` | Base guild roles | Caller must be in voice; host chamber must exist. |
| **invite** | `/vc invite user:@member` | Chamber owner only | Fails if caller does not own an active chamber. |

> *Every chamber has its Warden; none may trespass without their leave.*  

---

## 🎟️ Invite & Role Mapping

### `/generate-invite`
- **Purpose:** Create an invite that also assigns a role.  
- **Usage:**  
/generate-invite role:<member|officer|veteran>
[uses:<n>] [expires:<days>] [channel:<#channel>]

- **Permissions:** High Prophet (owner); bot must have **Create Invite**.  
- **Edge Cases:**  
- Role IDs must be configured.  
- Channel must exist.  

---

### `/decree`
- **Purpose:** Post the **Imperial Decree** with flair buttons.  
- **Usage:** `/decree`  
- **Permissions:** Manage Guild + owner.  
- **Edge Cases:** Must run in the **Chamber of Oaths** channel.  

> *The Decree is law; only the High Prophet may inscribe it upon the hall.*  

---

## 🛡️ Administration & Utility

### `/glowwarden`
- **Purpose:** List available and blocked commands in the current guild/channel.  
- **Usage:** `/glowwarden`  
- **Permissions:** None  
- **Edge Cases:** Reflects **current command registration** and **channel overrides**.  

---

### `/ids`
- **Purpose:** Export role, channel, or category IDs.  
- **Usage Examples:**  
- `/ids roles [format:text|csv|json] [ephemeral:true|false]`  
- `/ids channels [type:...] [format:...] [ephemeral:true|false]`  
- `/ids categories [format:...] [ephemeral:true|false]`  
- **Permissions:** High Prophet (owner).  
- **Edge Cases:** Large outputs are sent as **file attachments**.  

---

### `/perms`
- **Purpose:** Inspect or apply **default permission overwrites**.  
- **Subcommands:** `show`, `apply`, `apply_all`, `apply_battlefront`, `check_top`, `audit_invites`.  
- **Permissions:** Server admin rights (Manage Channels).  
- **Edge Cases:**  
- Applying overwrites fails if the bot lacks **channel management rights**.  

---

### `/ping`
- **Purpose:** Report bot latency.  
- **Usage:** `/ping`  
- **Permissions:** None  
- **Edge Cases:** None  

---

### `/status`
- **Purpose:** Display bot, database, and environment status.  
- **Usage:** `/status`  
- **Permissions:** None  
- **Edge Cases:** Shows error if Supabase is unreachable.  

---

## ⚖️ Closing Notes

This Codex ensures each command is catalogued, permissions are clear, and edge cases are known.  
Use this as both a **manual of arms** and a **ledger of limits** — for the Glowwarden sees all.  
