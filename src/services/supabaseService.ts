import { supabase } from './supabaseClient'
import { Quiz, UserProfile, QuizResult } from '../types'
import { logger } from './logService'

export class SupabaseService {
  // Helper method to ensure we have a valid session before database operations
  private async ensureAuthenticated(): Promise<{ session: any; userId: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      throw new Error('Authentication required: No active Supabase session');
    }
    
    return { session, userId: session.user.id };
  }

  // Helper method to handle common RLS and authentication errors
  private handleDatabaseError(error: any, operation: string, context: any = {}): void {
    if (error.code === '42501') {
      logger.error(`RLS policy violation during ${operation}`, 'SupabaseService', { 
        ...context,
        error: error.message,
        hint: 'Check if user is authenticated and RLS policies allow this operation'
      });
    } else if (error.code === 'PGRST301' || error.code === '406') {
      logger.error(`Request not acceptable (406) during ${operation}`, 'SupabaseService', { 
        ...context,
        error: error.message,
        code: error.code,
        details: error.details,
        hint: 'This may indicate RLS policy issues, malformed query, or missing headers'
      });
    } else if (error.code === '23505') {
      logger.error(`Duplicate key constraint violation during ${operation}`, 'SupabaseService', { 
        ...context,
        error: error.message,
        hint: 'A record with this key already exists'
      });
    } else if (error.code === '23503') {
      logger.error(`Foreign key constraint violation during ${operation}`, 'SupabaseService', { 
        ...context,
        error: error.message,
        hint: 'Referenced record does not exist'
      });
    } else {
      logger.error(`Database error during ${operation}`, 'SupabaseService', { 
        ...context,
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
    }
  }

  async createUser(profile: Partial<UserProfile>): Promise<UserProfile | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        logger.error('No authenticated session found for user creation', 'SupabaseService', { 
          requestedUserId: profile.id,
          email: profile.email 
        });
        throw new Error('Authentication required: No active Supabase session for user creation');
      }

      const authenticatedUserId = session.user.id;
      
      const userInsertData = {
        id: authenticatedUserId,
        email: profile.email!,
        name: profile.name,
        bio: profile.bio,
        image_url: profile.imageUrl,
        quiz_count: profile.quizCount || 0,
        completion_count: profile.completionCount || 0,
        average_score: profile.averageScore
      }

      const { data, error } = await supabase
        .from('users')
        .insert([userInsertData])
        .select()
        .single()

      if (error) {
        logger.error('Insert error details', 'SupabaseService', { 
          error: error,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        })
        
        if (error.code === '42501') {
          logger.warn('RLS policy violation, attempting to find existing user by email', 'SupabaseService', { email: profile.email });
          
          try {
            const { data: existingData, error: lookupError } = await supabase
              .from('users')
              .select('*')
              .eq('email', profile.email!)
              .single()
            
            if (!lookupError && existingData) {
              return this.mapDatabaseUserToProfile(existingData);
            }
          } catch (lookupError) {
            logger.warn('Could not lookup existing user after RLS violation', 'SupabaseService', {}, lookupError as Error);
          }
        }
        
        if (error.code === '23505' && error.message.includes('users_email_key')) {
          const existingUser = await this.getUserByEmail(profile.email!)
          if (existingUser) {
            return existingUser
          }
        }
        
        throw error
      }
      
      return this.mapDatabaseUserToProfile(data)
    } catch (error) {
      logger.error('Failed to create user - full error', 'SupabaseService', { 
        profile, 
        errorName: (error as Error).name,
        errorMessage: (error as Error).message,
        errorStack: (error as Error).stack
      }, error as Error)
      return null
    }
  }

  async getUserById(id: string): Promise<UserProfile | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        logger.warn('No authenticated session for getUserById, this may fail due to RLS', 'SupabaseService', { id });
      }

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null
        }
        
        this.handleDatabaseError(error, 'getUserById', { id });
        throw error
      }
      
      return this.mapDatabaseUserToProfile(data)
    } catch (error) {
      logger.error('Failed to get user', 'SupabaseService', { id }, error as Error)
      return null
    }
  }

  async getUserByEmail(email: string): Promise<UserProfile | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        logger.warn('No authenticated session for getUserByEmail, this may fail due to RLS', 'SupabaseService', { email });
      }

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle()

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        
        this.handleDatabaseError(error, 'getUserByEmail', { email });
        throw error
      }
      
      return data ? this.mapDatabaseUserToProfile(data) : null
    } catch (error) {
      logger.error('Failed to get user by email', 'SupabaseService', { email }, error as Error)
      return null
    }
  }

  async updateUser(id: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    try {
      logger.info('Starting user update', 'SupabaseService', { userId: id, updates });

      const updateData: any = {}
      if (updates.name !== undefined) updateData.name = updates.name
      if (updates.bio !== undefined) updateData.bio = updates.bio
      if (updates.imageUrl !== undefined) updateData.image_url = updates.imageUrl
      if (updates.quizCount !== undefined) updateData.quiz_count = updates.quizCount
      if (updates.completionCount !== undefined) updateData.completion_count = updates.completionCount
      if (updates.averageScore !== undefined) updateData.average_score = updates.averageScore

      // Check if user exists first
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id, email')
        .eq('id', id)
        .maybeSingle();

      if (checkError) {
        logger.error('Error checking existing user', 'SupabaseService', { 
          userId: id, 
          error: checkError.message,
          code: checkError.code 
        });
        return null;
      }

      if (!existingUser) {
        // If user doesn't exist, try to create it with available data
        const userProfile: Partial<UserProfile> = {
          id: id,
          ...updates
        };
        
        // Get additional user data from auth if available
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser && authUser.id === id) {
            userProfile.email = authUser.email;
          }
        } catch (authError) {
          logger.error('Could not get auth user data', 'SupabaseService', { userId: id });
        }
        
        if (!userProfile.email) {
          logger.error('Cannot create user without email', 'SupabaseService', { userId: id });
          return null;
        }
        
        return await this.createUser(userProfile);
      }

      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        logger.error('Supabase user update failed', 'SupabaseService', { 
          userId: id,
          updateData,
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }
      return this.mapDatabaseUserToProfile(data)
    } catch (error) {
      logger.error('Failed to update user', 'SupabaseService', { id, updates }, error as Error)
      return null
    }
  }

  async getUserQuizzes(userId: string): Promise<Quiz[]> {
    try {
      // Use the ensureAuthenticated helper to verify session
      const { session } = await this.ensureAuthenticated();
      
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('user_id', session.user.id) // Use authenticated user's ID to comply with RLS
        .order('created_at', { ascending: false })

      if (error) {
        this.handleDatabaseError(error, 'getUserQuizzes', { userId, sessionUserId: session?.user?.id || 'no-session' });
        throw error;
      }
      
      return data.map(this.mapDatabaseQuizToQuiz)
    } catch (error) {
      logger.error('Failed to get user quizzes', 'SupabaseService', { userId }, error as Error)
      return []
    }
  }

  async getQuizById(quizId: string): Promise<Quiz | null> {
    try {
      // Use the ensureAuthenticated helper to verify session
      const { session } = await this.ensureAuthenticated();
      
      logger.info('SupabaseService: Getting quiz by ID with authenticated session', 'SupabaseService', { 
        sessionUserId: session.user.id,
        quizId 
      });

      // First try to get from user's own quizzes (direct access with RLS)
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .eq('user_id', session.user.id) // Only get if user owns it
        .maybeSingle()

      if (!error && data) {
        logger.info('Quiz found as user owned quiz', 'SupabaseService', { quizId });
        return this.mapDatabaseQuizToQuiz(data);
      }

      // If not found in user's quizzes, try to get as public shared quiz
      logger.info('Quiz not found in user quizzes, trying public shared quiz', 'SupabaseService', { quizId });
      const publicQuiz = await this.getPublicQuizById(quizId);
      
      if (publicQuiz) {
        logger.info('Quiz found as public shared quiz', 'SupabaseService', { quizId });
        return publicQuiz;
      }
      
      // If still not found, log the original error from user query for debugging
      if (error) {
        this.handleDatabaseError(error, 'getQuizById', { quizId, sessionUserId: session?.user?.id || 'no-session' });
      }
      
      logger.info('Quiz not found', 'SupabaseService', { quizId });
      return null;
    } catch (error) {
      logger.error('Failed to get quiz by ID', 'SupabaseService', { quizId }, error as Error)
      return null;
    }
  }

  // Generate a unique quiz ID that doesn't exist in the database
  async generateUniqueQuizId(): Promise<string> {
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      // Import the generateQuizId function dynamically to avoid circular dependencies
      const { generateQuizId } = await import('../utils/uuidUtils');
      const newId = generateQuizId();
      
      try {
        // Check if this ID already exists in the database
        const { data, error } = await supabase
          .from('quizzes')
          .select('id')
          .eq('id', newId)
          .maybeSingle();
        
        if (error && error.code !== 'PGRST116') {
          logger.warn('Error checking quiz ID uniqueness', 'SupabaseService', { 
            newId, 
            attempt: attempts + 1,
            error: error.message 
          });
          // If there's an error checking, just use the generated ID
          return newId;
        }
        
        if (!data) {
          // ID doesn't exist, it's unique
          logger.info('Generated unique quiz ID', 'SupabaseService', { newId, attempts: attempts + 1 });
          return newId;
        }
        
        // ID exists, try again
        logger.info('Quiz ID collision detected, generating new ID', 'SupabaseService', { 
          existingId: newId, 
          attempt: attempts + 1 
        });
        attempts++;
        
      } catch (error) {
        logger.error('Error checking quiz ID uniqueness', 'SupabaseService', { newId, attempt: attempts + 1 }, error as Error);
        // If there's an error, just return the generated ID
        return newId;
      }
    }
    
    const { generateQuizId } = await import('../utils/uuidUtils');
    const fallbackId = generateQuizId();
    logger.warn('Could not verify quiz ID uniqueness after max attempts, using fallback', 'SupabaseService', { 
      fallbackId, 
      maxAttempts 
    });
    return fallbackId;
  }

  async createQuiz(quiz: Quiz, userId: string): Promise<Quiz | null> {
    try {
      logger.info('Starting quiz creation in Supabase', 'SupabaseService', { 
        quizId: quiz.id, 
        userId, 
        title: quiz.title,
        questionCount: quiz.questions?.length 
      });

      // Use the ensureAuthenticated helper to verify session
      const { session } = await this.ensureAuthenticated();
      
      logger.info('Authenticated session confirmed for quiz creation', 'SupabaseService', { 
        sessionUserId: session.user.id,
        requestedUserId: userId 
      });

      const quizForDb = {
        id: quiz.id,
        user_id: session.user.id, // Use the authenticated user's ID from session
        title: quiz.title,
        questions: quiz.questions,
        source_content: quiz.sourceContentSnippet || null,
        source_file_name: null,
        config: quiz.config || {}
      }

      logger.info('Quiz data prepared for database', 'SupabaseService', { 
        quizForDb: {
          ...quizForDb,
          questions: `${quiz.questions?.length} questions`
        }
      });

      const { data, error } = await supabase
        .from('quizzes')
        .insert([quizForDb])
        .select()
        .single()

      if (error) {
        logger.error('Supabase quiz creation failed', 'SupabaseService', { 
          quizId: quiz.id,
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          sessionUserId: session.user.id
        });
        
        // Handle duplicate key constraint violation
        if (error.code === '23505' && error.message.includes('quizzes_pkey')) {
          logger.info('SupabaseService: Quiz with this ID already exists, attempting to fetch existing quiz', 'SupabaseService', { quizId: quiz.id })
          
          // Try to fetch the existing quiz
          const { data: existingQuiz, error: fetchError } = await supabase
            .from('quizzes')
            .select('*')
            .eq('id', quiz.id)
            .single()
          
          if (fetchError) {
            logger.error('SupabaseService: Failed to fetch existing quiz after duplicate key error', 'SupabaseService', { 
              quizId: quiz.id,
              fetchError: fetchError.message 
            });
            throw error; // Throw original error if we can't fetch existing quiz
          }
          
          logger.info('SupabaseService: Found existing quiz with same ID', 'SupabaseService', { 
            quizId: existingQuiz.id,
            existingTitle: existingQuiz.title,
            newTitle: quiz.title
          });
          
          // Return the existing quiz mapped to our format
          return this.mapDatabaseQuizToQuiz(existingQuiz);
        }
        
        // Handle RLS policy violations with more specific error
        if (error.code === '42501') {
          logger.error('RLS policy violation during quiz creation', 'SupabaseService', { 
            quizId: quiz.id,
            sessionUserId: session?.user?.id || 'no-session',
            requestedUserId: userId,
            error: error.message,
            hint: 'Check if user owns this quiz and RLS policies allow creation'
          });
          throw new Error(`Permission denied: Unable to create quiz. RLS policy violation: ${error.message}`);
        }
        
        throw error;
      }
      
      logger.info('Quiz created in Supabase successfully', 'SupabaseService', { 
        quizId: data.id,
        createdAt: data.created_at 
      });
      return this.mapDatabaseQuizToQuiz(data)
    } catch (error) {
      logger.error('Failed to create quiz - full error details', 'SupabaseService', { 
        quizId: quiz.id,
        userId,
        errorName: (error as Error).name,
        errorMessage: (error as Error).message
      }, error as Error)
      return null
    }
  }

  async updateQuiz(quiz: Quiz): Promise<Quiz | null> {
    try {
      const updates = {
        title: quiz.title,
        questions: quiz.questions,
        source_content: quiz.sourceContentSnippet || null,
        source_file_name: null,
        config: quiz.config || {},
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('quizzes')
        .update(updates)
        .eq('id', quiz.id)
        .select()
        .single()

      if (error) throw error
      
      logger.info('Quiz updated in Supabase', 'SupabaseService', { quizId: quiz.id })
      return this.mapDatabaseQuizToQuiz(data)
    } catch (error) {
      logger.error('Failed to update quiz', 'SupabaseService', { quizId: quiz.id }, error as Error)
      return null
    }
  }

  async deleteQuiz(quizId: string): Promise<boolean> {
    try {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(quizId)) {
        logger.error('Attempted to delete quiz with invalid UUID format', 'SupabaseService', { quizId });
        throw new Error(`Invalid UUID format: ${quizId}`);
      }

      const { error } = await supabase
        .from('quizzes')
        .delete()
        .eq('id', quizId)

      if (error) throw error
      
      logger.info('Quiz deleted from Supabase', 'SupabaseService', { quizId })
      return true
    } catch (error) {
      logger.error('Failed to delete quiz', 'SupabaseService', { quizId }, error as Error)
      return false
    }
  }

  async saveQuizResult(result: QuizResult, userId: string, userProfile?: UserProfile): Promise<boolean> {
    try {
      // Check if user is properly authenticated with Supabase
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        logger.info('User not authenticated with Supabase, skipping result save', 'SupabaseService', { 
          userId, 
          quizId: result.quizId,
          hasUserProfile: !!userProfile
        });
        return false; // Not an error, just not authenticated
      }

      // Use the authenticated Supabase user ID, not the Google ID
      const supabaseUserId = session.user.id;
      
      const resultForDb = {
        user_id: supabaseUserId,
        quiz_id: result.quizId,
        score: result.score,
        total_questions: result.totalQuestions,
        answers: result.answers,
        time_taken: typeof result.timeTaken === 'number' ? Math.round(result.timeTaken) : null
      }

      const { error } = await supabase
        .from('quiz_results')
        .insert([resultForDb])

      if (error) {
        logger.error('Database error saving quiz result', 'SupabaseService', { 
          quizId: result.quizId, 
          supabaseUserId,
          error: error.message,
          code: error.code
        });
        return false; // Return false instead of throwing
      }
      
      logger.info('Quiz result saved to Supabase successfully', 'SupabaseService', { 
        quizId: result.quizId, 
        supabaseUserId,
        score: result.score,
        totalQuestions: result.totalQuestions
      })
      return true
    } catch (error) {
      logger.error('Failed to save quiz result', 'SupabaseService', { 
        quizId: result.quizId, 
        userId,
        error: (error as Error).message 
      }, error as Error)
      return false
    }
  }

  async getUserQuizResults(userId: string): Promise<QuizResult[]> {
    try {
      // Check if user is properly authenticated with Supabase
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        logger.info('User not authenticated with Supabase, returning empty results', 'SupabaseService', { userId });
        return [];
      }

      // Use the authenticated Supabase user ID, not the Google ID
      const supabaseUserId = session.user.id;
      
      const { data, error } = await supabase
        .from('quiz_results')
        .select('*')
        .eq('user_id', supabaseUserId)
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Error fetching quiz results from database', 'SupabaseService', { 
          userId: supabaseUserId,
          error: error.message,
          code: error.code 
        });
        return []; // Return empty array instead of throwing
      }
      
      return data.map(this.mapDatabaseResultToQuizResult)
    } catch (error) {
      logger.error('Failed to get user quiz results', 'SupabaseService', { userId }, error as Error)
      return []
    }
  }

  private mapDatabaseUserToProfile(dbUser: any): UserProfile {
    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      bio: dbUser.bio,
      imageUrl: dbUser.image_url,
      quizCount: dbUser.quiz_count || 0,
      completionCount: dbUser.completion_count || 0,
      averageScore: dbUser.average_score || null,
      accessToken: '',
    }
  }

  // Diagnostic function to check database state and permissions
  async diagnoseDatabaseState(shareId: string): Promise<any> {
    try {
      // Check 1: Basic connection
      const { error: connectionError } = await supabase
        .from('shared_quizzes')
        .select('count')
        .limit(0);

      // Check 2: Auth state
      const { data: { session } } = await supabase.auth.getSession();

      // Check 3: shared_quizzes table access
      const { data: sharedQuizzesData, error: sharedQuizzesError } = await supabase
        .from('shared_quizzes')
        .select('id, quiz_id, is_public')
        .limit(5);

      // Check 4: quizzes table access
      const { data: quizzesData, error: quizzesError } = await supabase
        .from('quizzes')
        .select('id, title')
        .limit(5);

      // Check 5: JOIN query test
      const { data: joinData, error: joinError } = await supabase
        .from('shared_quizzes')
        .select(`
          id, quiz_id, is_public,
          quizzes!inner(id, title)
        `)
        .eq('is_public', true)
        .limit(2);
      
      logger.info('JOIN query test', 'SupabaseService', { 
        hasError: !!joinError,
        error: joinError?.message,
        code: joinError?.code,
        dataCount: joinData?.length || 0
      });

      return {
        connectionTest: { hasError: !!connectionError, error: connectionError },
        authState: { hasSession: !!session, userId: session?.user?.id },
        sharedQuizzesAccess: { hasError: !!sharedQuizzesError, error: sharedQuizzesError, count: sharedQuizzesData?.length || 0 },
        quizzesAccess: { hasError: !!quizzesError, error: quizzesError, count: quizzesData?.length || 0 },
        joinQuery: { hasError: !!joinError, error: joinError, count: joinData?.length || 0 }
      };
      
    } catch (error) {
      logger.error('Database diagnostic failed', 'SupabaseService', { shareId }, error as Error);
      return { diagnosticError: error };
    }
  }

  async getPublicQuizById(shareId: string): Promise<Quiz | null> {
    try {
      logger.info('Attempting to fetch public quiz by share identifier from Supabase', 'SupabaseService', { 
        shareId,
        shareIdLength: shareId.length,
        isQuizUrlFromBrowser: window?.location?.href || 'unknown'
      });

      // Run diagnostic first (but don't let it block the main flow)
      try {
        const diagnostic = await this.diagnoseDatabaseState(shareId);
        logger.info('Database diagnostic completed', 'SupabaseService', { diagnostic });
      } catch (diagError) {
        logger.warn('Database diagnostic failed, continuing with main flow', 'SupabaseService', {}, diagError as Error);
      }

      // Import the UUID validation function
      const { isValidUUID } = await import('../utils/uuidUtils');
      
      // Simplified approach: Try basic queries without complex JOINs first
      let sharedData = null;
      let quizData = null;
      
      // Step 1: Find the shared quiz entry (this should work for anonymous users if RLS is configured correctly)
      if (isValidUUID(shareId)) {
        // Try by quiz_id first
        logger.info('Searching for shared quiz by quiz_id', 'SupabaseService', { shareId });
        const { data: sharedByQuizId, error: sharedByQuizIdError } = await supabase
          .from('shared_quizzes')
          .select('id, quiz_id, share_token, is_public, expires_at, created_at')
          .eq('quiz_id', shareId)
          .eq('is_public', true)
          .maybeSingle();

        if (!sharedByQuizIdError && sharedByQuizId) {
          sharedData = sharedByQuizId;
          logger.info('Found shared quiz by quiz_id', 'SupabaseService', { 
            shareId, 
            foundQuizId: sharedData.quiz_id 
          });
        } else if (sharedByQuizIdError) {
          logger.warn('Error searching by quiz_id', 'SupabaseService', { 
            shareId, 
            error: sharedByQuizIdError.message,
            code: sharedByQuizIdError.code 
          });
        }
      }
      
      // Step 2: If not found by quiz_id, try by share_token
      if (!sharedData) {
        logger.info('Searching for shared quiz by share_token', 'SupabaseService', { shareId });
        const { data: sharedByToken, error: sharedByTokenError } = await supabase
          .from('shared_quizzes')
          .select('id, quiz_id, share_token, is_public, expires_at, created_at')
          .eq('share_token', shareId)
          .eq('is_public', true)
          .maybeSingle();

        if (!sharedByTokenError && sharedByToken) {
          sharedData = sharedByToken;
          logger.info('Found shared quiz by share_token', 'SupabaseService', { 
            shareId, 
            foundQuizId: sharedData.quiz_id 
          });
        } else if (sharedByTokenError) {
          logger.warn('Error searching by share_token', 'SupabaseService', { 
            shareId, 
            error: sharedByTokenError.message,
            code: sharedByTokenError.code 
          });
        }
      }

      // Step 3: If we found shared data, get the quiz data separately
      if (sharedData) {
        // Check if the shared quiz has expired
        if (sharedData.expires_at && new Date(sharedData.expires_at) < new Date()) {
          logger.info('Shared quiz has expired', 'SupabaseService', { 
            quizId: sharedData.quiz_id, 
            expiresAt: sharedData.expires_at 
          });
          return null;
        }

        logger.info('Fetching quiz data for shared quiz', 'SupabaseService', { 
          shareId, 
          quizId: sharedData.quiz_id 
        });
        
        const { data: quiz, error: quizError } = await supabase
          .from('quizzes')
          .select('id, title, questions, source_content, source_file_name, config, user_id, created_at, updated_at')
          .eq('id', sharedData.quiz_id)
          .maybeSingle();

        if (quizError) {
          logger.error('Error fetching quiz data', 'SupabaseService', { 
            shareId, 
            quizId: sharedData.quiz_id,
            error: quizError.message,
            code: quizError.code 
          });
          return null;
        }

        if (!quiz) {
          logger.warn('Quiz data not found', 'SupabaseService', { 
            shareId, 
            quizId: sharedData.quiz_id 
          });
          return null;
        }

        quizData = quiz;
        
        // Step 4: Try to get creator information (optional, don't fail if this doesn't work)
        let creatorInfo = { name: 'Unknown', email: undefined };
        if (quiz.user_id) {
          try {
            const { data: user, error: userError } = await supabase
              .from('users')
              .select('name, email')
              .eq('id', quiz.user_id)
              .maybeSingle();
            
            if (!userError && user) {
              creatorInfo = {
                name: user.name || 'Unknown',
                email: user.email
              };
            }
          } catch (userFetchError) {
            logger.info('Could not fetch creator info (non-critical)', 'SupabaseService', { 
              userId: quiz.user_id 
            });
          }
        }

        // Step 5: Map and return the quiz
        const mappedQuiz = this.mapDatabaseQuizToQuiz(quizData);
        logger.info('Successfully fetched quiz from Supabase', 'SupabaseService', { 
          quizId: sharedData.quiz_id,
          quizTitle: mappedQuiz.title
        });
        
        return {
          ...mappedQuiz,
          creator: creatorInfo,
          isShared: true,
          sharedTimestamp: quizData.created_at
        };
      }

      // If no shared quiz found, log and return null
      logger.warn('No shared quiz found for identifier', 'SupabaseService', { shareId });
      return null;
      
    } catch (error) {
      logger.error('Unexpected error in getPublicQuizById', 'SupabaseService', { shareId }, error as Error);
      return null; // This will trigger localStorage fallback
    }
  }

  // Diagnostic function to check database state for a specific quiz ID
  async diagnoseQuizSharingIssue(quizId: string): Promise<any> {
    try {
      logger.info('Starting quiz sharing diagnosis', 'SupabaseService', { quizId });
      
      // Check if quiz exists in quizzes table
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select('id, title, user_id, created_at')
        .eq('id', quizId)
        .limit(1);
      
      // Check if quiz exists in shared_quizzes table
      const { data: sharedData, error: sharedError } = await supabase
        .from('shared_quizzes')
        .select('id, quiz_id, share_token, is_public, expires_at, created_at')
        .eq('quiz_id', quizId)
        .limit(5); // Get up to 5 entries
      
      // Try the JOIN query
      const { data: joinData, error: joinError } = await supabase
        .from('shared_quizzes')
        .select(`
          id, quiz_id, share_token, is_public, expires_at, created_at,
          quizzes!inner(id, title, user_id, created_at)
        `)
        .eq('quiz_id', quizId)
        .eq('is_public', true)
        .limit(1);
      
      return {
        quizExists: !!quizData && quizData.length > 0,
        sharedQuizExists: !!sharedData && sharedData.length > 0,
        joinQueryWorks: !!joinData && joinData.length > 0,
        quizData,
        sharedData,
        joinData,
        errors: {
          quiz: quizError?.message,
          shared: sharedError?.message,
          join: joinError?.message
        }
      };
      
    } catch (error) {
      logger.error('Diagnostic function failed', 'SupabaseService', { quizId }, error as Error);
      return { error: (error as Error).message };
    }
  }

  async checkUserSharePermissions(userId: string): Promise<{ canShare: boolean; reason?: string }> {
    try {
      // Get the current authenticated user
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !currentUser) {
        return { canShare: false, reason: `No authenticated user: ${userError?.message || 'User not logged in'}` };
      }
      
      // First check if the user can read from shared_quizzes table
      const { error: readError } = await supabase
        .from('shared_quizzes')
        .select('count')
        .limit(1);
      
      if (readError) {
        logger.warn('User cannot read from shared_quizzes table', 'SupabaseService', { 
          userId: currentUser.id, 
          error: readError.message,
          code: readError.code 
        });
        return { canShare: false, reason: `Cannot read shared_quizzes: ${readError.message}` };
      }
      
      const { data: userQuizzes, error: quizError } = await supabase
        .from('quizzes')
        .select('id')
        .eq('user_id', currentUser.id)
        .limit(1);
      
      if (quizError) {
        logger.warn('User cannot read their own quizzes', 'SupabaseService', { 
          userId: currentUser.id, 
          error: quizError.message,
          code: quizError.code 
        });
        return { canShare: false, reason: `Cannot read user quizzes: ${quizError.message}` };
      }
      
      if (!userQuizzes || userQuizzes.length === 0) {
        return { canShare: false, reason: 'User has no quizzes to share' };
      }
      
      const testQuizId = userQuizzes[0].id;
      const testToken = `test-token-${Date.now()}`;
      
      const { error: insertError } = await supabase
        .from('shared_quizzes')
        .insert({
          quiz_id: testQuizId,
          share_token: testToken,
          is_public: false,
          expires_at: null
        });
      
      await supabase
        .from('shared_quizzes')
        .delete()
        .eq('quiz_id', testQuizId)
        .eq('share_token', testToken);
      
      if (insertError) {
        logger.warn('User cannot insert into shared_quizzes table', 'SupabaseService', { 
          userId: currentUser.id, 
          error: insertError.message,
          code: insertError.code 
        });
        return { canShare: false, reason: `Cannot insert into shared_quizzes: ${insertError.message}` };
      }
      
      return { canShare: true };
      
    } catch (error) {
      logger.error('Error checking user share permissions', 'SupabaseService', { userId }, error as Error);
      return { canShare: false, reason: `Permission check failed: ${(error as Error).message}` };
    }
  }

  async shareQuiz(quizId: string, isPublic: boolean = true, expiresAt?: string, userId?: string): Promise<{ shareToken: string; shareUrl: string } | null> {
    try {
      logger.info('Starting shareQuiz process', 'SupabaseService', { quizId, isPublic, userId });
      
      let currentUserId: string;
      
      // If userId is provided, use it; otherwise try to get from Supabase auth
      if (userId) {
        currentUserId = userId;
        logger.info('Using provided user ID for sharing', 'SupabaseService', { 
          quizId, 
          userId: currentUserId 
        });
      } else {
        // Try to get the current authenticated user from Supabase
        const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !currentUser) {
          logger.error('No authenticated Supabase user found for sharing', 'SupabaseService', { 
            quizId, 
            userError: userError?.message,
            hint: 'User must be properly authenticated with Supabase to share quizzes'
          });
          throw new Error('User must be properly authenticated with Supabase to share quizzes');
        }
        
        currentUserId = currentUser.id;
        logger.info('Retrieved authenticated user from Supabase for sharing', 'SupabaseService', { 
          quizId, 
          userId: currentUserId 
        });
      }
      
      // First check if the quiz exists in the database and verify ownership
      // Use .limit(1) instead of .maybeSingle() to handle potential duplicates
      const { data: existingQuizArray, error: quizCheckError } = await supabase
        .from('quizzes')
        .select('id, user_id')
        .eq('id', quizId)
        .eq('user_id', currentUserId) // Ensure the current user owns this quiz
        .limit(1);

      const existingQuiz = existingQuizArray && existingQuizArray.length > 0 ? existingQuizArray[0] : null;

      if (quizCheckError) {
        logger.error('Error checking if quiz exists', 'SupabaseService', { 
          quizId, 
          error: quizCheckError.message,
          code: quizCheckError.code,
          details: quizCheckError.details 
        });
        return null;
      }

      if (!existingQuiz) {
        logger.error('Quiz not found or user does not own this quiz', 'SupabaseService', { 
          quizId, 
          userId: currentUserId 
        });
        return null;
      }

      logger.info('Quiz exists and user owns it, proceeding with share', 'SupabaseService', { 
        quizId, 
        quizUserId: existingQuiz.user_id 
      });

      // Use regular authenticated client for sharing operations
      // RLS policies now allow users to share their own quizzes
      logger.info('Using authenticated client for sharing operations', 'SupabaseService', { quizId });

      // Check if quiz is already shared - use limit(1) to handle duplicates
      const { data: existingShareArray, error: shareCheckError } = await supabase
        .from('shared_quizzes')
        .select('share_token')
        .eq('quiz_id', quizId)
        .limit(1);

      const existingShare = existingShareArray && existingShareArray.length > 0 ? existingShareArray[0] : null;

      if (shareCheckError && shareCheckError.code !== 'PGRST116') {
        logger.error('Error checking existing share', 'SupabaseService', { 
          quizId, 
          error: shareCheckError.message,
          code: shareCheckError.code 
        });
        return null;
      }

      if (existingShare) {
        const shareUrl = `${window.location.origin}/quizai/#/shared/${quizId}`;
        logger.info('Quiz is already shared, returning existing share info', 'SupabaseService', { 
          quizId, 
          shareToken: existingShare.share_token 
        });
        return { shareToken: existingShare.share_token, shareUrl };
      }

      // Generate a unique share token
      const shareToken = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      logger.info('Generated share token', 'SupabaseService', { quizId, shareToken });
      
      // Create a shared quiz entry using authenticated client
      // RLS policies ensure users can only share their own quizzes
      const { error: shareError } = await supabase
        .from('shared_quizzes')
        .insert({
          quiz_id: quizId,
          share_token: shareToken,
          is_public: isPublic,
          expires_at: expiresAt || null
        });

      if (shareError) {
        logger.error('Failed to create shared quiz entry', 'SupabaseService', { 
          quizId, 
          error: shareError.message,
          code: shareError.code,
          details: shareError.details,
          hint: shareError.hint,
          currentUserId: currentUserId,
          quizOwnerId: existingQuiz.user_id
        });
        
        // If it's an RLS policy violation, provide helpful information
        if (shareError.code === '42501') {
          logger.error('RLS policy violation: User may not have permission to share this quiz', 'SupabaseService', { 
            quizId,
            currentUserId: currentUserId,
            quizUserId: existingQuiz.user_id,
            errorHint: 'Make sure the user owns this quiz and RLS policies are properly configured'
          });
        }
        
        return null;
      }

      const shareUrl = `${window.location.origin}/quizai/#/shared/${quizId}`;
      
      logger.info('Quiz shared successfully', 'SupabaseService', { 
        quizId, 
        shareToken, 
        shareUrl,
        isPublic 
      });
      
      return { shareToken, shareUrl };
      
    } catch (error) {
      logger.error('Failed to share quiz', 'SupabaseService', { quizId }, error as Error);
      return null;
    }
  }

  // Utility function to make an existing quiz shareable (can be called from browser console)
  async makeQuizShareable(quizId: string): Promise<{ shareToken: string; shareUrl: string } | null> {
    try {
      logger.info('Making existing quiz shareable', 'SupabaseService', { quizId });
      
      // Get the current authenticated user
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !currentUser) {
        logger.error('No authenticated user found', 'SupabaseService', { quizId, userError: userError?.message });
        return null;
      }
      
      // First check if the quiz exists and the user owns it
      // Use .limit(1) instead of .maybeSingle() to handle potential duplicates
      const { data: quizDataArray, error: quizError } = await supabase
        .from('quizzes')
        .select('id, title, user_id')
        .eq('id', quizId)
        .eq('user_id', currentUser.id) // Ensure current user owns this quiz
        .limit(1);

      const quizData = quizDataArray && quizDataArray.length > 0 ? quizDataArray[0] : null;

      if (quizError || !quizData) {
        logger.error('Quiz not found or user does not own this quiz', 'SupabaseService', { 
          quizId, 
          userId: currentUser.id,
          error: quizError?.message 
        });
        return null;
      }

      // Check if it's already shared using regular authenticated client - use limit(1) for duplicates
      const { data: existingShareArray, error: shareCheckError } = await supabase
        .from('shared_quizzes')
        .select('share_token')
        .eq('quiz_id', quizId)
        .limit(1);

      const existingShare = existingShareArray && existingShareArray.length > 0 ? existingShareArray[0] : null;

      if (shareCheckError && shareCheckError.code !== 'PGRST116') {
        logger.error('Error checking existing share', 'SupabaseService', { quizId, error: shareCheckError.message });
        return null;
      }

      if (existingShare) {
        const shareUrl = `${window.location.origin}/quizai/#/shared/${quizId}`;
        logger.info('Quiz is already shareable', 'SupabaseService', { quizId, shareToken: existingShare.share_token });
        return { shareToken: existingShare.share_token, shareUrl };
      }

      // Create a new share entry using the existing shareQuiz method
      return await this.shareQuiz(quizId, true, undefined, currentUser.id);
      
    } catch (error) {
      logger.error('Failed to make quiz shareable', 'SupabaseService', { quizId }, error as Error);
      return null;
    }
  }

  private mapDatabaseQuizToQuiz(dbQuiz: any): Quiz {
    return {
      id: dbQuiz.id,
      title: dbQuiz.title,
      questions: dbQuiz.questions,
      sourceContentSnippet: dbQuiz.source_content,
      config: dbQuiz.config || {},
      createdAt: dbQuiz.created_at,
      lastModified: dbQuiz.updated_at,
      userId: dbQuiz.user_id
    }
  }

  private mapDatabaseResultToQuizResult(dbResult: any): QuizResult {
    return {
      quizId: dbResult.quiz_id,
      score: dbResult.score,
      totalQuestions: dbResult.total_questions,
      totalCorrect: Math.round((dbResult.score / 100) * dbResult.total_questions),
      answers: dbResult.answers,
      timeTaken: dbResult.time_taken,
      createdAt: dbResult.created_at
    }
  }

  async getExistingShareUrl(quizId: string): Promise<string | null> {
    try {
      logger.info('Checking for existing share URL', 'SupabaseService', { quizId });
      
      // Fast lookup for existing share
      const { data: existingShareArray, error: shareCheckError } = await supabase
        .from('shared_quizzes')
        .select('quiz_id')
        .eq('quiz_id', quizId)
        .limit(1);

      if (shareCheckError) {
        logger.error('Error checking existing share', 'SupabaseService', { 
          quizId, 
          error: shareCheckError.message 
        });
        return null;
      }

      if (existingShareArray && existingShareArray.length > 0) {
        const shareUrl = `${window.location.origin}/quizai/#/shared/${quizId}`;
        logger.info('Found existing share URL', 'SupabaseService', { quizId });
        return shareUrl;
      }

      return null;
    } catch (error) {
      logger.error('Failed to check existing share URL', 'SupabaseService', { quizId }, error as Error);
      return null;
    }
  }
}

export const supabaseService = new SupabaseService()
