import { supabase } from './supabaseClient';
import { logger } from './logService';

export interface AdminUser {
  id: string;
  user_email: string;
  user_name: string | null;
  role: 'admin' | 'super_admin';
  created_at: string;
  created_by: string;
  created_by_name: string | null;
  is_active: boolean;
}

export class AdminService {
  private static instance: AdminService;
  private cache: Map<string, { isAdmin: boolean; role: string; expiry: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static getInstance(): AdminService {
    if (!AdminService.instance) {
      AdminService.instance = new AdminService();
    }
    return AdminService.instance;
  }

  async isAdmin(userEmail?: string): Promise<boolean> {
    try {
      if (!userEmail) return false;

      const cached = this.cache.get(userEmail);
      if (cached && Date.now() < cached.expiry) {
        return cached.isAdmin;
      }

      const { data, error } = await supabase
        .from('admin_users')
        .select('role')
        .eq('user_email', userEmail)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        this.cache.set(userEmail, { isAdmin: false, role: '', expiry: Date.now() + this.CACHE_DURATION });
        return false;
      }

      const isAdmin = data.role === 'admin' || data.role === 'super_admin';
      this.cache.set(userEmail, { 
        isAdmin, 
        role: data.role, 
        expiry: Date.now() + this.CACHE_DURATION 
      });

      return isAdmin;
    } catch (error) {
      logger.error('Error checking admin status', 'AdminService', {}, error as Error);
      return false;
    }
  }

  async getAdminRole(userEmail?: string): Promise<string | null> {
    try {
      if (!userEmail) return null;

      const cached = this.cache.get(userEmail);
      if (cached && Date.now() < cached.expiry) {
        return cached.isAdmin ? cached.role : null;
      }

      const { data, error } = await supabase
        .from('admin_users')
        .select('role')
        .eq('user_email', userEmail)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        this.cache.set(userEmail, { isAdmin: false, role: '', expiry: Date.now() + this.CACHE_DURATION });
        return null;
      }

      const isAdmin = data.role === 'admin' || data.role === 'super_admin';
      this.cache.set(userEmail, { 
        isAdmin, 
        role: data.role, 
        expiry: Date.now() + this.CACHE_DURATION 
      });

      return isAdmin ? data.role : null;
    } catch (error) {
      logger.error('Error getting admin role', 'AdminService', {}, error as Error);
      return null;
    }
  }

  async isSuperAdmin(userEmail?: string): Promise<boolean> {
    const role = await this.getAdminRole(userEmail);
    return role === 'super_admin';
  }

  clearCache(): void {
    this.cache.clear();
  }

  clearUserCache(userEmail: string): void {
    this.cache.delete(userEmail);
  }
}

export const adminService = AdminService.getInstance(); 