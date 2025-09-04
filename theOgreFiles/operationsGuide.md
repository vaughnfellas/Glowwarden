# ⚔️ Operations Guide — The Warden’s Vigil

This manual describes how to keep the Glowwarden awake, healthy, and battle-ready.  
Follow these rites to start, stop, and monitor the bot in both local and production environments.

---

## ▶️ Starting and Stopping

### Local
```bash
npm start
Stops with Ctrl+C, which triggers graceful shutdown.

Discloud
discloud start → launch the bot using discloud.config.

discloud restart → reload after configuration changes.

discloud stop → halt the container.

A true Warden never sleeps — only rests between battles.

💓 Health & Monitoring
No HTTP health endpoint is exposed.

Use external uptime checks to confirm the process is alive.

Monitor error logs for repeated reconnection attempts.

🛑 Shutdown Handling
index.js listens for SIGINT and SIGTERM:

Unsubscribes from Supabase channels.

Destroys the Discord client.

Exits only after cleanup completes.

This prevents dangling connections or half-closed chambers.

📜 Logs
Local: stdout/stderr from the Node process.

Discloud: discloud logs tails platform logs.

Common entries include:

Shard ready/resume events.

Invite cleanup sweeps.

Slash command deployment status.

🔧 Recovery Procedures
Token Rotation:

Update DISCORD_TOKEN.

Redeploy.

Run /deploy:commands if necessary.

Database Outage:

/status will report failures.

Verify Supabase service.

Bot continues to operate but DB features will be unavailable.

Shard Restarts:

Bot attempts automatic reconnection with backoff.

Restart the container if retries exceed safe limits.

🕵️ Monitoring Suggestions
Track process uptime and memory usage.

Alert on repeated error patterns or reconnection warnings.

Review logs for invite usage and temporary VC sweeps.

A vigilant Glowwarden peers into every shadow for signs of fracture.

✅ Production Readiness Checklist
 All required environment variables set and tested.

 Bot has necessary Discord permissions: Manage Channels, Move Members, Create Invite.

 Supabase tables characters and invite_mappings migrated.

 /status reports green for both bot and database.

 Backup plan in place for Discord token and Supabase credentials.

May the Glowwarden stand ready, steadfast, and unbroken.