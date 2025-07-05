// Service Role Supabase Client for backend operations
// Add this to supabaseClient.ts or create a separate file

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string

// Service role client for operations that bypass RLS
export const supabaseServiceRole = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
}) : null

// Use this client for admin operations like sharing quizzes
