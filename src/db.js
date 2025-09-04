// src/db.js - Singleton Supabase client for database operations
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

let supabaseInstance = null;

/**
 * Get singleton Supabase client instance
 * @returns {SupabaseClient}
 */
export function getSupabase() {
  if (!supabaseInstance) {
    if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_KEY) {
      throw new Error(
        'Supabase configuration missing. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY in your config.'
      );
    }

    supabaseInstance = createClient(
      config.SUPABASE_URL,
      config.SUPABASE_SERVICE_KEY,
      {
        auth: { persistSession: false },
        realtime: { params: { eventsPerSecond: 2 } },
      }
    );

    console.log('✅ Supabase client initialized');
  }

  return supabaseInstance;
}

// Export singleton getter
export const supabase = {
  get client() {
    return getSupabase();
  },
};

/**
 * Test database connection
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function testConnection() {
  try {
    const { error } = await getSupabase()
      .from('temp_vcs')
      .select('count')
      .limit(1);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Database operations for temp VCs
 */
export const tempVCDB = {
  /**
   * Save temp VC to database
   */
  async create(channelId, ownerId, guildId) {
    try {
      const { error } = await getSupabase()
        .from('temp_vcs')
        .insert({
          channel_id: channelId,
          owner_id: ownerId,
          guild_id: guildId,
          created_at: new Date().toISOString(),
          last_active: new Date().toISOString(),
        });

      if (error) {
        console.error('Database error creating temp VC:', error);
        return { ok: false, error: error.message };
      }
      return { ok: true };
    } catch (err) {
      console.error('Error saving temp VC:', err);
      return { ok: false, error: err.message };
    }
  },

  /**
   * Update last active time for temp VC
   */
  async updateLastActive(channelId) {
    try {
      const { error } = await getSupabase()
        .from('temp_vcs')
        .update({ last_active: new Date().toISOString() })
        .eq('channel_id', channelId);

      if (error) {
        console.error('Database error updating temp VC:', error);
        return { ok: false, error: error.message };
      }
      return { ok: true };
    } catch (err) {
      console.error('Error updating temp VC:', err);
      return { ok: false, error: err.message };
    }
  },
};
