// src/services/janitor.js
import { InviteDB } from '../database/invites.js';
import { DateTime } from 'luxon';

/**
 * Timezone and scheduling knobs (overridable via env)
 */
const TZ = process.env.JANITOR_TZ || 'America/Los_Angeles';
const NIGHTLY_HOUR = Number(process.env.JANITOR_HOUR || 3); // 3am local by default

/**
 * Schedule jobs to run nightly at the configured hour
 * @param {import('discord.js').Client} client - Discord.js client
 * @param {Array<Function>} jobs - Array of async functions (client) => Promise<void>
 */
export function scheduleNightly(client, jobs = []) {
  const rearm = () => {
    const now = DateTime.now().setZone(TZ);
    let next = now.set({ hour: NIGHTLY_HOUR, minute: 0, second: 0, millisecond: 0 });
    if (next <= now) next = next.plus({ days: 1 });
    const delay = Math.max(1_000, next.toMillis() - now.toMillis());

    setTimeout(async () => {
      try {
        console.log(`[JANITOR] Nightly run start ${DateTime.now().setZone(TZ).toISO()}`);
        for (const job of jobs) {
          try {
            await job(client);
          } catch (e) {
            console.error(`[JANITOR] Job failed: ${job.name || 'unnamed'}`, e);
          }
        }
        console.log('[JANITOR] Nightly run complete');
      } finally {
        rearm(); // schedule next night
      }
    }, delay);

    console.log(`[JANITOR] Next run at ${next.toISO()} (${TZ})`);
  };

  // Start the scheduling
  rearm();
}

/**
 * Prune role invites that are expired or exhausted, with a grace period
 * to avoid racing recent joins/oath flow.
 * @param {import('discord.js').Client} client - Discord.js client
 */
export async function pruneRoleInvites(client) {
  try {
    console.log('[JANITOR] Starting invite prune');
    const now = Math.floor(Date.now() / 1000);

    // Grace period for recently used/updated invites (10 minutes)
    const GRACE_PERIOD_SECONDS = 10 * 60;

    // Use DB's cleanup for expired invites with a grace period if supported
    try {
      if (typeof InviteDB.cleanupExpiredInvites === 'function') {
        const expired = await InviteDB.cleanupExpiredInvites(GRACE_PERIOD_SECONDS);
        if (expired?.ok && expired?.data?.cleanedCount > 0) {
          console.log(`[JANITOR] Removed ${expired.data.cleanedCount} expired invite mappings`);
        }
      }
    } catch (e) {
      console.warn('[JANITOR] cleanupExpiredInvites (grace) failed or unsupported:', e?.message || e);
    }

    // Then check all remaining invites for exhausted/expired (post-grace)
    const all = await InviteDB.getAllInviteMappings();
    if (!all.ok) {
      console.error('[JANITOR] invite DB error:', all.error);
      return;
    }

    let removed = 0;
    for (const row of all.data) {
      const exhausted = row.max_uses > 0 && row.current_uses >= row.max_uses;
      const expired = !!row.expires_at && now >= row.expires_at;

      // Skip if neither exhausted nor expired
      if (!exhausted && !expired) continue;

      // Skip if recently updated (grace window) to avoid racing oath ceremony / usage increments
      const lastUpdated = Number(row.updated_at || 0);
      const timeSinceUpdate = now - lastUpdated;
      if (timeSinceUpdate < GRACE_PERIOD_SECONDS) {
        console.log(`[JANITOR] Skipping recently used invite ${row.invite_code} (${timeSinceUpdate}s ago)`);
        continue;
      }

      // Try to delete the Discord invite if it still exists (best-effort)
      try {
        const guild = await client.guilds.fetch(row.guild_id);
        const invites = await guild.invites.fetch().catch(() => null);
        const live = invites?.find(i => i.code === row.invite_code);
        if (live) {
          await live.delete(`Janitor: ${exhausted ? 'exhausted' : 'expired'}`);
        }
      } catch (e) {
        console.warn('[JANITOR] best-effort delete discord invite failed:', e?.message || e);
      }

      // Remove from database
      try {
        await InviteDB.removeMapping(row.invite_code);
        removed++;
      } catch (e) {
        console.error(`[JANITOR] Failed to remove mapping ${row.invite_code}:`, e?.message || e);
      }
    }

    if (removed) console.log(`[JANITOR] Removed ${removed} exhausted/expired invite mappings`);
    console.log('[JANITOR] Invite prune complete');
  } catch (err) {
    console.error('[JANITOR] pruneRoleInvites failed:', err);
  }
}

/**
 * Sweep temporary voice channels (fallback sweep that calls your existing function)
 * @param {import('discord.js').Client} client
 */
export async function sweepTempVCs(client) {
  try {
    // Import dynamically to avoid circular deps
    const { sweepTempRooms } = await import('./temp-vc-service.js');
    await sweepTempRooms(client);
    console.log('[JANITOR] Temp VC sweep complete');
  } catch (error) {
    console.error('[JANITOR] Failed to sweep temp VCs:', error);
  }
}

/**
 * Kick Stray Spores / no-role offline users (placeholder for later)
 * @param {import('discord.js').Client} client
 */
export async function kickStraySpores(client) {
  console.log('[JANITOR] kickStraySpores not yet implemented');
}
