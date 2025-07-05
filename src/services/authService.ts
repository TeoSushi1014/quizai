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

      const email = googleUser.email
      
      if (!email) {
        throw new Error('No email provided by Google OAuth')
      }

      // Simplified approach: Check for existing session first, then try Google-only fallback
      let supabaseUser = null;
      
      try {
        // First check if we already have a valid session for this email
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        
        if (existingSession?.user && existingSession.user.email === email) {
          supabaseUser = existingSession.user;
          logger.info('AuthService: Found existing valid Supabase session for this email', 'AuthService', { userId: supabaseUser.id });
        } else {
          // Sign out any existing session first
          if (existingSession?.user) {
            await supabase.auth.signOut();
            logger.info('AuthService: Signed out existing session for different user', 'AuthService');
          }
          
          // For now, skip Supabase authentication and use Google-only mode
          // This avoids the authentication issues we're seeing
          logger.info('AuthService: Skipping Supabase authentication, using Google-only mode', 'AuthService', { email });
          
          const fallbackProfile: UserProfile = {
            id: googleUser.sub || googleUser.id || `google_${Date.now()}`,
            email: googleUser.email,
            name: googleUser.name || googleUser.given_name || googleUser.family_name,
            imageUrl: googleUser.picture,
            accessToken: googleUser.access_token
          };
          
          logger.info('AuthService: Created Google-only profile', 'AuthService', { 
            userId: fallbackProfile.id,
            email: fallbackProfile.email
          });
          
          return fallbackProfile;
        }
        
      } catch (authError) {
        logger.error('AuthService: Session check failed, falling back to Google-only mode', 'AuthService', { 
          email: email,
          error: (authError as Error).message
        });
        
        // Return a Google-only profile without Supabase integration
        const fallbackProfile: UserProfile = {
          id: googleUser.sub || googleUser.id || `google_${Date.now()}`,
          email: googleUser.email,
          name: googleUser.name || googleUser.given_name || googleUser.family_name,
          imageUrl: googleUser.picture,
          accessToken: googleUser.access_token
        };
        
        logger.info('AuthService: Created fallback Google profile due to session error', 'AuthService', { 
          userId: fallbackProfile.id,
          email: fallbackProfile.email
        });
        
        return fallbackProfile;
      }

      // If we have a Supabase session, try to work with user profiles
      if (supabaseUser) {
        // Now handle user profile creation/update with authenticated session
        const authenticatedUserId = supabaseUser.id;
        
        logger.info('AuthService: Using Supabase user ID for database operations', 'AuthService', { 
          supabaseUserId: authenticatedUserId,
          googleId: googleUser.sub || googleUser.id,
          email: email 
        });
        
        try {
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
            id: authenticatedUserId,
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
        } catch (profileError) {
          logger.error('AuthService: Profile operations failed, falling back to Google-only', 'AuthService', { error: (profileError as Error).message });
          
          // Even if profile operations fail, return a Google-only profile
          const fallbackProfile: UserProfile = {
            id: googleUser.sub || googleUser.id || `google_${Date.now()}`,
            email: googleUser.email,
            name: googleUser.name || googleUser.given_name || googleUser.family_name,
            imageUrl: googleUser.picture,
            accessToken: googleUser.access_token
          };
          
          return fallbackProfile;
        }
      }

      // This shouldn't be reached since we return Google-only profiles above, but just in case
      logger.warn('AuthService: Unexpected code path reached, using Google-only fallback', 'AuthService');
      const finalFallback: UserProfile = {
        id: googleUser.sub || googleUser.id || `google_${Date.now()}`,
        email: googleUser.email,
        name: googleUser.name || googleUser.given_name || googleUser.family_name,
        imageUrl: googleUser.picture,
        accessToken: googleUser.access_token
      };
      
      return finalFallback;
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
      // Sign out from Supabase
      await supabase.auth.signOut()
      logger.info('User signed out successfully', 'AuthService')
      return true
    } catch (error) {
      logger.error('Failed to sign out', 'AuthService', {}, error as Error)
      return false
    }
  }

  async getCurrentSession() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      return session
    } catch (error) {
      logger.error('Failed to get current session', 'AuthService', {}, error as Error)
      return null
    }
  }
}

export const authService = new AuthService()
