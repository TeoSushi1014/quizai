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
        logger.warn('No valid JWT token available for Supabase authentication - this will likely fail', 'AuthStrategy', {
          hasCredential: !!googleUser.credential,
          hasIdToken: !!googleUser.id_token,
          hasAccessToken: !!googleUser.access_token,
          hasAccessTokenProp: !!googleUser.accessToken,
          hasIdTokenProp: !!googleUser.idToken
        });
        throw new Error('No valid JWT token available for Supabase authentication');
      }

      logger.info('Attempting Supabase authentication with token', 'AuthStrategy', {
        tokenType: googleUser.id_token ? 'id_token' : googleUser.credential ? 'credential' : 'access_token',
        tokenLength: authToken.length,
        isJWT: this.isValidJWT(authToken)
      });

      // Step 2: Authenticate with Supabase
      const { data: oauthData, error: oauthError } = await this.supabase.auth.signInWithIdToken({
        provider: 'google',
        token: authToken
      });

      if (oauthError) {
        logger.warn('Supabase authentication failed - will try Google-only fallback in AuthManager', 'AuthStrategy', {
          error: oauthError.message,
          errorCode: oauthError.status,
          tokenUsed: authToken.substring(0, 20) + '...',
          tokenLength: authToken.length,
          tokenIsJWT: this.isValidJWT(authToken)
        });
        throw new Error(`Supabase OAuth failed: ${oauthError.message}`);
      }

      if (!oauthData.user) {
        logger.warn('No user returned from Supabase OAuth - will try Google-only fallback', 'AuthStrategy');
        throw new Error('No user returned from Supabase OAuth');
      }

      // Step 3: Handle user profile
      const result = await this.handleUserProfile(googleUser, oauthData.user);
      logger.info('Full Integration Strategy succeeded', 'AuthStrategy', {
        userId: result.id,
        supabaseId: result.supabaseId,
        email: result.email
      });
      return result;

    } catch (error) {
      logger.info('Full Integration Strategy failed - AuthManager will try Google-only fallback', 'AuthStrategy', {
        error: (error as Error).message,
        willFallback: true
      });
      throw error; // Let AuthManager handle the fallback
    }
  }

  private extractBestToken(googleUser: any): string | null {
    // For Supabase signInWithIdToken, we need a proper JWT ID token
    // Priority: credential (if it's a JWT) > idToken > id_token > access_token (last resort)
    
    // First, check if credential is a JWT (this is from GoogleLogin component)
    if (googleUser.credential && this.isValidJWT(googleUser.credential)) {
      logger.info('Using credential (JWT ID token) for Supabase authentication', 'AuthStrategy');
      return googleUser.credential;
    }
    
    // Second, try idToken from our enhanced profile
    if (googleUser.idToken && this.isValidJWT(googleUser.idToken)) {
      logger.info('Using idToken for Supabase authentication', 'AuthStrategy');
      return googleUser.idToken;
    }
    
    // Third, try id_token as it's specifically designed for identity
    if (googleUser.id_token && this.isValidJWT(googleUser.id_token)) {
      logger.info('Using id_token for Supabase authentication', 'AuthStrategy');
      return googleUser.id_token;
    }
    
    // Last resort - access_token (may not work with Supabase)
    if (googleUser.access_token && this.isValidJWT(googleUser.access_token)) {
      logger.warn('Using access_token for Supabase authentication (may fail)', 'AuthStrategy');
      return googleUser.access_token;
    }
    
    // Also check accessToken property
    if (googleUser.accessToken && this.isValidJWT(googleUser.accessToken)) {
      logger.warn('Using accessToken for Supabase authentication (may fail)', 'AuthStrategy');
      return googleUser.accessToken;
    }
    
    logger.error('No valid JWT token found for Supabase authentication', 'AuthStrategy', {
      hasCredential: !!googleUser.credential,
      hasIdToken: !!googleUser.id_token,
      hasAccessToken: !!googleUser.access_token,
      hasAccessTokenProp: !!googleUser.accessToken,
      hasIdTokenProp: !!googleUser.idToken,
      credentialFormat: googleUser.credential ? (this.isValidJWT(googleUser.credential) ? 'JWT' : 'Other') : 'None'
    });
    
    return null;
  }
  
  private isValidJWT(token: string): boolean {
    // JWT tokens should start with 'eyJ' (base64 encoded '{"')
    return typeof token === 'string' && token.startsWith('eyJ') && token.split('.').length === 3;
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
        finalUser.accessToken = googleUser.access_token;
        finalUser.idToken = googleUser.credential || googleUser.idToken;
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
          accessToken: googleUser.access_token,
          idToken: googleUser.credential || googleUser.idToken
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
        accessToken: googleUser.access_token,
        idToken: googleUser.credential || googleUser.idToken
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
      reason: 'Supabase integration unavailable or failed'
    });

    try {
      const profile: UserProfile = {
        id: googleUser.sub || googleUser.id || `google_${Date.now()}`,
        email: googleUser.email,
        name: googleUser.name || googleUser.given_name || googleUser.family_name,
        imageUrl: googleUser.picture,
        accessToken: googleUser.access_token,
        idToken: googleUser.credential || googleUser.idToken
      };

      logger.info('Google-only profile created successfully', 'AuthStrategy', {
        userId: profile.id,
        email: profile.email,
        note: 'Some features like quiz sharing may be limited without Supabase integration'
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
