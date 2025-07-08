import { UserProfile } from '../types';
import { logger } from './logService';

export interface AuthStrategy {
  name: string;
  canHandle(environment: AuthEnvironment): boolean;
  authenticate(googleUser: any): Promise<UserProfile | null>;
}

export interface AuthEnvironment {
  isProduction: boolean;
  hostname: string;
  supabaseConfigured: boolean;
  googleConfigured: boolean;
}

export class AuthEnvironmentChecker {
  static check(): AuthEnvironment {
    const hostname = window.location.hostname;
    const isProduction = hostname !== 'localhost' && 
                        !hostname.includes('127.0.0.1') &&
                        !hostname.includes('192.168');
    
    return {
      isProduction,
      hostname,
      supabaseConfigured: !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY),
      googleConfigured: !!(window as any).google
    };
  }
}

// Full Integration Strategy (Primary)
export class FullIntegrationStrategy implements AuthStrategy {
  name = 'FullIntegration';
  
  constructor(
    private supabase: any,
    private supabaseService: any
  ) {}

  canHandle(env: AuthEnvironment): boolean {
    return env.supabaseConfigured && env.googleConfigured;
  }

  async authenticate(googleUser: any): Promise<UserProfile | null> {
    try {
      const authToken = this.extractBestToken(googleUser);
      if (!authToken) {
        throw new Error('No valid JWT token available for Supabase authentication');
      }

      const { data: oauthData, error: oauthError } = await this.supabase.auth.signInWithIdToken({
        provider: 'google',
        token: authToken
      });

      if (oauthError) {
        throw new Error(`Supabase OAuth failed: ${oauthError.message}`);
      }

      if (!oauthData.user) {
        throw new Error('No user returned from Supabase OAuth');
      }

      const result = await this.handleUserProfile(googleUser, oauthData.user);
      return result;

    } catch (error) {
      throw error;
    }
  }

  private extractBestToken(googleUser: any): string | null {
    if (googleUser.credential && this.isValidJWT(googleUser.credential)) {
      return googleUser.credential;
    }
    
    if (googleUser.idToken && this.isValidJWT(googleUser.idToken)) {
      return googleUser.idToken;
    }
    
    if (googleUser.id_token && this.isValidJWT(googleUser.id_token)) {
      return googleUser.id_token;
    }
    
    if (googleUser.access_token && this.isValidJWT(googleUser.access_token)) {
      return googleUser.access_token;
    }
    
    if (googleUser.accessToken && this.isValidJWT(googleUser.accessToken)) {
      return googleUser.accessToken;
    }
    
    return null;
  }
  
  private isValidJWT(token: string): boolean {
    return typeof token === 'string' && token.startsWith('eyJ') && token.split('.').length === 3;
  }

  private async handleUserProfile(googleUser: any, supabaseUser: any): Promise<UserProfile> {
    const email = googleUser.email;
    
    try {
      let existingUser = await this.supabaseService.getUserByEmail(email);
      
      if (existingUser) {
        const updatedUser = await this.supabaseService.updateUser(existingUser.id, {
          name: googleUser.name || googleUser.given_name || googleUser.family_name,
          imageUrl: googleUser.picture
        });
        
        const finalUser = updatedUser || existingUser;
        finalUser.accessToken = googleUser.access_token;
        finalUser.idToken = googleUser.credential || googleUser.idToken;
        finalUser.supabaseId = supabaseUser.id;
        
        return finalUser;
      } else {
        const newUserProfile: UserProfile = {
          id: supabaseUser.id,
          supabaseId: supabaseUser.id,
          email: email,
          name: googleUser.name || googleUser.given_name || googleUser.family_name,
          imageUrl: googleUser.picture,
          accessToken: googleUser.access_token,
          idToken: googleUser.credential || googleUser.idToken
        };

        const createdUser = await this.supabaseService.createUser(newUserProfile);
        if (!createdUser) {
          logger.error('Failed to create new user profile', 'AuthStrategy', { email });
          throw new Error('Failed to create new user profile');
        }
        
        return createdUser;
      }
    } catch (error) {
      logger.error('Failed to handle user profile', 'AuthStrategy', { email }, error as Error);
      throw error;
    }
  }
}

// Google-Only Strategy (Fallback)
export class GoogleOnlyStrategy implements AuthStrategy {
  name = 'GoogleOnly';
  
  canHandle(env: AuthEnvironment): boolean {
    return env.googleConfigured;
  }

  async authenticate(googleUser: any): Promise<UserProfile | null> {
    try {
      if (!googleUser.email) {
        logger.error('No email provided by Google OAuth', 'AuthStrategy');
        throw new Error('No email provided by Google OAuth');
      }

      const userProfile: UserProfile = {
        id: googleUser.sub || googleUser.id,
        email: googleUser.email,
        name: googleUser.name || googleUser.given_name || googleUser.family_name,
        imageUrl: googleUser.picture,
        accessToken: googleUser.access_token,
        idToken: googleUser.credential || googleUser.idToken
      };

      return userProfile;
    } catch (error) {
      logger.error('Google-only authentication failed', 'AuthStrategy', {}, error as Error);
      return null;
    }
  }
}

// Authentication Manager
export class AuthenticationManager {
  private strategies: AuthStrategy[] = [];

  constructor(supabase: any, supabaseService: any) {
    this.strategies = [
      new FullIntegrationStrategy(supabase, supabaseService),
      new GoogleOnlyStrategy()
    ];
  }

  async authenticate(googleUser: any): Promise<UserProfile | null> {
    const env = AuthEnvironmentChecker.check();
    
    for (const strategy of this.strategies) {
      if (strategy.canHandle(env)) {
        try {
          const result = await strategy.authenticate(googleUser);
          if (result) {
            return result;
          }
        } catch (error) {
          logger.warn(`Strategy ${strategy.name} failed, trying next strategy`, 'AuthManager', {
            error: (error as Error).message
          });
          continue;
        }
      }
    }

    logger.error('All authentication strategies failed', 'AuthManager');
    return null;
  }
}
