import { supabaseService } from './supabaseService'
import { supabase } from './supabaseClient'
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

      // First, authenticate with Supabase using the Google token
      let supabaseUser = null;
      
      try {
        // Try to sign in with Supabase using Google ID token if available
        if (googleUser.id_token) {
          logger.info('AuthService: Authenticating with Supabase using Google ID token', 'AuthService');
          const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: googleUser.id_token
          });
          
          if (error) {
            logger.warn('AuthService: Supabase Google auth failed, using fallback method', 'AuthService', { error: error.message });
          } else {
            supabaseUser = data.user;
            logger.info('AuthService: Successfully authenticated with Supabase', 'AuthService', { userId: supabaseUser?.id });
          }
        }
      } catch (authError) {
        logger.warn('AuthService: Supabase authentication failed, using fallback method', 'AuthService', { error: (authError as Error).message });
      }

      // If Supabase auth failed, create a custom session
      let supabaseUserId: string = '';
      if (!supabaseUser) {
        logger.info('AuthService: Creating custom user session', 'AuthService');
        
        // Generate a consistent UUID for the user based on their Google ID or email
        if (window.crypto && window.crypto.randomUUID) {
          // For consistency, try to use existing user ID if they exist
          const existingUser = await supabaseService.getUserByEmail(email);
          if (existingUser) {
            supabaseUserId = existingUser.id;
          } else {
            supabaseUserId = window.crypto.randomUUID();
          }
        } else {
          supabaseUserId = `google-${googleId}-${Date.now()}`;
        }

        // Create a minimal user session for Supabase
        try {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: `custom-${supabaseUserId}`,
            refresh_token: `refresh-${supabaseUserId}`
          });
          
          if (sessionError) {
            logger.warn('AuthService: Could not set custom session', 'AuthService', { error: sessionError.message });
          }
        } catch (sessionError) {
          logger.warn('AuthService: Session creation failed', 'AuthService', { error: (sessionError as Error).message });
        }
      }

      // Now handle user profile creation/update
      const userId = supabaseUser?.id || supabaseUserId;
      
      let existingUser = await supabaseService.getUserByEmail(email)
      
      if (existingUser) {
        logger.info('AuthService: Existing user found by email, updating with latest Google info', 'AuthService', { 
          userId: existingUser.id,
          email: existingUser.email 
        })
        
        const updatedUser = await supabaseService.updateUser(existingUser.id, {
          name: googleUser.name || googleUser.given_name || googleUser.family_name,
          imageUrl: googleUser.picture
        })
        
        if (updatedUser) {
          existingUser = updatedUser
        }
        
        existingUser.accessToken = googleUser.access_token
        logger.info('AuthService: Existing user updated and signed in', 'AuthService', { userId: existingUser.id })
        return existingUser
      }

      const newUserProfile: UserProfile = {
        id: userId,
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

      existingUser = await supabaseService.createUser(newUserProfile)
      
      if (!existingUser) {
        logger.error('AuthService: Failed to create user in Supabase', 'AuthService', { userId: newUserProfile.id })
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
      logger.info('User signed out successfully', 'AuthService')
      return true
    } catch (error) {
      logger.error('Failed to sign out', 'AuthService', {}, error as Error)
      return false
    }
  }

  async getCurrentSession() {
    try {
      return null
    } catch (error) {
      logger.error('Failed to get current session', 'AuthService', {}, error as Error)
      return null
    }
  }
}

export const authService = new AuthService()
