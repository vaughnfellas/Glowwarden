// src/database/invites.js
import { supabase } from '../db.js';

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
            max_uses: maxUses,
            created_at: new Date().toISOString()
          }
        ])
        .select();
      
      if (error) {
        console.error('Supabase error in addInviteMapping:', error);
        return { ok: false, error: error.message };
      }
      
      console.log(`Added invite mapping: ${inviteCode} -> role ${roleId}`);
      return { ok: true, data: data?.[0] };
    } catch (error) {
      console.error('Failed to add invite mapping to database:', error);
      return { ok: false, error: 'Database operation failed' };
    }
  }

  static async getInviteMapping(inviteCode) {
    try {
      const { data, error } = await supabase
        .from('invite_mappings')
        .select('*')
        .eq('invite_code', inviteCode)
        .maybeSingle();
      
      if (error) {
        console.error('Supabase error in getInviteMapping:', error);
        return { ok: false, error: error.message };
      }
      
      return { ok: true, data };
    } catch (error) {
      console.error('Failed to get invite mapping from database:', error);
      return { ok: false, error: 'Database operation failed' };
    }
  }

  static async getAllInviteMappings() {
    try {
      const { data, error } = await supabase
        .from('invite_mappings')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Supabase error in getAllInviteMappings:', error);
        return { ok: false, error: error.message };
      }
      
      return { ok: true, data: data || [] };
    } catch (error) {
      console.error('Failed to get all invite mappings from database:', error);
      return { ok: false, error: 'Database operation failed' };
    }
  }

  static async removeInviteMapping(inviteCode) {
    try {
      const { error } = await supabase
        .from('invite_mappings')
        .delete()
        .eq('invite_code', inviteCode);
      
      if (error) {
        console.error('Supabase error in removeInviteMapping:', error);
        return { ok: false, error: error.message };
      }
      
      console.log(`Removed invite mapping: ${inviteCode}`);
      return { ok: true };
    } catch (error) {
      console.error('Failed to remove invite mapping from database:', error);
      return { ok: false, error: 'Database operation failed' };
    }
  }

  static async cleanupExpiredInvites() {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('invite_mappings')
        .delete()
        .lt('expires_at', now)
        .not('expires_at', 'is', null)
        .select();
      
      if (error) {
        console.error('Supabase error in cleanupExpiredInvites:', error);
        return { ok: false, error: error.message };
      }
      
      const cleanedCount = data?.length || 0;
      if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} expired invite mappings:`, 
          data.map(d => d.invite_code).join(', '));
      }
      
      return { ok: true, data: { cleanedCount, codes: data?.map(d => d.invite_code) || [] } };
    } catch (error) {
      console.error('Failed to clean up expired invites:', error);
      return { ok: false, error: 'Database operation failed' };
    }
  }

  static async getActiveInvitesForRole(roleId) {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('invite_mappings')
        .select('*')
        .eq('role_id', roleId)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Supabase error in getActiveInvitesForRole:', error);
        return { ok: false, error: error.message };
      }
      
      return { ok: true, data: data || [] };
    } catch (error) {
      console.error('Failed to get active invites for role:', error);
      return { ok: false, error: 'Database operation failed' };
    }
  }

  static async incrementInviteUsage(inviteCode) {
    try {
      const { data, error } = await supabase
        .rpc('increment_invite_usage', { invite_code: inviteCode });
      
      if (error) {
        console.error('Supabase error in incrementInviteUsage:', error);
        return { ok: false, error: error.message };
      }
      
      return { ok: true, data };
    } catch (error) {
      console.error('Failed to increment invite usage:', error);
      return { ok: false, error: 'Database operation failed' };
    }
  }
}