import { supabase } from './supabaseClient';
import { logger } from './logService';

export interface MaintenanceSettings {
  isEnabled: boolean;
  message: string;
  allowedEmails: string[];
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
}

export class MaintenanceService {
  private static instance: MaintenanceService;
  private cache: MaintenanceSettings | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_DURATION = 30 * 1000; // 30 seconds

  static getInstance(): MaintenanceService {
    if (!MaintenanceService.instance) {
      MaintenanceService.instance = new MaintenanceService();
    }
    return MaintenanceService.instance;
  }

  private isCacheValid(): boolean {
    return this.cache && Date.now() < this.cacheExpiry;
  }

  async getMaintenanceSettings(): Promise<MaintenanceSettings | null> {
    try {
      if (this.isCacheValid()) {
        return this.cache;
      }

      const { data, error } = await supabase
        .from('maintenance_settings')
        .select('*')
        .eq('id', 'main')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        logger.error('Failed to fetch maintenance settings', 'MaintenanceService', { error });
        return null;
      }

      const settings: MaintenanceSettings = {
        isEnabled: data.is_enabled === true,
        message: data.message || 'Hệ thống đang bảo trì. Vui lòng thử lại sau.',
        allowedEmails: data.allowed_emails || [],
        updatedAt: data.updated_at || new Date().toISOString(),
        updatedBy: data.updated_by || 'system',
        updatedByName: data.updated_by_name || 'System'
      };

      this.cache = settings;
      this.cacheExpiry = Date.now() + this.CACHE_DURATION;

      return settings;
    } catch (error) {
      logger.error('Error fetching maintenance settings', 'MaintenanceService', {}, error as Error);
      return null;
    }
  }

  async isMaintenanceMode(): Promise<boolean> {
    try {
      const settings = await this.getMaintenanceSettings();
      return settings?.isEnabled || false;
    } catch (error) {
      logger.error('Error checking maintenance mode', 'MaintenanceService', {}, error as Error);
      return false;
    }
  }

  async isUserAllowed(userEmail?: string): Promise<boolean> {
    try {
      const settings = await this.getMaintenanceSettings();
      if (!settings?.isEnabled) return true;
      
      if (!userEmail) return false;
      
      return settings.allowedEmails.includes(userEmail);
    } catch (error) {
      logger.error('Error checking user access during maintenance', 'MaintenanceService', {}, error as Error);
      return false;
    }
  }

  async updateMaintenanceSettings(
    isEnabled: boolean,
    message: string,
    allowedEmails: string[],
    updatedBy: string,
    updatedByName: string
  ): Promise<boolean> {
    try {
              const { error } = await supabase
          .from('maintenance_settings')
          .upsert({
            id: 'main',
            is_enabled: isEnabled,
            message: message,
            allowed_emails: allowedEmails,
            updated_at: new Date().toISOString(),
            updated_by: updatedBy,
            updated_by_name: updatedByName
          });

      if (error) {
        logger.error('Failed to update maintenance settings', 'MaintenanceService', { error });
        return false;
      }

      this.clearCache();
      logger.info('Maintenance settings updated', 'MaintenanceService', { isEnabled, updatedBy });
      return true;
    } catch (error) {
      logger.error('Error updating maintenance settings', 'MaintenanceService', {}, error as Error);
      return false;
    }
  }

  clearCache(): void {
    this.cache = null;
    this.cacheExpiry = 0;
  }
}

export const maintenanceService = MaintenanceService.getInstance(); 