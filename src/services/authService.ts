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

      // Strategy: Use Google OAuth with Supabase for proper authentication
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
          
          // Use Supabase's Google OAuth integration if we have an access token
          if (googleUser.access_token) {
            logger.info('AuthService: Attempting Supabase Google OAuth authentication', 'AuthService', { email });
            
            try {
              const { data: oauthData, error: oauthError } = await supabase.auth.signInWithIdToken({
                provider: 'google',
                token: googleUser.access_token,
                access_token: googleUser.access_token
              });
              
              if (oauthError) {
                logger.warn('AuthService: Google OAuth token authentication failed, trying alternative approaches', 'AuthService', { error: oauthError.message });
                throw new Error(`OAuth failed: ${oauthError.message}`);
              }
              
              if (oauthData.user) {
                supabaseUser = oauthData.user;
                logger.info('AuthService: Successfully authenticated with Google OAuth token', 'AuthService', { 
                  userId: supabaseUser.id,
                  hasSession: !!oauthData.session 
                });
              }
            } catch (oauthError) {
              logger.warn('AuthService: Google OAuth method failed, attempting manual user linking approach', 'AuthService', { error: (oauthError as Error).message });
              
              // For existing users, we need a different approach
              // Try to find the existing user in the database first
              try {
                const existingDbUser = await supabaseService.getUserByEmail(email);
                
                if (existingDbUser && existingDbUser.supabaseId) {
                  logger.info('AuthService: Found existing database user with Supabase ID, attempting direct auth link', 'AuthService', { 
                    dbUserId: existingDbUser.id,
                    supabaseId: existingDbUser.supabaseId,
                    email: email
                  });
                  
                  // The user exists in our database with a specific Supabase ID
                  // We need to create a Supabase auth user that matches this ID
                  const targetSupabaseId = existingDbUser.supabaseId;
                  
                  // Try password-based authentication with the target ID approach
                  const userPassword = `QuizAI_User_${email.split('@')[0]}_${email.split('@')[1].split('.')[0]}_2025`;
                  
                  try {
                    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                      email: email,
                      password: userPassword
                    });
                    
                    if (signInError) {
                      if (signInError.message.includes('Invalid login credentials')) {
                        logger.info('AuthService: No existing auth user, creating one for existing database user', 'AuthService', { email, targetSupabaseId });
                        
                        // Create auth user that should match the existing database user
                        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                          email: email,
                          password: userPassword,
                          options: {
                            emailRedirectTo: undefined,
                            data: {
                              name: googleUser.name,
                              avatar_url: googleUser.picture,
                              google_id: googleUser.sub || googleUser.id,
                              provider: 'google',
                              target_user_id: targetSupabaseId // Hint for linking
                            }
                          }
                        });
                        
                        if (signUpError && !signUpError.message.includes('User already registered')) {
                          logger.error('AuthService: Failed to create auth user for existing database user', 'AuthService', { error: signUpError.message });
                          throw new Error(`Auth user creation failed: ${signUpError.message}`);
                        }
                        
                        if (signUpError?.message.includes('User already registered')) {
                          logger.info('AuthService: Auth user already exists, trying sign in again', 'AuthService', { email });
                          const { data: retrySignIn, error: retryError } = await supabase.auth.signInWithPassword({
                            email: email,
                            password: userPassword
                          });
                          
                          if (retryError) {
                            logger.error('AuthService: Retry sign-in failed for existing user', 'AuthService', { error: retryError.message });
                            throw new Error('Failed to authenticate existing user');
                          }
                          
                          supabaseUser = retrySignIn.user;
                        } else {
                          supabaseUser = signUpData?.user;
                        }
                        
                        logger.info('AuthService: Successfully created/linked auth user for existing database user', 'AuthService', { 
                          authUserId: supabaseUser?.id,
                          targetDbUserId: targetSupabaseId
                        });
                      } else {
                        throw new Error(`Unexpected sign-in error: ${signInError.message}`);
                      }
                    } else {
                      supabaseUser = signInData.user;
                      logger.info('AuthService: Successfully signed in existing auth user', 'AuthService', { 
                        userId: supabaseUser?.id 
                      });
                    }
                  } catch (linkingError) {
                    logger.error('AuthService: Failed to link authentication with existing database user', 'AuthService', { error: (linkingError as Error).message });
                    throw linkingError;
                  }
                } else {
                  logger.info('AuthService: No existing database user found, proceeding with new user creation', 'AuthService', { email });
                  throw new Error('No existing database user found - create new user');
                }
              } catch (dbCheckError) {
                logger.warn('AuthService: Could not check for existing database user, falling back to standard auth', 'AuthService', { error: (dbCheckError as Error).message });
                
                // Fallback to standard password authentication for new users
                const userPassword = `QuizAI_User_${email.split('@')[0]}_${email.split('@')[1].split('.')[0]}_2025`;
                
                try {
                  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: userPassword
                  });
                  
                  if (signInError) {
                    if (signInError.message.includes('Invalid login credentials')) {
                      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                        email: email,
                        password: userPassword,
                        options: {
                          emailRedirectTo: undefined,
                          data: {
                            name: googleUser.name,
                            avatar_url: googleUser.picture,
                            google_id: googleUser.sub || googleUser.id,
                            provider: 'google'
                          }
                        }
                      });
                      
                      if (signUpError && !signUpError.message.includes('User already registered')) {
                        throw new Error(`Standard signup failed: ${signUpError.message}`);
                      }
                      
                      supabaseUser = signUpData?.user;
                    } else {
                      throw new Error(`Standard authentication failed: ${signInError.message}`);
                    }
                  } else {
                    supabaseUser = signInData.user;
                  }
                } catch (standardError) {
                  logger.error('AuthService: Standard password authentication failed', 'AuthService', { error: (standardError as Error).message });
                  throw standardError;
                }
              }
            }
          } else {
            logger.warn('AuthService: No access token available, cannot perform OAuth authentication', 'AuthService', { email });
            throw new Error('No access token available for authentication');
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
            
            // CRITICAL: Set both Google ID and Supabase ID for proper functionality
            existingUser.accessToken = googleUser.access_token
            existingUser.supabaseId = authenticatedUserId  // This is crucial for quiz sharing!
            
            logger.info('AuthService: Existing user updated and signed in with Supabase session', 'AuthService', { 
              userId: existingUser.id,
              supabaseId: existingUser.supabaseId 
            })
            return existingUser
          }

          const newUserProfile: UserProfile = {
            id: authenticatedUserId, // Use Supabase ID as primary ID for new users
            supabaseId: authenticatedUserId, // Also set supabaseId explicitly
            email: email,
            name: googleUser.name || googleUser.given_name || googleUser.family_name,
            imageUrl: googleUser.picture,
            accessToken: googleUser.access_token
          }

          logger.info('AuthService: Creating new user profile from Google data with Supabase integration', 'AuthService', { 
            userId: newUserProfile.id,
            supabaseId: newUserProfile.supabaseId,
            email: newUserProfile.email,
            hasName: !!newUserProfile.name 
          })

          existingUser = await supabaseService.createUser(newUserProfile)
          
          if (!existingUser) {
            logger.error('AuthService: Failed to create user in Supabase', 'AuthService', { userId: newUserProfile.id })
            logger.info('AuthService: Falling back to Google user profile with Supabase session info', 'AuthService')
            // Even if DB creation fails, return profile with Supabase session info
            newUserProfile.supabaseId = authenticatedUserId
            return newUserProfile
          }
          
          logger.info('AuthService: New user created successfully with Supabase integration', 'AuthService', { 
            userId: existingUser.id,
            supabaseId: existingUser.supabaseId || authenticatedUserId
          })

          if (existingUser) {
            existingUser.accessToken = newUserProfile.accessToken
            existingUser.supabaseId = authenticatedUserId // Ensure supabaseId is always set
            logger.info('User signed in successfully with Supabase', 'AuthService', { 
              userId: existingUser.id,
              supabaseId: existingUser.supabaseId 
            })
            return existingUser
          }

          logger.warn('AuthService: Supabase operations completed but no user returned, using Google profile with session', 'AuthService')
          newUserProfile.supabaseId = authenticatedUserId // Ensure supabaseId is set even in fallback
          return newUserProfile
        } catch (profileError) {
          logger.error('AuthService: Profile operations failed, falling back to Google-only', 'AuthService', { error: (profileError as Error).message });
          
          // Even if profile operations fail, return a Google-only profile
          const fallbackProfile: UserProfile = {
            id: googleUser.sub || googleUser.id || `google_${Date.now()}`,
            supabaseId: authenticatedUserId, // Still include Supabase session info if available
            email: googleUser.email,
            name: googleUser.name || googleUser.given_name || googleUser.family_name,
            imageUrl: googleUser.picture,
            accessToken: googleUser.access_token
          };
          
          logger.info('AuthService: Using fallback profile with Supabase session', 'AuthService', { 
            userId: fallbackProfile.id,
            supabaseId: fallbackProfile.supabaseId
          });
          
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
    userDetails?: any;
    sessionDetails?: any;
    error?: string 
  }> {
    try {
      logger.info('Testing Supabase connectivity and authentication', 'AuthService', { email });

      // Test 1: Check session
      const { data: { session } } = await supabase.auth.getSession();
      const hasSession = !!session?.user;
      
      const sessionDetails = session ? {
        userId: session.user?.id,
        email: session.user?.email,
        provider: session.user?.app_metadata?.provider,
        lastSignIn: session.user?.last_sign_in_at
      } : null;
      
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
      let userDetails = null;
      try {
        const userData = await supabaseService.getUserByEmail(email);
        canReadUsers = true; // If we get here without error, we can read users
        userExists = !!userData;
        userDetails = userData ? {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          supabaseId: userData.supabaseId
        } : null;
        
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
        userExists,
        userDetails,
        sessionDetails
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
