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
          return cachedKey
        }
      }

      let data = null
      let error = null

      let userEmail = ''
      try {
        const userResult = await supabase.auth.getUser()
        userEmail = userResult.data.user?.email || ''
      } catch (authError) {
        userEmail = ''
      }

      if (userEmail) {
        try {
          const userResult = await supabase
            .from('api_keys')
            .select('key_value')
            .eq('key_name', keyName)
            .eq('owner_email', userEmail)
            .maybeSingle()
          
          data = userResult.data
          error = userResult.error
          
          if (error) {
            logger.error(`Personal API key query failed for ${keyName}`, 'SecureConfigService', {
              error: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint
            })
          }
        } catch (userError) {
          // Silently continue to try default key
        }
      }

      if (!data || error) {
        try {
          const defaultResult = await supabase
            .from('api_keys')
            .select('key_value')
            .eq('key_name', keyName)
            .eq('owner_email', 'default@system')
            .maybeSingle()
          
          data = defaultResult.data
          error = defaultResult.error
          
          if (error) {
            logger.error(`Default API key query failed for ${keyName}`, 'SecureConfigService', {
              error: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint
            })
          }
        } catch (defaultError) {
          logger.error(`Failed to fetch default API key for ${keyName}`, 'SecureConfigService', { error: defaultError })
          error = defaultError
        }
      }

      if (error) {
        return null
      }

      if (data?.key_value) {
        this.apiKeysCache.set(keyName, data.key_value)
        this.cacheExpiry.set(keyName, Date.now() + this.CACHE_DURATION)
        return data.key_value
      }
      
      let envKey = null
      try {
        if (keyName === 'GEMINI_API_KEY') {
          envKey = (import.meta.env as any).VITE_GEMINI_API_KEY || (window as any).__ENV__?.VITE_GEMINI_API_KEY
        } else if (keyName === 'VITE_RECAPTCHA_SITE_KEY') {
          envKey = (import.meta.env as any).VITE_RECAPTCHA_SITE_KEY
        } else if (keyName === 'VITE_RECAPTCHA_ASSESSMENT_API_KEY') {
          envKey = (import.meta.env as any).VITE_RECAPTCHA_ASSESSMENT_API_KEY
        }
        
        if (envKey) {
          this.apiKeysCache.set(keyName, envKey)
          this.cacheExpiry.set(keyName, Date.now() + this.CACHE_DURATION)
          return envKey
        }
      } catch (envError) {
        logger.error(`Failed to access environment variable for ${keyName}`, 'SecureConfigService', { error: envError })
      }

      return null
    } catch (error) {
      logger.error(`Error fetching API key: ${keyName}`, 'SecureConfigService', {}, error as Error)
      return null
    }
  }

  async getUserPersonalApiKey(keyName: string): Promise<string | null> {
    try {
      let userEmail = ''
      try {
        const userResult = await supabase.auth.getUser()
        userEmail = userResult.data.user?.email || ''
      } catch (authError) {
        return null
      }

      if (!userEmail) {
        return null
      }

      const userResult = await supabase
        .from('api_keys')
        .select('key_value')
        .eq('key_name', keyName)
        .eq('owner_email', userEmail)
        .single()
      
      if (userResult.error) {
        return null
      }

      return userResult.data?.key_value || null
    } catch (error) {
      logger.error(`Error fetching personal API key: ${keyName}`, 'SecureConfigService', {}, error as Error)
      return null
    }
  }

  async setApiKey(keyName: string, keyValue: string): Promise<boolean> {
    try {
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
        logger.error(`Failed to set API key: ${keyName}`, 'SecureConfigService', { error })
        return false
      }

      this.apiKeysCache.set(keyName, keyValue)
      this.cacheExpiry.set(keyName, Date.now() + this.CACHE_DURATION)

      return true
    } catch (error) {
      logger.error(`Error setting API key: ${keyName}`, 'SecureConfigService', {}, error as Error)
      return false
    }
  }

  clearCache(): void {
    this.apiKeysCache.clear()
    this.cacheExpiry.clear()
  }

  async hasApiKey(keyName: string): Promise<boolean> {
    const key = await this.getApiKey(keyName)
    return key !== null
  }
}

export const secureConfig = SecureConfigService.getInstance()
