// src/database/invites.js
import { supabase } from '../db.js';

export class InviteDB {
  static async addInviteMapping(inviteCode, roleId, inviterId, guildId, channelId, expiresAt = null, maxUses = 1, reason = null) {
    try {
      console.log(`Attempting to add invite mapping: ${inviteCode} -> role ${roleId}`);
      
      // Convert dates to Unix timestamps (BIGINT) for the new schema
      const now = Math.floor(Date.now() / 1000);
      const expiresTimestamp = expiresAt ? Math.floor(new Date(expiresAt).getTime() / 1000) : null;
      
      const insertData = { 
        invite_code: inviteCode,
        inviter_id: inviterId,
        guild_id: guildId,
        channel_id: channelId,
        role_id: roleId,  // Add the role_id to the insert
        max_uses: maxUses,
        current_uses: 0,
        expires_at: expiresTimestamp,
        created_at: now,
        updated_at: now,
        is_temporary: false,
        max_age: null,
        reason: reason
      };
      
      console.log('Insert data:', insertData);
      
      const { data, error } = await supabase
        .from('invite_mappings')
        .insert([insertData])
        .select();
      
      if (error) {
        console.error('Supabase error in addInviteMapping:', error);
        return { ok: false, error: error.message };
      }
      
      console.log(`Successfully added invite mapping: ${inviteCode} -> role ${roleId}`);
      return { ok: true, data: data?.[0] };
    } catch (error) {
      console.error('Failed to add invite mapping to database:', error);
      return { ok: false, error: error.message || 'Database operation failed' };
    }
  }

  static async getInviteMapping(inviteCode) {
    try {
      console.log(`Looking up invite mapping for code: ${inviteCode}`);
      
      const { data, error } = await supabase
        .from('invite_mappings')
        .select('*')
        .eq('invite_code', inviteCode)
        .maybeSingle();
      
      if (error) {
        console.error('Supabase error in getInviteMapping:', error);
        return { ok: false, error: error.message };
      }
      
      if (data) {
        console.log(`Found invite mapping: ${inviteCode} -> role ${data.role_id}`);
      } else {
        console.log(`No invite mapping found for code: ${inviteCode}`);
      }
      
      return { ok: true, data };
    } catch (error) {
      console.error('Failed to get invite mapping from database:', error);
      return { ok: false, error: error.message || 'Database operation failed' };
    }
  }

  static async getAllInviteMappings() {
    try {
      console.log('Fetching all invite mappings from database...');
      
      const { data, error } = await supabase
        .from('invite_mappings')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Supabase error in getAllInviteMappings:', error);
        return { ok: false, error: error.message };
      }
      
      console.log(`Retrieved ${data?.length || 0} invite mappings from database`);
      return { ok: true, data: data || [] };
    } catch (error) {
      console.error('Failed to get all invite mappings from database:', error);
      return { ok: false, error: error.message || 'Database operation failed' };
    }
  }

  static async removeInviteMapping(inviteCode) {
    try {
      console.log(`Removing invite mapping for code: ${inviteCode}`);
      
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
      return { ok: false, error: error.message || 'Database operation failed' };
    }
  }

  // New method for batch removal
  static async removeInviteMappings(inviteCodes) {
    try {
      console.log(`Removing invite mappings for codes: ${inviteCodes.join(', ')}`);
      
      const { error } = await supabase
        .from('invite_mappings')
        .delete()
        .in('invite_code', inviteCodes);
      
      if (error) {
        console.error('Supabase error in removeInviteMappings:', error);
        return { ok: false, error: error.message };
      }
      
      console.log(`Removed invite mappings: ${inviteCodes.join(', ')}`);
      return { ok: true };
    } catch (error) {
      console.error('Failed to remove invite mappings from database:', error);
      return { ok: false, error: error.message || 'Database operation failed' };
    }
  }

  static async cleanupExpiredInvites() {
    try {
      const now = Math.floor(Date.now() / 1000); // Unix timestamp
      console.log(`Cleaning up expired invites (before ${now})...`);
      
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
      return { ok: false, error: error.message || 'Database operation failed' };
    }
  }

  static async getActiveInvitesForRole(roleId) {
    try {
      const now = Math.floor(Date.now() / 1000); // Unix timestamp
      console.log(`Getting active invites for role: ${roleId}`);
      
      const { data, error } = await supabase
        .from('invite_mappings')
        .select('*')
        .eq('role_id', roleId) // Fixed: use role_id instead of inviter_id
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Supabase error in getActiveInvitesForRole:', error);
        return { ok: false, error: error.message };
      }
      
      console.log(`Found ${data?.length || 0} active invites for role ${roleId}`);
      return { ok: true, data: data || [] };
    } catch (error) {
      console.error('Failed to get active invites for role:', error);
      return { ok: false, error: error.message || 'Database operation failed' };
    }
  }

  static async incrementInviteUsage(inviteCode) {
    try {
      console.log(`Incrementing usage for invite: ${inviteCode}`);
      
      // First, check if the invite exists and get current usage
      const { data: currentData, error: selectError } = await supabase
        .from('invite_mappings')
        .select('current_uses, max_uses')
        .eq('invite_code', inviteCode)
        .single();
      
      if (selectError) {
        console.error('Error fetching current invite usage:', selectError);
        return { ok: false, error: selectError.message };
      }
      
      const newUsage = (currentData.current_uses || 0) + 1;
      const now = Math.floor(Date.now() / 1000);
      
      // Update the usage count
      const { data, error } = await supabase
        .from('invite_mappings')
        .update({ 
          current_uses: newUsage,
          updated_at: now
        })
        .eq('invite_code', inviteCode)
        .select();
      
      if (error) {
        console.error('Supabase error in incrementInviteUsage:', error);
        return { ok: false, error: error.message };
      }
      
      console.log(`Updated invite ${inviteCode} usage: ${newUsage}/${currentData.max_uses || 'unlimited'}`);
      
      // Check if invite should be removed (reached max uses)
      if (currentData.max_uses > 0 && newUsage >= currentData.max_uses) {
        console.log(`Invite ${inviteCode} reached max uses, removing...`);
        await this.removeInviteMapping(inviteCode);
        return { ok: true, data: { ...data?.[0], removed: true } };
      }
      
      return { ok: true, data: data?.[0] };
    } catch (error) {
      console.error('Failed to increment invite usage:', error);
      return { ok: false, error: error.message || 'Database operation failed' };
    }
  }

  static async validateInvite(inviteCode) {
    try {
      const result = await this.getInviteMapping(inviteCode);
      if (!result.ok || !result.data) {
        return { valid: false, reason: 'Invite not found' };
      }
      
      const mapping = result.data;
      const now = Math.floor(Date.now() / 1000); // Unix timestamp
      
      // Check expiration
      if (mapping.expires_at && mapping.expires_at < now) {
        return { valid: false, reason: 'Invite expired' };
      }
      
      // Check usage limit
      if (mapping.max_uses > 0 && (mapping.current_uses || 0) >= mapping.max_uses) {
        return { valid: false, reason: 'Invite usage limit reached' };
      }
      
      return { valid: true, mapping };
    } catch (error) {
      console.error('Error validating invite:', error);
      return { valid: false, reason: 'Validation error', error: error.message };
    }
  }
}