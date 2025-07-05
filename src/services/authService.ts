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

      // Strategy: Use email-based authentication with Supabase to satisfy RLS policies
      let supabaseUser = null;
      
      try {
        // First check if we already have a session
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        
        if (existingSession?.user && existingSession.user.email === email) {
          supabaseUser = existingSession.user;
          logger.info('AuthService: Found existing Supabase session for this email', 'AuthService', { userId: supabaseUser.id });
        } else {
          // Sign out any existing session first
          if (existingSession?.user) {
            await supabase.auth.signOut();
            logger.info('AuthService: Signed out existing session for different user', 'AuthService');
          }
          
          // Now that email confirmation is disabled, use proper Supabase authentication
          logger.info('AuthService: Attempting Supabase authentication with email confirmation disabled', 'AuthService', { email });
          
          // Use email and a consistent password for this user
          const userPassword = `QuizAI_${email.replace('@', '_at_').replace('.', '_dot_')}_${process.env.NODE_ENV || 'prod'}`;
          
          // Try to sign in first
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: email,
            password: userPassword
          });
          
          if (signInError && signInError.message.includes('Invalid login credentials')) {
            // User doesn't exist, create them
            logger.info('AuthService: User does not exist, creating new user with disabled email confirmation', 'AuthService', { email });
            
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
              email: email,
              password: userPassword,
              options: {
                data: {
                  name: googleUser.name,
                  avatar_url: googleUser.picture,
                  google_id: googleUser.sub || googleUser.id
                }
              }
            });
            
            if (signUpError) {
              logger.error('AuthService: Sign up failed', 'AuthService', { error: signUpError.message });
              throw new Error(`Sign up failed: ${signUpError.message}`);
            }
            
            supabaseUser = signUpData.user;
            logger.info('AuthService: Successfully created new Supabase user with session', 'AuthService', { 
              userId: supabaseUser?.id,
              hasSession: !!signUpData.session 
            });
          } else if (signInError) {
            // Handle specific error cases
            if (signInError.message.includes('Email not confirmed')) {
              logger.info('AuthService: Email not confirmed, will use fallback Google profile', 'AuthService', { email });
              // For unconfirmed emails, don't proceed with Supabase operations
              // Jump directly to fallback Google profile logic
              const fallbackProfile: UserProfile = {
                id: googleUser.sub || googleUser.id || `google_${Date.now()}`,
                email: googleUser.email,
                name: googleUser.name || googleUser.given_name || googleUser.family_name,
                imageUrl: googleUser.picture,
                accessToken: googleUser.access_token
              }
              logger.info('AuthService: Using fallback Google profile due to unconfirmed email', 'AuthService', { userId: fallbackProfile.id })
              return fallbackProfile
            } else if (signInError.message.includes('Invalid login credentials')) {
              // This case should have been handled above, but just in case
              logger.warn('AuthService: Invalid credentials detected in unexpected branch', 'AuthService', { email });
            } else {
              logger.error('AuthService: Unexpected sign in error', 'AuthService', { error: signInError.message });
              throw new Error(`Authentication failed: ${signInError.message}`);
            }
          } else {
            supabaseUser = signInData.user;
            logger.info('AuthService: Successfully signed in existing Supabase user', 'AuthService', { 
              userId: supabaseUser?.id,
              hasSession: !!signInData.session 
            });
          }
        }
        
        // Verify we have a valid session after authentication
        const { data: { session: finalSession } } = await supabase.auth.getSession();
        
        if (!finalSession?.user) {
          logger.error('AuthService: No session available after authentication', 'AuthService', { 
            supabaseUserId: supabaseUser?.id,
            email: email
          });
          throw new Error('Failed to establish authenticated session after sign in/up');
        }
        
        logger.info('AuthService: Confirmed authenticated session is active', 'AuthService', { 
          userId: finalSession.user.id,
          email: finalSession.user.email
        });
        
      } catch (authError) {
        logger.error('AuthService: Failed to establish Supabase session', 'AuthService', { error: (authError as Error).message });
        throw new Error('Authentication failed: Unable to establish Supabase session required for database operations');
      }

      // If we still don't have a Supabase user, we cannot proceed with database operations due to RLS
      if (!supabaseUser) {
        logger.error('AuthService: Cannot proceed without Supabase authentication - RLS policies will block operations', 'AuthService');
        throw new Error('Authentication failed: Unable to establish Supabase session required for database operations');
      }

      // If we still don't have a Supabase user, we cannot proceed with database operations due to RLS
      if (!supabaseUser) {
        logger.error('AuthService: Cannot proceed without Supabase authentication - RLS policies will block operations', 'AuthService');
        throw new Error('Authentication failed: Unable to establish Supabase session required for database operations');
      }

      // Now handle user profile creation/update with authenticated session
      // Get the current session to ensure we have the correct user ID
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const authenticatedUserId = currentSession?.user?.id;
      
      if (!authenticatedUserId) {
        throw new Error('No authenticated user ID available for database operations');
      }
      
      logger.info('AuthService: Using Supabase user ID for database operations', 'AuthService', { 
        supabaseUserId: authenticatedUserId,
        googleId: googleUser.sub || googleUser.id,
        email: email 
      });
      
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
