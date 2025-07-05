import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Enhanced deployment environment checking
const isProduction = window?.location?.hostname !== 'localhost' && !window?.location?.hostname?.includes('127.0.0.1')

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = `Missing Supabase environment variables in ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}:
    VITE_SUPABASE_URL: ${supabaseUrl ? 'configured' : 'MISSING'}
    VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? 'configured' : 'MISSING'}
    
    For production deployment, ensure these environment variables are properly set:
    - In Vercel: Add to Environment Variables in project settings
    - In Netlify: Add to Site settings > Environment variables
    - In GitHub Pages: Use GitHub Secrets for Actions
    - In other platforms: Check platform-specific environment variable documentation`
  
  console.error(errorMsg);
  throw new Error('Missing Supabase environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required')
}

// Log configuration status for debugging (without sensitive data)
if (isProduction) {
  console.log(`🔧 Supabase Configuration Status:
    Environment: PRODUCTION
    URL: ${supabaseUrl.substring(0, 20)}...
    Key Length: ${supabaseAnonKey.length} characters
    Hostname: ${window.location.hostname}`)
} else {
  console.log('🔧 Supabase Configuration: Development mode')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    // Add deployment-specific settings
    flowType: 'pkce',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined
  },
  // Add timeout for better error handling in production
  global: {
    headers: {
      'x-client-info': isProduction ? 'quizai-prod' : 'quizai-dev'
    }
  }
})

export type { Database } from './database.types'
