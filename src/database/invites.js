// src/database/invites.js
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

const supabaseUrl = process.env.SUPABASE_URL || config.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || config.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

export class InviteDB {
  static async addInviteMapping(inviteCode, roleId, createdBy, expiresAt = null, maxUses = 1) {
    try {
      const { data, error } = await supabase
        .from('invite_mappings')
        .insert([
          { 
            invite_code: inviteCode,
            role_id: roleId,
            created_by: createdBy,
            expires_at: expiresAt,
            max_uses: maxUses
          }
        ]);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to add invite mapping to database:', error);
      return false;
    }
  }

  static async getInviteMapping(inviteCode) {
    try {
      const { data, error } = await supabase
        .from('invite_mappings')
        .select('*')
        .eq('invite_code', inviteCode)
        .single();
      
      if (error) return null;
      return data;
    } catch (error) {
      console.error('Failed to get invite mapping from database:', error);
      return null;
    }
  }

  static async getAllInviteMappings() {
    try {
      const { data, error } = await supabase
        .from('invite_mappings')
        .select('*');
      
      if (error) return [];
      return data || [];
    } catch (error) {
      console.error('Failed to get all invite mappings from database:', error);
      return [];
    }
  }

  static async removeInviteMapping(inviteCode) {
    try {
      const { error } = await supabase
        .from('invite_mappings')
        .delete()
        .eq('invite_code', inviteCode);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to remove invite mapping from database:', error);
      return false;
    }
  }

  static async cleanupExpiredInvites() {
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('invite_mappings')
        .delete()
        .lt('expires_at', now);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to clean up expired invites:', error);
      return false;
    }
  }
}
