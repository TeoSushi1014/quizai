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
      logger.info('Starting Google sign in process', 'AuthService', { 
        hasEmail: !!googleUser.email,
        hasName: !!googleUser.name,
        hasId: !!googleUser.sub || !!googleUser.id,
        hasAccessToken: !!googleUser.access_token,
        isProduction: this.isProduction()
      });

      if (!googleUser.email) {
        logger.error('No email provided by Google OAuth', 'AuthService');
        throw new Error('No email provided by Google OAuth');
      }

      await this.performHealthCheck();

      const result = await this.authManager.authenticate(googleUser);
      
      if (!result) {
        throw new Error('Authentication failed. Please try again or contact support.');
      }

      if (!result.supabaseId) {
        logger.error('Authentication failed - Supabase integration required', 'AuthService', {
          userId: result.id,
          email: result.email
        });
        throw new Error('Full authentication required. Please try again or contact support.');
      }

      logger.info('Authentication completed successfully', 'AuthService', {
        userId: result.id,
        email: result.email,
        supabaseId: result.supabaseId
      });

      return result;

    } catch (error) {
      logger.error('Sign in failed', 'AuthService', {}, error as Error);
      return null;
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
        logger.warn('Supabase health check failed', 'AuthService', { 
          error: testError.message,
          code: testError.code,
          hint: testError.hint
        });
      }
    } catch (connectionError) {
      logger.warn('Supabase connection error during health check', 'AuthService', {}, connectionError as Error);
    }
  }

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

      const { data: { session } } = await supabase.auth.getSession();
      const hasSession = !!session?.user;
      
      const sessionDetails = session ? {
        userId: session.user?.id,
        email: session.user?.email,
        provider: session.user?.app_metadata?.provider,
        lastSignIn: session.user?.last_sign_in_at
      } : null;

      let canConnect = false;
      try {
        const { error: connectError } = await supabase.from('users').select('count').limit(1);
        canConnect = !connectError;
      } catch (error) {
        logger.error('Basic connectivity test error', 'AuthService', {}, error as Error);
      }

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
