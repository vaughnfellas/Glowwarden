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
    if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
      throw new Error('Supabase configuration missing. Please set SUPABASE_URL and SUPABASE_ANON_KEY in your config.');
    }
    
    supabaseInstance = createClient(
      config.SUPABASE_URL, 
      config.SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false, // No session persistence for bot
        },
        realtime: {
          params: {
            eventsPerSecond: 2, // Limit real-time events for bot usage
          },
        },
      }
    );
    
    console.log('Supabase client initialized');
  }
  
  return supabaseInstance;
}

// Export singleton instance for convenience
export const supabase = {
  get client() {
    return getSupabase();
  }
};

/**
 * Test database connection
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function testConnection() {
  try {
    const { data, error } = await getSupabase()
      .from('temp_vcs') // Assuming you have a temp_vcs table
      .select('count')
      .limit(1);
    
    if (error) {
      return { ok: false, error: error.message };
    }
    
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/**
 * Database operations for temp VCs (example implementation)
 */
export const tempVCDB = {
  /**
   * Save temp VC to database
   * @param {string} channelId 
   * @param {string} ownerId 
   * @param {string} guildId 
   * @returns {Promise<{ok: boolean, error?: string}>}
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
          last_active: new Date().toISOString()
        });
      
      if (error) {
        console.error('Database error creating temp VC:', error);
        return { ok: false, error: error.message };
      }
      
      return { ok: true };
    } catch (error) {
      console.error('Error saving temp VC to database:', error);
      return { ok: false, error: error.message };
    }
  },

  /**
   * Update last active time for temp VC
   * @param {string} channelId 
   * @returns {Promise<{ok: boolean, error?: string}>}
   */
  async updateLastActive(channelId) {
    try {
      const { error } = await getSupabase