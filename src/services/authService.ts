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

      // Strategy: Try to establish Supabase authentication for existing users first
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
          
          // Try to sign in the user with Supabase using a consistent password approach
          // This is needed for users who already exist in the database
          logger.info('AuthService: Attempting Supabase authentication for existing user', 'AuthService', { email });
          
          // Generate a consistent password for this user (same approach as before but refined)
          const userPassword = `QuizAI_User_${email.split('@')[0]}_${email.split('@')[1].split('.')[0]}_2025`;
          
          try {
            // First, try to sign in with the generated password
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
              email: email,
              password: userPassword
            });
            
            if (signInError) {
              if (signInError.message.includes('Invalid login credentials') || signInError.message.includes('Invalid email or password')) {
                // User exists but with different credentials, try to create them with the new password
                logger.info('AuthService: User exists but credentials mismatch, attempting to create/update auth', 'AuthService', { email });
                
                const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                  email: email,
                  password: userPassword,
                  options: {
                    emailRedirectTo: undefined, // Disable email confirmation
                    data: {
                      name: googleUser.name,
                      avatar_url: googleUser.picture,
                      google_id: googleUser.sub || googleUser.id,
                      provider: 'google'
                    }
                  }
                });
                
                if (signUpError) {
                  if (signUpError.message.includes('User already registered')) {
                    // This is fine - user exists in auth but we couldn't sign in
                    // Let's try one more approach: password reset or fallback to Google-only
                    logger.info('AuthService: User already exists in auth, falling back to Google-only mode', 'AuthService', { email });
                    throw new Error('User exists but authentication failed - using Google-only mode');
                  } else {
                    logger.error('AuthService: Sign up failed', 'AuthService', { error: signUpError.message });
                    throw new Error(`Sign up failed: ${signUpError.message}`);
                  }
                }
                
                supabaseUser = signUpData.user;
                logger.info('AuthService: Successfully created new Supabase auth user', 'AuthService', { 
                  userId: supabaseUser?.id,
                  hasSession: !!signUpData.session 
                });
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
          } catch (innerAuthError) {
            logger.error('AuthService: Inner authentication attempt failed', 'AuthService', { error: (innerAuthError as Error).message });
            throw innerAuthError;
          }
        }
        
      } catch (authError) {
        logger.error('AuthService: Supabase authentication failed, falling back to Google-only mode', 'AuthService', { 
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
        
        logger.info('AuthService: Created fallback Google profile due to auth failure', 'AuthService', { 
          userId: fallbackProfile.id,
          email: fallbackProfile.email
        });
        
        return fallbackProfile;
      }

      // If we have a Supabase session, try to work with user profiles
      if (supabaseUser) {
        // Verify we have a valid session after authentication
        const { data: { session: finalSession } } = await supabase.auth.getSession();
        
        if (!finalSession?.user) {
          logger.error('AuthService: No session available after authentication', 'AuthService', { 
            supabaseUserId: supabaseUser?.id,
            email: email
          });
          throw new Error('Failed to establish authenticated session after sign in/up');
        }
        
        // Now handle user profile creation/update with authenticated session
        const authenticatedUserId = finalSession.user.id;
        
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

  // Debug function to test authentication and database connectivity
  async testSupabaseConnectivity(email: string): Promise<{ 
    canConnect: boolean; 
    hasSession: boolean; 
    canReadUsers: boolean; 
    canReadQuizzes: boolean;
    userExists: boolean;
    error?: string 
  }> {
    try {
      logger.info('Testing Supabase connectivity and authentication', 'AuthService', { email });

      // Test 1: Check session
      const { data: { session } } = await supabase.auth.getSession();
      const hasSession = !!session?.user;
      
      logger.info('Session check result', 'AuthService', { 
        hasSession, 
        sessionUserEmail: session?.user?.email,
        sessionUserId: session?.user?.id 
      });

      // Test 2: Basic connectivity
      let canConnect = false;
      try {
        const { error: connectError } = await supabase.from('users').select('count').limit(1);
        canConnect = !connectError;
        if (connectError) {
          logger.warn('Basic connectivity test failed', 'AuthService', { error: connectError.message });
        } else {
          logger.info('Basic connectivity test passed', 'AuthService');
        }
      } catch (error) {
        logger.error('Basic connectivity test error', 'AuthService', {}, error as Error);
      }

      // Test 3: Can read users table
      let canReadUsers = false;
      let userExists = false;
      try {
        const userData = await supabaseService.getUserByEmail(email);
        canReadUsers = true; // If we get here without error, we can read users
        userExists = !!userData;
        
        logger.info('Users table read test passed', 'AuthService', { userExists, userId: userData?.id });
      } catch (error) {
        logger.error('Users table read test error', 'AuthService', {}, error as Error);
      }

      // Test 4: Can read quizzes table
      let canReadQuizzes = false;
      try {
        const { error: quizError } = await supabase.from('quizzes').select('count').limit(1);
        canReadQuizzes = !quizError;
        
        if (quizError) {
          logger.warn('Quizzes table read test failed', 'AuthService', { error: quizError.message });
        } else {
          logger.info('Quizzes table read test passed', 'AuthService');
        }
      } catch (error) {
        logger.error('Quizzes table read test error', 'AuthService', {}, error as Error);
      }

      const result = {
        canConnect,
        hasSession,
        canReadUsers,
        canReadQuizzes,
        userExists
      };

      logger.info('Supabase connectivity test completed', 'AuthService', result);
      return result;

    } catch (error) {
      const errorMsg = (error as Error).message;
      logger.error('Supabase connectivity test failed', 'AuthService', { email }, error as Error);
      return {
        canConnect: false,
        hasSession: false,
        canReadUsers: false,
        canReadQuizzes: false,
        userExists: false,
        error: errorMsg
      };
    }
  }
}

export const authService = new AuthService()
