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
    logger.info('Using Full Integration Strategy', 'AuthStrategy', {
      strategy: this.name,
      email: googleUser.email
    });

    try {
      // Step 1: Get proper token
      const authToken = this.extractBestToken(googleUser);
      if (!authToken) {
        throw new Error('No valid token available');
      }

      // Step 2: Authenticate with Supabase
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

      // Step 3: Handle user profile
      return await this.handleUserProfile(googleUser, oauthData.user);

    } catch (error) {
      logger.error('Full Integration Strategy failed', 'AuthStrategy', {}, error as Error);
      throw error;
    }
  }

  private extractBestToken(googleUser: any): string | null {
    // Priority: credential > id_token > access_token
    return googleUser.credential || googleUser.id_token || googleUser.access_token || null;
  }

  private async handleUserProfile(googleUser: any, supabaseUser: any): Promise<UserProfile> {
    const email = googleUser.email;
    
    try {
      // Try to find existing user
      let existingUser = await this.supabaseService.getUserByEmail(email);
      
      if (existingUser) {
        // Update existing user
        const updatedUser = await this.supabaseService.updateUser(existingUser.id, {
          name: googleUser.name || googleUser.given_name || googleUser.family_name,
          imageUrl: googleUser.picture
        });
        
        const finalUser = updatedUser || existingUser;
        finalUser.accessToken = googleUser.access_token || googleUser.credential;
        finalUser.supabaseId = supabaseUser.id;
        
        logger.info('Existing user updated successfully', 'AuthStrategy', {
          userId: finalUser.id,
          supabaseId: finalUser.supabaseId
        });
        
        return finalUser;
      } else {
        // Create new user
        const newUserProfile: UserProfile = {
          id: supabaseUser.id,
          supabaseId: supabaseUser.id,
          email: email,
          name: googleUser.name || googleUser.given_name || googleUser.family_name,
          imageUrl: googleUser.picture,
          accessToken: googleUser.access_token || googleUser.credential
        };

        const createdUser = await this.supabaseService.createUser(newUserProfile);
        
        if (createdUser) {
          logger.info('New user created successfully', 'AuthStrategy', {
            userId: createdUser.id,
            supabaseId: createdUser.supabaseId
          });
          return createdUser;
        } else {
          // Fallback to basic profile if DB creation fails
          logger.warn('Database user creation failed, using basic profile', 'AuthStrategy');
          return newUserProfile;
        }
      }
    } catch (profileError) {
      logger.error('Profile handling failed', 'AuthStrategy', {}, profileError as Error);
      
      // Return basic profile with Supabase session
      return {
        id: supabaseUser.id,
        supabaseId: supabaseUser.id,
        email: googleUser.email,
        name: googleUser.name || googleUser.given_name || googleUser.family_name,
        imageUrl: googleUser.picture,
        accessToken: googleUser.access_token || googleUser.credential
      };
    }
  }
}

// Google-Only Strategy (Fallback)
export class GoogleOnlyStrategy implements AuthStrategy {
  name = 'GoogleOnly';

  canHandle(env: AuthEnvironment): boolean {
    return env.googleConfigured; // Can always handle if Google is available
  }

  async authenticate(googleUser: any): Promise<UserProfile | null> {
    logger.info('Using Google-Only Strategy', 'AuthStrategy', {
      strategy: this.name,
      email: googleUser.email,
      reason: 'Supabase integration unavailable'
    });

    try {
      const profile: UserProfile = {
        id: googleUser.sub || googleUser.id || `google_${Date.now()}`,
        email: googleUser.email,
        name: googleUser.name || googleUser.given_name || googleUser.family_name,
        imageUrl: googleUser.picture,
        accessToken: googleUser.access_token || googleUser.credential
      };

      logger.info('Google-only profile created', 'AuthStrategy', {
        userId: profile.id,
        email: profile.email
      });

      return profile;
    } catch (error) {
      logger.error('Google-Only Strategy failed', 'AuthStrategy', {}, error as Error);
      return null;
    }
  }
}

// Authentication Manager
export class AuthenticationManager {
  private strategies: AuthStrategy[] = [];
  
  constructor(supabase: any, supabaseService: any) {
    // Register strategies in priority order
    this.strategies = [
      new FullIntegrationStrategy(supabase, supabaseService),
      new GoogleOnlyStrategy()
    ];
  }

  async authenticate(googleUser: any): Promise<UserProfile | null> {
    const environment = AuthEnvironmentChecker.check();
    
    logger.info('Starting authentication process', 'AuthManager', {
      environment,
      availableStrategies: this.strategies.map(s => s.name)
    });

    // Try strategies in order
    for (const strategy of this.strategies) {
      if (strategy.canHandle(environment)) {
        try {
          logger.info(`Attempting authentication with ${strategy.name}`, 'AuthManager');
          const result = await strategy.authenticate(googleUser);
          
          if (result) {
            logger.info(`Authentication successful with ${strategy.name}`, 'AuthManager', {
              userId: result.id,
              email: result.email,
              hasSupabaseId: !!result.supabaseId
            });
            return result;
          }
        } catch (error) {
          logger.warn(`${strategy.name} failed, trying next strategy`, 'AuthManager', {
            error: (error as Error).message
          });
          continue;
        }
      } else {
        logger.info(`${strategy.name} cannot handle current environment`, 'AuthManager');
      }
    }

    logger.error('All authentication strategies failed', 'AuthManager');
    return null;
  }
}
