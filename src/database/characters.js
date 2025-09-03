// src/database/characters.js
// Supabase-based character management (consistent with invites.js)
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

const supabaseUrl = process.env.SUPABASE_URL || config.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || config.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

export const CharacterDB = {
  async addCharacter(userId, name, charClass, realm, isMain) {
    try {
      // If setting as main, first unset all other mains for this user
      if (isMain) {
        await supabase
          .from('characters')
          .update({ is_main: false })
          .eq('user_id', userId);
      }

      // Insert or update the character
      const { data, error } = await supabase
        .from('characters')
        .upsert({
          user_id: userId,
          name: name,
          class: charClass || null,
          realm: realm || null,
          is_main: !!isMain
        }, {
          onConflict: 'user_id,name'
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to add character:', error);
      throw error;
    }
  },

  async getCharacters(userId) {
    try {
      const { data, error } = await supabase
        .from('characters')
        .select('id, user_id, name, class, realm, is_main, created_at')
        .eq('user_id', userId)
        .order('is_main', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data || []).map(r => ({
        id: r.id,
        userId: r.user_id,
        name: r.name,
        class: r.class || null,
        realm: r.realm || null,
        isMain: r.is_main,
        createdAt: r.created_at,
      }));
    } catch (error) {
      console.error('Failed to get characters:', error);
      throw error;
    }
  },

  async characterExists(userId, name) {
    try {
      const { data, error } = await supabase
        .from('characters')
        .select('id')
        .eq('user_id', userId)
        .ilike('name', name) // Case-insensitive comparison
        .limit(1);

      if (error) throw error;
      return (data || []).length > 0;
    } catch (error) {
      console.error('Failed to check character existence:', error);
      throw error;
    }
  },

  async getCharacter(userId, name) {
    try {
      const { data, error } = await supabase
        .from('characters')
        .select('id, user_id, name, class, realm, is_main, created_at')
        .eq('user_id', userId)
        .ilike('name', name) // Case-insensitive comparison
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No rows returned
          return null;
        }
        throw error;
      }

      return {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        class: data.class || null,
        realm: data.realm || null,
        isMain: data.is_main,
        createdAt: data.created_at,
      };
    } catch (error) {
      console.error('Failed to get character:', error);
      throw error;
    }
  },

  async removeCharacter(userId, name) {
    try {
      const { error } = await supabase
        .from('characters')
        .delete()
        .eq('user_id', userId)
        .ilike('name', name); // Case-insensitive comparison

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to remove character:', error);
      throw error;
    }
  },

  async setMainCharacter(userId, name) {
    try {
      // First, unset all other mains
      const { error: unsetError } = await supabase
        .from('characters')
        .update({ is_main: false })
        .eq('user_id', userId);

      if (unsetError) throw unsetError;

      // Set the specified character as main
      const { error: setError } = await supabase
        .from('characters')
        .update({ is_main: true })
        .eq('user_id', userId)
        .ilike('name', name); // Case-insensitive comparison

      if (setError) throw setError;
      return true;
    } catch (error) {
      console.error('Failed to set main character:', error);
      throw error;
    }
  },

  async deleteCharacter(userId, name) {
    try {
      const { error } = await supabase
        .from('characters')
        .delete()
        .eq('user_id', userId)
        .ilike('name', name); // Case-insensitive comparison

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to delete character:', error);
      throw error;
    }
  },

  // Utility method to close connection (for compatibility, though Supabase handles this)
  async close() {
    // Supabase client doesn't need explicit closing
    console.log('Supabase client connection closed (no action needed)');
  }
};