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
      if (this.isCacheValid(keyName)) {
        const cachedKey = this.apiKeysCache.get(keyName)
        if (cachedKey) {
          logger.info(`Using cached API key for ${keyName}`, 'SecureConfigService')
          return cachedKey
        }
      }

      let data = null
      let error = null

      // Try to get user email, but handle the case where user is not authenticated
      let userEmail = ''
      try {
        const userResult = await supabase.auth.getUser()
        userEmail = userResult.data.user?.email || ''
      } catch (authError) {
        logger.info('No authenticated Supabase user, will only try default API keys', 'SecureConfigService')
        userEmail = ''
      }

      // Only try user-specific API key if we have a valid email
      if (userEmail) {
        try {
          const userResult = await supabase
            .from('api_keys')
            .select('key_value')
            .eq('key_name', keyName)
            .eq('owner_email', userEmail)
            .single()
          
          data = userResult.data
          error = userResult.error
        } catch (userError) {
          logger.info(`No personal API key found for ${keyName}, trying default`, 'SecureConfigService')
        }
      } else {
        logger.info(`No user email available, skipping personal API key lookup for ${keyName}`, 'SecureConfigService')
      }

      if (!data || error) {
        logger.info(`Falling back to default system API key for ${keyName}`, 'SecureConfigService')
        try {
          const defaultResult = await supabase
            .from('api_keys')
            .select('key_value')
            .eq('key_name', keyName)
            .eq('owner_email', 'default@system')
            .single()
          
          data = defaultResult.data
          error = defaultResult.error
        } catch (defaultError) {
          logger.warn(`Failed to fetch default API key for ${keyName}`, 'SecureConfigService', { error: defaultError })
          error = defaultError
        }
      }

      if (error) {
        logger.error(`Failed to fetch API key: ${keyName}`, 'SecureConfigService', { error })
        return null
      }

      if (data?.key_value) {
        this.apiKeysCache.set(keyName, data.key_value)
        this.cacheExpiry.set(keyName, Date.now() + this.CACHE_DURATION)
        
        logger.info(`Successfully fetched API key for ${keyName}`, 'SecureConfigService')
        return data.key_value
      }

      // If no API key found in database, try environment variables as fallback
      logger.info(`No database API key found for ${keyName}, trying environment variables`, 'SecureConfigService')
      
      let envKey = null
      try {
        if (keyName === 'GEMINI_API_KEY') {
          envKey = import.meta.env.VITE_GEMINI_API_KEY || (window as any).__ENV__?.VITE_GEMINI_API_KEY
        } else if (keyName === 'VITE_RECAPTCHA_SITE_KEY') {
          envKey = (import.meta.env as any).VITE_RECAPTCHA_SITE_KEY
        } else if (keyName === 'VITE_RECAPTCHA_ASSESSMENT_API_KEY') {
          envKey = (import.meta.env as any).VITE_RECAPTCHA_ASSESSMENT_API_KEY
        }
        
        if (envKey) {
          this.apiKeysCache.set(keyName, envKey)
          this.cacheExpiry.set(keyName, Date.now() + this.CACHE_DURATION)
          
          logger.info(`Successfully fetched ${keyName} from environment variables`, 'SecureConfigService')
          return envKey
        }
      } catch (envError) {
        logger.warn(`Failed to access environment variable for ${keyName}`, 'SecureConfigService', { error: envError })
      }

      logger.warn(`No API key found for ${keyName} in database or environment variables`, 'SecureConfigService')
      return null
    } catch (error) {
      logger.error(`Error fetching API key: ${keyName}`, 'SecureConfigService', {}, error as Error)
      return null
    }
  }

  async getUserPersonalApiKey(keyName: string): Promise<string | null> {
    try {
      // Get user email, handle case where user is not authenticated
      let userEmail = ''
      try {
        const userResult = await supabase.auth.getUser()
        userEmail = userResult.data.user?.email || ''
      } catch (authError) {
        logger.info('No authenticated Supabase user for personal API key lookup', 'SecureConfigService')
        return null
      }

      if (!userEmail) {
        logger.info('No user email available for personal API key lookup', 'SecureConfigService')
        return null
      }

      const userResult = await supabase
        .from('api_keys')
        .select('key_value')
        .eq('key_name', keyName)
        .eq('owner_email', userEmail)
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
      // Get user email, handle case where user is not authenticated
      let userEmail = ''
      try {
        const userResult = await supabase.auth.getUser()
        userEmail = userResult.data.user?.email || ''
      } catch (authError) {
        logger.error('No authenticated Supabase user for API key setting', 'SecureConfigService')
        return false
      }

      if (!userEmail) {
        logger.error('No user email available for API key setting', 'SecureConfigService')
        return false
      }

      const { error } = await supabase
        .from('api_keys')
        .upsert({
          key_name: keyName,
          key_value: keyValue,
          owner_email: userEmail
        })

      if (error) {
        logger.error(`Failed to save API key: ${keyName}`, 'SecureConfigService', { error })
        return false
      }

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

  async hasApiKey(keyName: string): Promise<boolean> {
    const key = await this.getApiKey(keyName)
    return key !== null
  }
}

export const secureConfig = SecureConfigService.getInstance()
