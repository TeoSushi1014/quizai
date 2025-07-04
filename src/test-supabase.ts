import { supabase } from './services/supabaseClient'
import { supabaseService } from './services/supabaseService'

export const testSupabaseConnection = async () => {
  try {
    console.log('🧪 Testing Supabase connection...')
    
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1)

    if (error) {
      console.error('❌ Supabase connection error:', error)
      return false
    }

    console.log('✅ Basic Supabase connection successful!')

    console.log('🧪 Testing environment variables...')
    console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL)
    console.log('VITE_SUPABASE_ANON_KEY (first 20 chars):', import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20) + '...')

    console.log('🎉 All Supabase tests completed!')
    return true
  } catch (err) {
    console.error('❌ Supabase test failed:', err)
    return false
  }
}

export const testDirectInsert = async () => {
  try {
    console.log('🧪 Testing direct user insert...')
    
    const testUserId = `test-direct-${Date.now()}`
    const testUserData = {
      id: testUserId,
      email: 'test-direct@example.com',
      name: 'Direct Test User',
      image_url: 'https://example.com/avatar.jpg',
      quiz_count: 0,
      completion_count: 0,
      average_score: null
    }

    console.log('Inserting test user:', testUserData)

    const { data, error } = await supabase
      .from('users')
      .insert([testUserData])
      .select()
      .single()

    if (error) {
      console.error('❌ Direct insert failed:', error)
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      return false
    }

    console.log('✅ Direct insert successful!', data)
    return true
  } catch (err) {
    console.error('❌ Direct insert test failed:', err)
    return false
  }
}

export const testSupabaseService = async () => {
  try {
    console.log('🧪 Testing SupabaseService createUser...')
    
    const testProfile = {
      id: `test-service-${Date.now()}`,
      email: 'test-service@example.com',
      name: 'Service Test User',
      imageUrl: 'https://example.com/avatar2.jpg'
    }

    console.log('Creating user via SupabaseService:', testProfile)
    
    const { supabaseService } = await import('./services/supabaseService')
    const result = await supabaseService.createUser(testProfile)
    
    if (result) {
      console.log('✅ SupabaseService createUser successful!', result)
      return true
    } else {
      console.error('❌ SupabaseService createUser returned null')
      return false
    }
  } catch (err) {
    console.error('❌ SupabaseService test failed:', err)
    return false
  }
}

if (typeof window !== 'undefined') {
  (window as any).testSupabase = {
    testConnection: testSupabaseConnection,
    testDirectInsert: testDirectInsert,
    testService: testSupabaseService
  }
  console.log('🔧 Supabase tests available via:')
  console.log('  window.testSupabase.testConnection()')
  console.log('  window.testSupabase.testDirectInsert()')
  console.log('  window.testSupabase.testService()')
}
