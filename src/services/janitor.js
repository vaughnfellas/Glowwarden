// src/services/janitor.js
import { InviteDB } from '../database/invites.js';
import { supabase } from '../db.js';

const NIGHTLY_HOUR_UTC = 3;

export function scheduleNightly(client, jobs = []) {
  const now = new Date();
  const first = new Date(now);
  first.setUTCHours(NIGHTLY_HOUR_UTC, 0, 0, 0);
  if (first <= now) {
    first.setUTCDate(first.getUTCDate() + 1);
  }

  const runJobs = async () => {
    for (const job of jobs) {
      try {
        await job(client);
      } catch (err) {
        console.error('[Janitor] job failed:', err);
      }
    }
  };

  setTimeout(() => {
    runJobs();
    setInterval(runJobs, 24 * 60 * 60 * 1000);
  }, first - now);
}

export async function pruneRoleInvites() {
  try {
    console.log('[Janitor] Starting invite prune');

    const expired = await InviteDB.cleanupExpiredInvites();
    if (expired.ok && expired.data.cleanedCount > 0) {
      console.log(`[Janitor] Removed ${expired.data.cleanedCount} expired invite mappings`);
    }

    const { data, error } = await supabase
      .from('invite_mappings')
      .select('invite_code, max_uses, current_uses')
      .gt('max_uses', 0);

    if (error) {
      console.error('[Janitor] Error fetching invites for exhaustion check:', error);
    } else {
      const toRemove = (data || [])
        .filter(row => row.max_uses > 0 && row.current_uses >= row.max_uses)
        .map(row => row.invite_code);
      if (toRemove.length) {
        await InviteDB.removeInviteMappings(toRemove);
        console.log(`[Janitor] Removed ${toRemove.length} exhausted invite mappings`);
      }
    }

    console.log('[Janitor] Invite prune complete');
  } catch (err) {
    console.error('[Janitor] pruneRoleInvites failed:', err);
  }
}
