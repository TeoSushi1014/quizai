import { supabase } from './supabaseClient'
import { logger } from './logService'

export class SecureConfigService {
  private static instance: SecureConfigService
  private apiKeysCache: Map<string, string> = new Map()
  private cacheExpiry: Map<string, number> = new Map()
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  static getInstance(): SecureConfigService {
    if (!SecureConfigService.instance) {
      SecureConfigService.instance = new SecureConfigService()
    }
    return SecureConfigService.instance
  }

  private isCacheValid(keyName: string): boolean {
    const expiry = this.cacheExpiry.get(keyName)
    return expiry ? Date.now() < expiry : false
  }

  async getApiKey(keyName: string): Promise<string | null> {
    try {
      // Check cache first
      if (this.isCacheValid(keyName)) {
        const cachedKey = this.apiKeysCache.get(keyName)
        if (cachedKey) {
          logger.info(`Using cached API key for ${keyName}`, 'SecureConfigService')
          return cachedKey
        }
      }

      // First, try to get user's personal API key
      let data = null
      let error = null

      try {
        const userResult = await supabase
          .from('api_keys')
          .select('key_value')
          .eq('key_name', keyName)
          .eq('owner_email', (await supabase.auth.getUser()).data.user?.email || '')
          .single()
        
        data = userResult.data
        error = userResult.error
      } catch (userError) {
        // User might not be authenticated, continue to default
        logger.info(`No personal API key found for ${keyName}, trying default`, 'SecureConfigService')
      }

      // If no personal key found, try default system key
      if (!data || error) {
        logger.info(`Falling back to default system API key for ${keyName}`, 'SecureConfigService')
        const defaultResult = await supabase
          .from('api_keys')
          .select('key_value')
          .eq('key_name', keyName)
          .eq('owner_email', 'default@system')
          .single()
        
        data = defaultResult.data
        error = defaultResult.error
      }

      if (error) {
        logger.error(`Failed to fetch API key: ${keyName}`, 'SecureConfigService', { error })
        return null
      }

      if (data?.key_value) {
        // Cache the key
        this.apiKeysCache.set(keyName, data.key_value)
        this.cacheExpiry.set(keyName, Date.now() + this.CACHE_DURATION)
        
        logger.info(`Successfully fetched API key for ${keyName}`, 'SecureConfigService')
        return data.key_value
      }

      logger.warn(`No API key found for ${keyName}`, 'SecureConfigService')
      return null
    } catch (error) {
      logger.error(`Error fetching API key: ${keyName}`, 'SecureConfigService', {}, error as Error)
      return null
    }
  }

  // Get only user's personal API key (not default system key)
  async getUserPersonalApiKey(keyName: string): Promise<string | null> {
    try {
      const userResult = await supabase
        .from('api_keys')
        .select('key_value')
        .eq('key_name', keyName)
        .eq('owner_email', (await supabase.auth.getUser()).data.user?.email || '')
        .single()
      
      if (userResult.error) {
        return null // No personal key found
      }

      return userResult.data?.key_value || null
    } catch (error) {
      logger.error(`Error fetching personal API key: ${keyName}`, 'SecureConfigService', {}, error as Error)
      return null
    }
  }

  async setApiKey(keyName: string, keyValue: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('api_keys')
        .upsert({
          key_name: keyName,
          key_value: keyValue,
          owner_email: (await supabase.auth.getUser()).data.user?.email
        })

      if (error) {
        logger.error(`Failed to save API key: ${keyName}`, 'SecureConfigService', { error })
        return false
      }

      // Update cache
      this.apiKeysCache.set(keyName, keyValue)
      this.cacheExpiry.set(keyName, Date.now() + this.CACHE_DURATION)

      logger.info(`Successfully saved API key for ${keyName}`, 'SecureConfigService')
      return true
    } catch (error) {
      logger.error(`Error saving API key: ${keyName}`, 'SecureConfigService', {}, error as Error)
      return false
    }
  }

  clearCache(): void {
    this.apiKeysCache.clear()
    this.cacheExpiry.clear()
    logger.info('API keys cache cleared', 'SecureConfigService')
  }

  // Method to check if a key exists
  async hasApiKey(keyName: string): Promise<boolean> {
    const key = await this.getApiKey(keyName)
    return key !== null
  }
}

export const secureConfig = SecureConfigService.getInstance()
