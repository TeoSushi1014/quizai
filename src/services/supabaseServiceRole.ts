// Service Role Supabase Client for backend operations
// Add this to supabaseClient.ts or create a separate file

import { createClient } from '@supabase/supabase-js'
import { logger } from './logService'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string

if (!supabaseUrl) {
  logger.error('VITE_SUPABASE_URL is not set in environment variables', 'supabaseServiceRole');
}

if (!supabaseServiceKey) {
  logger.warn('VITE_SUPABASE_SERVICE_ROLE_KEY is not set - some operations requiring elevated privileges may fail', 'supabaseServiceRole');
}

// Service role client for operations that bypass RLS
export const supabaseServiceRole = (supabaseServiceKey && supabaseUrl) ? createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
}) : null

// Use this client for admin operations like sharing quizzes
