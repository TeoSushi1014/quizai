import { supabaseService } from './supabaseService'
import { supabase } from './supabaseClient'
import { UserProfile } from '../types'
import { logger } from './logService'
import { AuthenticationManager } from './authStrategies'

export class AuthService {
  private authManager: AuthenticationManager;

  constructor() {
    this.authManager = new AuthenticationManager(supabase, supabaseService);
  }

  async signInWithGoogle(googleUser: any): Promise<UserProfile | null> {
    try {
      logger.info('AuthService: Starting Google sign in process', 'AuthService', { 
        hasEmail: !!googleUser.email,
        hasName: !!googleUser.name,
        hasId: !!googleUser.sub || !!googleUser.id,
        hasAccessToken: !!googleUser.access_token,
        isProduction: this.isProduction()
      });

      // Validate input
      if (!googleUser.email) {
        logger.error('AuthService: No email provided by Google OAuth', 'AuthService', { 
          googleUser: { 
            hasEmail: !!googleUser.email,
            hasName: !!googleUser.name,
            keys: Object.keys(googleUser || {})
          }
        });
        throw new Error('No email provided by Google OAuth');
      }

      // Pre-flight check
      await this.performHealthCheck();

      // Use authentication manager for clean strategy selection
      const result = await this.authManager.authenticate(googleUser);
      
      if (!result) {
        throw new Error('Authentication failed with all available strategies');
      }

      logger.info('AuthService: Authentication completed successfully', 'AuthService', {
        userId: result.id,
        email: result.email,
        hasSupabaseId: !!result.supabaseId,
        strategy: result.supabaseId ? 'Full Integration' : 'Google Only'
      });

      return result;

    } catch (error) {
      logger.error('AuthService: Sign in failed', 'AuthService', {}, error as Error);
      
      // Emergency fallback
      try {
        const emergencyProfile: UserProfile = {
          id: googleUser.sub || googleUser.id || `google_emergency_${Date.now()}`,
          email: googleUser.email,
          name: googleUser.name || googleUser.given_name || googleUser.family_name || 'User',
          imageUrl: googleUser.picture,
          accessToken: googleUser.access_token || googleUser.credential
        };
        
        logger.info('AuthService: Using emergency fallback profile', 'AuthService', { 
          userId: emergencyProfile.id 
        });
        
        return emergencyProfile;
      } catch (fallbackError) {
        logger.error('AuthService: Emergency fallback also failed', 'AuthService', {}, fallbackError as Error);
        return null;
      }
    }
  }

  async signOut(): Promise<boolean> {
    try {
      await supabase.auth.signOut();
      logger.info('User signed out successfully', 'AuthService');
      return true;
    } catch (error) {
      logger.error('Failed to sign out', 'AuthService', {}, error as Error);
      return false;
    }
  }

  async getCurrentSession() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    } catch (error) {
      logger.error('Failed to get current session', 'AuthService', {}, error as Error);
      return null;
    }
  }

  private isProduction(): boolean {
    return window.location.hostname !== 'localhost' && 
           !window.location.hostname.includes('127.0.0.1') &&
           !window.location.hostname.includes('192.168');
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const { error: testError } = await supabase.from('users').select('count').limit(1);
      if (testError) {
        logger.warn('AuthService: Supabase health check failed', 'AuthService', { 
          error: testError.message,
          code: testError.code,
          hint: testError.hint
        });
      } else {
        logger.info('AuthService: Supabase health check passed', 'AuthService');
      }
    } catch (connectionError) {
      logger.warn('AuthService: Supabase connection error during health check', 'AuthService', {}, connectionError as Error);
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

      // Test 2: Basic connectivity
      let canConnect = false;
      try {
        const { error: connectError } = await supabase.from('users').select('count').limit(1);
        canConnect = !connectError;
      } catch (error) {
        logger.error('Basic connectivity test error', 'AuthService', {}, error as Error);
      }

      // Test 3: Can read users table
      let canReadUsers = false;
      let userExists = false;
      let userDetails = null;
      try {
        const userData = await supabaseService.getUserByEmail(email);
        canReadUsers = true;
        userExists = !!userData;
        userDetails = userData ? {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          supabaseId: userData.supabaseId
        } : null;
      } catch (error) {
        logger.error('Users table read test error', 'AuthService', {}, error as Error);
      }

      // Test 4: Can read quizzes table
      let canReadQuizzes = false;
      try {
        const { error: quizError } = await supabase.from('quizzes').select('count').limit(1);
        canReadQuizzes = !quizError;
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

export const authService = new AuthService();
