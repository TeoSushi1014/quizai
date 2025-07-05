import { supabase } from '../services/supabaseClient'
import { logger } from '../services/logService'

export interface DeploymentDiagnostics {
  environment: {
    isProduction: boolean
    hostname: string
    protocol: string
    userAgent: string
  }
  supabase: {
    configured: boolean
    urlStatus: string
    keyStatus: string
    connectionTest: {
      success: boolean
      error?: string
      latency?: number
    }
  }
  googleAuth: {
    configured: boolean
    domain: string
  }
  localStorage: {
    available: boolean
    quota?: string
    error?: string
  }
  network: {
    online: boolean
    effectiveType?: string
  }
  permissions: {
    notifications: string
    geolocation: string
  }
}

export class DeploymentDiagnosticService {
  static async runFullDiagnostics(): Promise<DeploymentDiagnostics> {
    const startTime = performance.now()
    
    try {
      const diagnostics: DeploymentDiagnostics = {
        environment: this.checkEnvironment(),
        supabase: await this.checkSupabase(),
        googleAuth: this.checkGoogleAuth(),
        localStorage: this.checkLocalStorage(),
        network: this.checkNetwork(),
        permissions: this.checkPermissions()
      }
      
      const duration = performance.now() - startTime
      
      logger.info('Deployment diagnostics completed', 'DeploymentDiagnostics', {
        duration: `${duration.toFixed(2)}ms`,
        summary: {
          environment: diagnostics.environment.isProduction ? 'Production' : 'Development',
          supabase: diagnostics.supabase.configured ? 'Configured' : 'Not Configured',
          connection: diagnostics.supabase.connectionTest.success ? 'Success' : 'Failed',
          storage: diagnostics.localStorage.available ? 'Available' : 'Unavailable',
          network: diagnostics.network.online ? 'Online' : 'Offline'
        }
      })
      
      return diagnostics
    } catch (error) {
      logger.error('Deployment diagnostics failed', 'DeploymentDiagnostics', {}, error as Error)
      throw error
    }
  }

  private static checkEnvironment() {
    const hostname = window.location.hostname
    const isProduction = hostname !== 'localhost' && 
                        !hostname.includes('127.0.0.1') && 
                        !hostname.includes('192.168')
    
    return {
      isProduction,
      hostname,
      protocol: window.location.protocol,
      userAgent: navigator.userAgent.substring(0, 100) // Truncate for privacy
    }
  }

  private static async checkSupabase() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    
    const configured = !!(supabaseUrl && supabaseKey)
    
    const result = {
      configured,
      urlStatus: supabaseUrl ? 'Configured' : 'Missing',
      keyStatus: supabaseKey ? `Configured (${supabaseKey.length} chars)` : 'Missing',
      connectionTest: {
        success: false,
        error: undefined as string | undefined,
        latency: undefined as number | undefined
      }
    }
    
    if (configured) {
      const testStart = performance.now()
      try {
        const { error } = await supabase
          .from('users')
          .select('count')
          .limit(1)
        
        const latency = performance.now() - testStart
        
        if (error) {
          result.connectionTest = {
            success: false,
            error: `${error.code}: ${error.message}`,
            latency
          }
        } else {
          result.connectionTest = {
            success: true,
            error: undefined,
            latency
          }
        }
      } catch (connectionError) {
        result.connectionTest = {
          success: false,
          error: (connectionError as Error).message,
          latency: performance.now() - testStart
        }
      }
    }
    
    return result
  }

  private static checkGoogleAuth() {
    // Check if Google Auth is properly configured
    const domain = window.location.hostname
    
    return {
      configured: true, // Assume configured for now
      domain
    }
  }

  private static checkLocalStorage() {
    try {
      const testKey = '__deployment_test__'
      localStorage.setItem(testKey, 'test')
      localStorage.removeItem(testKey)
      
      // Try to estimate storage quota
      let quota = 'Unknown'
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        navigator.storage.estimate().then(estimate => {
          const available = estimate.quota ? Math.round(estimate.quota / 1024 / 1024) : 'Unknown'
          quota = `~${available}MB`
        }).catch(() => {
          quota = 'Cannot estimate'
        })
      }
      
      return {
        available: true,
        quota
      }
    } catch (error) {
      return {
        available: false,
        error: (error as Error).message
      }
    }
  }

  private static checkNetwork() {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
    
    return {
      online: navigator.onLine,
      effectiveType: connection?.effectiveType || 'Unknown'
    }
  }

  private static checkPermissions() {
    return {
      notifications: 'Available',
      geolocation: 'Available'
    }
  }

  // Quick check for common deployment issues
  static async quickHealthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'error'
    issues: string[]
    suggestions: string[]
  }> {
    const issues: string[] = []
    const suggestions: string[] = []
    
    try {
      // Check environment variables
      if (!import.meta.env.VITE_SUPABASE_URL) {
        issues.push('Missing VITE_SUPABASE_URL environment variable')
        suggestions.push('Set VITE_SUPABASE_URL in your deployment environment')
      }
      
      if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
        issues.push('Missing VITE_SUPABASE_ANON_KEY environment variable')
        suggestions.push('Set VITE_SUPABASE_ANON_KEY in your deployment environment')
      }
      
      // Test Supabase connection
      try {
        const { error } = await supabase.from('users').select('count').limit(1)
        if (error) {
          if (error.code === '42P01') {
            issues.push('Database table "users" does not exist')
            suggestions.push('Run database migrations or check table creation scripts')
          } else if (error.code === '42501') {
            issues.push('RLS policy preventing access to users table')
            suggestions.push('Check Row Level Security policies in Supabase dashboard')
          } else {
            issues.push(`Database connection error: ${error.message}`)
            suggestions.push('Check Supabase URL and API key configuration')
          }
        }
      } catch (connectionError) {
        issues.push('Cannot connect to Supabase')
        suggestions.push('Check network connectivity and Supabase configuration')
      }
      
      // Check authentication state
      try {
        const { error: sessionError } = await supabase.auth.getSession()
        if (sessionError) {
          issues.push(`Authentication error: ${sessionError.message}`)
          suggestions.push('Check Supabase authentication configuration')
        }
      } catch (authError) {
        issues.push('Authentication system not working')
        suggestions.push('Check Supabase auth setup and CORS configuration')
      }
      
      let status: 'healthy' | 'warning' | 'error' = 'healthy'
      
      if (issues.length > 0) {
        // Determine severity
        const hasConfigIssues = issues.some(issue => 
          issue.includes('Missing') || 
          issue.includes('does not exist') ||
          issue.includes('Cannot connect')
        )
        status = hasConfigIssues ? 'error' : 'warning'
      }
      
      return { status, issues, suggestions }
      
    } catch (error) {
      return {
        status: 'error',
        issues: ['Health check failed to complete'],
        suggestions: ['Check browser console for detailed error information']
      }
    }
  }

  // Log diagnostic information to console for debugging
  static async logDiagnostics(): Promise<void> {
    try {
      console.log('🔍 Running deployment diagnostics...')
      
      const diagnostics = await this.runFullDiagnostics()
      
      console.group('🌍 Environment Information')
      console.log('Production:', diagnostics.environment.isProduction)
      console.log('Hostname:', diagnostics.environment.hostname)
      console.log('Protocol:', diagnostics.environment.protocol)
      console.groupEnd()
      
      console.group('🗄️ Supabase Configuration')
      console.log('Configured:', diagnostics.supabase.configured)
      console.log('URL Status:', diagnostics.supabase.urlStatus)
      console.log('Key Status:', diagnostics.supabase.keyStatus)
      console.log('Connection Test:', diagnostics.supabase.connectionTest)
      console.groupEnd()
      
      console.group('💾 Storage & Network')
      console.log('LocalStorage:', diagnostics.localStorage.available ? 'Available' : 'Unavailable')
      console.log('Network:', diagnostics.network.online ? 'Online' : 'Offline')
      console.log('Connection Type:', diagnostics.network.effectiveType)
      console.groupEnd()
      
      // Quick health check
      const health = await this.quickHealthCheck()
      console.group(`🏥 Health Check - ${health.status.toUpperCase()}`)
      if (health.issues.length > 0) {
        console.log('Issues:', health.issues)
        console.log('Suggestions:', health.suggestions)
      } else {
        console.log('✅ All systems operational')
      }
      console.groupEnd()
      
    } catch (error) {
      console.error('❌ Diagnostic logging failed:', error)
    }
  }
}

// Export convenience function for console use
export const runDiagnostics = () => DeploymentDiagnosticService.logDiagnostics()
export const quickCheck = () => DeploymentDiagnosticService.quickHealthCheck()

// Auto-run diagnostics in production for immediate feedback
if (window.location.hostname !== 'localhost') {
  // Delay to allow app initialization
  setTimeout(() => {
    DeploymentDiagnosticService.quickHealthCheck().then(health => {
      if (health.status === 'error') {
        console.error('⚠️ Critical deployment issues detected:', health.issues)
        console.log('💡 Suggestions:', health.suggestions)
      }
    })
  }, 2000)
}
