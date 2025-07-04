import { supabaseService } from './supabaseService'
import { UserProfile } from '../types'
import { logger } from './logService'

export class AuthService {
  async signInWithGoogle(googleUser: any): Promise<UserProfile | null> {
    try {
      logger.info('AuthService: Starting Google sign in process', 'AuthService', { 
        hasEmail: !!googleUser.email,
        hasName: !!googleUser.name,
        hasId: !!googleUser.sub || !!googleUser.id,
        hasAccessToken: !!googleUser.access_token
      })

      const googleId = googleUser.sub || googleUser.id
      const email = googleUser.email
      
      if (!email) {
        throw new Error('No email provided by Google OAuth')
      }

      // First, check if user exists by email
      let existingUser = await supabaseService.getUserByEmail(email)
      
      if (existingUser) {
        logger.info('AuthService: Existing user found by email, updating with latest Google info', 'AuthService', { 
          userId: existingUser.id,
          email: existingUser.email 
        })
        
        // Update existing user with latest info from Google
        const updatedUser = await supabaseService.updateUser(existingUser.id, {
          name: googleUser.name || googleUser.given_name || googleUser.family_name,
          imageUrl: googleUser.picture
        })
        
        if (updatedUser) {
          existingUser = updatedUser
        }
        
        // Add access token and return
        existingUser.accessToken = googleUser.access_token
        logger.info('AuthService: Existing user updated and signed in', 'AuthService', { userId: existingUser.id })
        return existingUser
      }

      // User doesn't exist, create new one
      let supabaseUserId: string
      if (window.crypto && window.crypto.randomUUID) {
        // Generate a random UUID for new approach
        supabaseUserId = window.crypto.randomUUID()
      } else {
        // Fallback: use a predictable string format
        supabaseUserId = `google-${googleId}-${Date.now()}`
      }
      
      const newUserProfile: UserProfile = {
        id: supabaseUserId,
        email: email,
        name: googleUser.name || googleUser.given_name || googleUser.family_name,
        imageUrl: googleUser.picture,
        accessToken: googleUser.access_token
      }

      logger.info('AuthService: Creating new user profile from Google data', 'AuthService', { 
        userId: newUserProfile.id,
        email: newUserProfile.email,
        hasName: !!newUserProfile.name 
      })

      // Create new user profile in Supabase
      existingUser = await supabaseService.createUser(newUserProfile)
      
      if (!existingUser) {
        logger.error('AuthService: Failed to create user in Supabase', 'AuthService', { userId: newUserProfile.id })
        // Fallback: return the Google user profile directly
        logger.info('AuthService: Falling back to Google user profile', 'AuthService')
        return newUserProfile
      }
      
      logger.info('AuthService: New user created successfully', 'AuthService', { userId: existingUser.id })

      if (existingUser) {
        existingUser.accessToken = newUserProfile.accessToken
        logger.info('User signed in successfully with Supabase', 'AuthService', { userId: existingUser.id })
        return existingUser
      }

      logger.warn('AuthService: Supabase operations completed but no user returned, using Google profile', 'AuthService')
      return newUserProfile
    } catch (error) {
      logger.error('Failed to sign in with Google', 'AuthService', {}, error as Error)
      
      // Fallback: try to return Google user data directly
      try {
        const fallbackProfile: UserProfile = {
          id: googleUser.sub || googleUser.id || `google_${Date.now()}`,
          email: googleUser.email,
          name: googleUser.name || googleUser.given_name || googleUser.family_name,
          imageUrl: googleUser.picture,
          accessToken: googleUser.access_token
        }
        logger.info('AuthService: Using fallback Google profile due to Supabase error', 'AuthService', { userId: fallbackProfile.id })
        return fallbackProfile
      } catch (fallbackError) {
        logger.error('AuthService: Even fallback failed', 'AuthService', {}, fallbackError as Error)
        return null
      }
    }
  }

  async signOut(): Promise<boolean> {
    try {
      // For now, just log the sign out
      // Later when we implement full Supabase Auth, we'll call supabase.auth.signOut()
      logger.info('User signed out successfully', 'AuthService')
      return true
    } catch (error) {
      logger.error('Failed to sign out', 'AuthService', {}, error as Error)
      return false
    }
  }

  async getCurrentSession() {
    try {
      // For now, return null since we're not using Supabase Auth yet
      // Later we'll implement: const { data: { session }, error } = await supabase.auth.getSession()
      return null
    } catch (error) {
      logger.error('Failed to get current session', 'AuthService', {}, error as Error)
      return null
    }
  }

  // For future Supabase Auth integration
  // onAuthStateChange(callback: (user: UserProfile | null) => void) {
  //   return supabase.auth.onAuthStateChange(async (event, session) => {
  //     if (event === 'SIGNED_IN' && session?.user) {
  //       const userProfile = await supabaseService.getUserById(session.user.id)
  //       if (userProfile) {
  //         userProfile.accessToken = session.access_token
  //         callback(userProfile)
  //       } else {
  //         callback(null)
  //       }
  //     } else if (event === 'SIGNED_OUT') {
  //       callback(null)
  //     }
  //   })
  // }
}

export const authService = new AuthService()
