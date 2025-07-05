/**
 * Deployment Checklist and Environment Validation
 * 
 * This file contains steps to ensure successful deployment of QuizAI
 * Run these checks before and after deployment to identify issues
 */

export const DEPLOYMENT_CHECKLIST = {
  // Environment Variables (Critical)
  environmentVariables: [
    {
      name: 'VITE_SUPABASE_URL',
      description: 'Supabase project URL',
      required: true,
      example: 'https://your-project.supabase.co',
      validation: (value: string) => value.startsWith('https://') && value.includes('.supabase.co')
    },
    {
      name: 'VITE_SUPABASE_ANON_KEY',
      description: 'Supabase anonymous/public API key',
      required: true,
      example: 'eyJ...',
      validation: (value: string) => value.startsWith('eyJ') && value.length > 100
    },
    {
      name: 'VITE_GEMINI_API_KEY',
      description: 'Google Gemini API key for AI quiz generation',
      required: false,
      example: 'AIza...',
      validation: (value: string) => value.startsWith('AIza')
    },
    {
      name: 'VITE_RECAPTCHA_SITE_KEY',
      description: 'reCAPTCHA site key for spam protection',
      required: false,
      example: '6Le...',
      validation: (value: string) => value.startsWith('6L')
    }
  ],

  // Build Configuration
  buildConfig: [
    'Vite configuration properly set up',
    'Base path configured for deployment platform',
    'Environment variables properly defined in build process',
    'All dependencies installed and compatible',
    'TypeScript compilation successful',
    'No build warnings or errors'
  ],

  // Database Setup
  database: [
    'Supabase project created and active',
    'Database tables created (users, quizzes, quiz_results, shared_quizzes)',
    'Row Level Security (RLS) policies configured',
    'API keys table created if using server-side key management',
    'Storage buckets configured if using file uploads',
    'Database migrations applied'
  ],

  // Authentication Setup
  authentication: [
    'Google OAuth configured in Supabase',
    'Redirect URLs configured for production domain',
    'CORS settings configured in Supabase',
    'Auth providers enabled',
    'Email templates configured if using email auth'
  ],

  // Platform-Specific Configuration
  deployment: {
    vercel: [
      'Environment variables set in Vercel dashboard',
      'Build command configured: npm run build',
      'Output directory configured: dist',
      'Node.js version specified',
      'Vercel.json configured if needed'
    ],
    netlify: [
      'Environment variables set in Netlify dashboard',
      'Build command configured: npm run build',
      'Publish directory configured: dist',
      '_redirects file configured for SPA routing',
      'netlify.toml configured if needed'
    ],
    githubPages: [
      'GitHub Actions workflow configured',
      'Environment secrets set in GitHub repository',
      'Base path configured for repository name',
      'CNAME file configured for custom domain'
    ]
  },

  // Post-Deployment Testing
  testing: [
    'Homepage loads successfully',
    'Google authentication works',
    'Quiz creation functionality works',
    'Quiz taking functionality works',
    'Quiz sharing functionality works',
    'Data persistence works',
    'All navigation routes work',
    'No console errors',
    'Mobile responsiveness verified'
  ]
}

export interface ValidationResult {
  name: string
  status: 'pass' | 'fail' | 'warning' | 'not-checked'
  message: string
  suggestion?: string
}

export class EnvironmentValidator {
  static validateEnvironment(): ValidationResult[] {
    const results: ValidationResult[] = []
    
    // Check environment variables
    DEPLOYMENT_CHECKLIST.environmentVariables.forEach(envVar => {
      const value = (import.meta.env as any)[envVar.name] as string
      
      if (envVar.required && !value) {
        results.push({
          name: envVar.name,
          status: 'fail',
          message: `Required environment variable is missing`,
          suggestion: `Set ${envVar.name} in your deployment environment. Example: ${envVar.example}`
        })
      } else if (value && envVar.validation && !envVar.validation(value)) {
        results.push({
          name: envVar.name,
          status: 'warning',
          message: `Environment variable format may be incorrect`,
          suggestion: `Check the format of ${envVar.name}. Expected pattern: ${envVar.example}`
        })
      } else if (value) {
        results.push({
          name: envVar.name,
          status: 'pass',
          message: `Environment variable configured correctly`
        })
      } else {
        results.push({
          name: envVar.name,
          status: 'not-checked',
          message: `Optional environment variable not set`
        })
      }
    })

    // Check build environment
    const isProduction = window.location.hostname !== 'localhost'
    results.push({
      name: 'Environment Type',
      status: 'pass',
      message: `Running in ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode`
    })

    // Check URL structure
    const url = window.location.href
    if (isProduction) {
      if (url.includes('http://') && !url.includes('localhost')) {
        results.push({
          name: 'HTTPS',
          status: 'warning',
          message: 'Site is not using HTTPS',
          suggestion: 'Configure SSL/TLS certificate for better security'
        })
      } else {
        results.push({
          name: 'HTTPS',
          status: 'pass',
          message: 'Site is using HTTPS'
        })
      }
    }

    return results
  }

  static async validateSupabaseConnection(): Promise<ValidationResult[]> {
    const results: ValidationResult[] = []

    try {
      // Test basic connection
      const { supabase } = await import('../services/supabaseClient')
      
      const startTime = performance.now()
      const { error: testError } = await supabase.from('users').select('count').limit(1)
      const latency = performance.now() - startTime

      if (testError) {
        if (testError.code === '42P01') {
          results.push({
            name: 'Database Tables',
            status: 'fail',
            message: 'Required database tables do not exist',
            suggestion: 'Run database migration scripts to create required tables'
          })
        } else if (testError.code === '42501') {
          results.push({
            name: 'Database Permissions',
            status: 'fail',
            message: 'Row Level Security policies are blocking access',
            suggestion: 'Check RLS policies in Supabase dashboard'
          })
        } else {
          results.push({
            name: 'Database Connection',
            status: 'fail',
            message: `Database error: ${testError.message}`,
            suggestion: 'Check Supabase configuration and network connectivity'
          })
        }
      } else {
        results.push({
          name: 'Database Connection',
          status: 'pass',
          message: `Connected successfully (${latency.toFixed(0)}ms latency)`
        })
      }

      // Test authentication
      const { error: authError } = await supabase.auth.getSession()
      if (authError) {
        results.push({
          name: 'Authentication System',
          status: 'warning',
          message: `Auth error: ${authError.message}`,
          suggestion: 'Check Supabase authentication configuration'
        })
      } else {
        results.push({
          name: 'Authentication System',
          status: 'pass',
          message: 'Authentication system is working'
        })
      }

    } catch (connectionError) {
      results.push({
        name: 'Supabase Connection',
        status: 'fail',
        message: `Cannot connect to Supabase: ${(connectionError as Error).message}`,
        suggestion: 'Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables'
      })
    }

    return results
  }

  static async runFullValidation(): Promise<{
    environment: ValidationResult[]
    supabase: ValidationResult[]
    summary: {
      total: number
      passed: number
      failed: number
      warnings: number
      notChecked: number
    }
  }> {
    const environment = this.validateEnvironment()
    const supabase = await this.validateSupabaseConnection()
    
    const allResults = [...environment, ...supabase]
    const summary = {
      total: allResults.length,
      passed: allResults.filter(r => r.status === 'pass').length,
      failed: allResults.filter(r => r.status === 'fail').length,
      warnings: allResults.filter(r => r.status === 'warning').length,
      notChecked: allResults.filter(r => r.status === 'not-checked').length
    }

    return { environment, supabase, summary }
  }

  static logValidationResults(results: ValidationResult[]): void {
    console.group('🔍 Environment Validation Results')
    
    results.forEach(result => {
      const icon = {
        'pass': '✅',
        'fail': '❌',
        'warning': '⚠️',
        'not-checked': '➖'
      }[result.status]
      
      console.log(`${icon} ${result.name}: ${result.message}`)
      if (result.suggestion) {
        console.log(`   💡 ${result.suggestion}`)
      }
    })
    
    console.groupEnd()
  }
}

// Export convenience functions for console use
export const validateEnvironment = () => {
  const results = EnvironmentValidator.validateEnvironment()
  EnvironmentValidator.logValidationResults(results)
  return results
}

export const validateSupabase = async () => {
  const results = await EnvironmentValidator.validateSupabaseConnection()
  EnvironmentValidator.logValidationResults(results)
  return results
}

export const validateAll = async () => {
  const validation = await EnvironmentValidator.runFullValidation()
  
  console.log('🎯 Validation Summary:')
  console.log(`   Total checks: ${validation.summary.total}`)
  console.log(`   ✅ Passed: ${validation.summary.passed}`)
  console.log(`   ❌ Failed: ${validation.summary.failed}`)
  console.log(`   ⚠️ Warnings: ${validation.summary.warnings}`)
  console.log(`   ➖ Not checked: ${validation.summary.notChecked}`)
  
  if (validation.summary.failed > 0) {
    console.error('❌ Critical issues found! Fix these before deployment:')
    const failedResults = [...validation.environment, ...validation.supabase].filter(r => r.status === 'fail')
    EnvironmentValidator.logValidationResults(failedResults)
  }
  
  return validation
}

// Common deployment platform instructions
export const PLATFORM_INSTRUCTIONS = {
  vercel: `
🚀 Vercel Deployment Instructions:

1. Install Vercel CLI: npm i -g vercel
2. Login: vercel login
3. Deploy: vercel --prod
4. Set environment variables in Vercel dashboard:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY
   - VITE_GEMINI_API_KEY (optional)
5. Configure build settings:
   - Framework: Vite
   - Build Command: npm run build
   - Output Directory: dist
  `,
  
  netlify: `
🚀 Netlify Deployment Instructions:

1. Connect GitHub repository to Netlify
2. Set build settings:
   - Build command: npm run build
   - Publish directory: dist
3. Set environment variables in Site settings:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY
   - VITE_GEMINI_API_KEY (optional)
4. Add _redirects file for SPA routing:
   /* /index.html 200
  `,
  
  githubPages: `
🚀 GitHub Pages Deployment Instructions:

1. Create .github/workflows/deploy.yml
2. Set GitHub Secrets in repository settings:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY
   - VITE_GEMINI_API_KEY (optional)
3. Update vite.config.ts base path to match repository name
4. Enable GitHub Pages in repository settings
  `
}

// Log platform instructions
export const showDeploymentInstructions = (platform: keyof typeof PLATFORM_INSTRUCTIONS) => {
  console.log(PLATFORM_INSTRUCTIONS[platform])
}
