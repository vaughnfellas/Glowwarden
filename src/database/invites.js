// src/database/invites.js
import { supabase } from '../db.js'; // Use the centralized client

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
            created_at: new Date().toISOString() // Explicitly set created_at
          }
        ])
        .select(); // Return the inserted data
      
      if (error) {
        console.error('Supabase error in addInviteMapping:', error);
        throw error;
      }
      
      console.log(`Added invite mapping: ${inviteCode} -> role ${roleId}`);
      return data?.[0] || true;
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
        .maybeSingle(); // Use maybeSingle instead of single to avoid errors when no record found
      
      if (error) {
        console.error('Supabase error in getInviteMapping:', error);
        return null;
      }
      
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
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Supabase error in getAllInviteMappings:', error);
        return [];
      }
      
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
      
      if (error) {
        console.error('Supabase error in removeInviteMapping:', error);
        throw error;
      }
      
      console.log(`Removed invite mapping: ${inviteCode}`);
      return true;
    } catch (error) {
      console.error('Failed to remove invite mapping from database:', error);
      return false;
    }
  }

  static async cleanupExpiredInvites() {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('invite_mappings')
        .delete()
        .lt('expires_at', now)
        .not('expires_at', 'is', null) // Only delete records where expires_at is not null
        .select(); // Return deleted records for logging
      
      if (error) {
        console.error('Supabase error in cleanupExpiredInvites:', error);
        throw error;
      }
      
      if (data?.length > 0) {
        console.log(`Cleaned up ${data.length} expired invite mappings:`, 
          data.map(d => d.invite_code).join(', '));
      }
      
      return data?.length || 0;
    } catch (error) {
      console.error('Failed to clean up expired invites:', error);
      return false;
    }
  }

  // Additional helper method to get active invites for a specific role
  static async getActiveInvitesForRole(roleId) {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('invite_mappings')
        .select('*')
        .eq('role_id', roleId)
        .or(`expires_at.is.null,expires_at.gt.${now}`) // Not expired
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Supabase error in getActiveInvitesForRole:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Failed to get active invites for role:', error);
      return [];
    }
  }

  // Helper method to update invite usage count (if you want to track usage)
  static async incrementInviteUsage(inviteCode) {
    try {
      const { data, error } = await supabase
        .rpc('increment_invite_usage', { invite_code: inviteCode });
      
      if (error) {
        console.error('Supabase error in incrementInviteUsage:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Failed to increment invite usage:', error);
      return false;
    }
  }
}