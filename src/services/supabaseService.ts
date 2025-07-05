import { supabase } from './supabaseClient'
import { Quiz, UserProfile, QuizResult } from '../types'
import { logger } from './logService'

export class SupabaseService {
  async createUser(profile: Partial<UserProfile>): Promise<UserProfile | null> {
    try {
      logger.info('SupabaseService: Attempting to create user', 'SupabaseService', { 
        userId: profile.id,
        email: profile.email,
        hasName: !!profile.name,
        hasImageUrl: !!profile.imageUrl
      })

      const userInsertData = {
        id: profile.id,
        email: profile.email!,
        name: profile.name,
        bio: profile.bio,
        image_url: profile.imageUrl,
        quiz_count: profile.quizCount || 0,
        completion_count: profile.completionCount || 0,
        average_score: profile.averageScore
      }

      logger.info('SupabaseService: Insert data prepared', 'SupabaseService', { userInsertData })

      const { data, error } = await supabase
        .from('users')
        .insert([userInsertData])
        .select()
        .single()

      if (error) {
        logger.error('SupabaseService: Insert error details', 'SupabaseService', { 
          error: error,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        })
        
        if (error.code === '23505' && error.message.includes('users_email_key')) {
          logger.info('SupabaseService: User with email already exists, attempting to find existing user', 'SupabaseService', { email: profile.email })
          const existingUser = await this.getUserByEmail(profile.email!)
          if (existingUser) {
            logger.info('SupabaseService: Found existing user by email', 'SupabaseService', { userId: existingUser.id })
            return existingUser
          }
        }
        
        throw error
      }
      
      logger.info('User created in Supabase successfully', 'SupabaseService', { userId: data.id, insertedData: data })
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
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null
        }
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
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null
        }
        throw error
      }
      
      return this.mapDatabaseUserToProfile(data)
    } catch (error) {
      logger.error('Failed to get user by email', 'SupabaseService', { email }, error as Error)
      return null
    }
  }

  async updateUser(id: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    try {
      const updateData: any = {}
      if (updates.name !== undefined) updateData.name = updates.name
      if (updates.bio !== undefined) updateData.bio = updates.bio
      if (updates.imageUrl !== undefined) updateData.image_url = updates.imageUrl
      if (updates.quizCount !== undefined) updateData.quiz_count = updates.quizCount
      if (updates.completionCount !== undefined) updateData.completion_count = updates.completionCount
      if (updates.averageScore !== undefined) updateData.average_score = updates.averageScore

      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      
      logger.info('User updated in Supabase', 'SupabaseService', { userId: id })
      return this.mapDatabaseUserToProfile(data)
    } catch (error) {
      logger.error('Failed to update user', 'SupabaseService', { id, updates }, error as Error)
      return null
    }
  }

  async getUserQuizzes(userId: string): Promise<Quiz[]> {
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      return data.map(this.mapDatabaseQuizToQuiz)
    } catch (error) {
      logger.error('Failed to get user quizzes', 'SupabaseService', { userId }, error as Error)
      return []
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
    
    // If we've exhausted all attempts, just return a new ID and hope for the best
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

      const quizForDb = {
        id: quiz.id,
        user_id: userId,
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
          hint: error.hint
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
      // Validate the UUID format before attempting deletion
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

  async saveQuizResult(result: QuizResult, userId: string): Promise<boolean> {
    try {
      const resultForDb = {
        user_id: userId,
        quiz_id: result.quizId,
        score: result.score,
        total_questions: result.totalQuestions,
        answers: result.answers,
        time_taken: result.timeTaken || null
      }

      const { error } = await supabase
        .from('quiz_results')
        .insert([resultForDb])

      if (error) throw error
      
      logger.info('Quiz result saved to Supabase', 'SupabaseService', { quizId: result.quizId })
      return true
    } catch (error) {
      logger.error('Failed to save quiz result', 'SupabaseService', { quizId: result.quizId }, error as Error)
      return false
    }
  }

  async getUserQuizResults(userId: string): Promise<QuizResult[]> {
    try {
      const { data, error } = await supabase
        .from('quiz_results')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      
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

  async getPublicQuizById(quizId: string): Promise<Quiz | null> {
    try {
      logger.info('Attempting to fetch public quiz by ID from Supabase', 'SupabaseService', { quizId });
      
      // Test if Supabase is available first
      const { error: testError } = await supabase
        .from('shared_quizzes')
        .select('count')
        .limit(1)
        .maybeSingle();
      
      if (testError) {
        logger.warn('Supabase connection test failed', 'SupabaseService', { 
          error: testError.message,
          code: testError.code,
          hint: testError.hint 
        });
        return null; // Fallback to localStorage
      }
      
      // First check if the quiz is actually shared/public
      const { data: sharedData, error: sharedError } = await supabase
        .from('shared_quizzes')
        .select('quiz_id, is_public, expires_at')
        .eq('quiz_id', quizId)
        .eq('is_public', true)
        .maybeSingle();

      if (sharedError) {
        logger.warn('Error checking if quiz is shared', 'SupabaseService', { 
          quizId, 
          error: sharedError.message,
          code: sharedError.code 
        });
        return null;
      }

      if (!sharedData) {
        logger.info('Quiz is not publicly shared', 'SupabaseService', { quizId });
        return null;
      }

      // Check if the shared quiz has expired
      if (sharedData.expires_at && new Date(sharedData.expires_at) < new Date()) {
        logger.info('Shared quiz has expired', 'SupabaseService', { quizId, expiresAt: sharedData.expires_at });
        return null;
      }
      
      // Now try to get the actual quiz
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .maybeSingle();

      if (quizError) {
        logger.warn('Error fetching quiz from Supabase', 'SupabaseService', { 
          quizId, 
          error: quizError.message,
          code: quizError.code 
        });
        return null; // Allow fallback to localStorage
      }

      if (!quizData) {
        logger.info('Quiz not found in Supabase database', 'SupabaseService', { quizId });
        return null;
      }

      // Try to get user data if we have a user_id
      let creatorInfo = { name: 'Unknown', email: undefined };
      if (quizData.user_id) {
        try {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('name, email')
            .eq('id', quizData.user_id)
            .maybeSingle();
          
          if (!userError && userData) {
            creatorInfo = {
              name: userData.name || 'Unknown',
              email: userData.email
            };
          } else {
            logger.info('Could not fetch creator info', 'SupabaseService', { 
              userId: quizData.user_id,
              error: userError?.message 
            });
          }
        } catch (userFetchError) {
          logger.warn('Error fetching creator info', 'SupabaseService', { userId: quizData.user_id }, userFetchError as Error);
        }
      }

      const quiz = this.mapDatabaseQuizToQuiz(quizData);
      logger.info('Successfully fetched quiz from Supabase', 'SupabaseService', { quizId });
      return {
        ...quiz,
        creator: creatorInfo,
        isShared: true,
        sharedTimestamp: quizData.created_at
      };
      
    } catch (error) {
      logger.warn('Supabase service unavailable, falling back to localStorage', 'SupabaseService', { quizId }, error as Error);
      return null; // This will trigger localStorage fallback
    }
  }

  // Check if user has permission to share quizzes (for debugging RLS issues)
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
      
      // Check if the user has any quizzes (to test ownership-based RLS)
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
      
      // Try a test insert with a real quiz ID that the user owns using regular client
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
      
      // Clean up the test insert (ignore cleanup errors)
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
          logger.error('No authenticated user found for sharing and no userId provided', 'SupabaseService', { 
            quizId, 
            userError: userError?.message 
          });
          return null;
        }
        
        currentUserId = currentUser.id;
        logger.info('Retrieved authenticated user from Supabase for sharing', 'SupabaseService', { 
          quizId, 
          userId: currentUserId 
        });
      }
      
      // First check if the quiz exists in the database and verify ownership
      const { data: existingQuiz, error: quizCheckError } = await supabase
        .from('quizzes')
        .select('id, user_id')
        .eq('id', quizId)
        .eq('user_id', currentUserId) // Ensure the current user owns this quiz
        .maybeSingle();

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

      // Check if quiz is already shared
      const { data: existingShare, error: shareCheckError } = await supabase
        .from('shared_quizzes')
        .select('share_token')
        .eq('quiz_id', quizId)
        .maybeSingle();

      if (shareCheckError && shareCheckError.code !== 'PGRST116') {
        logger.error('Error checking existing share', 'SupabaseService', { 
          quizId, 
          error: shareCheckError.message,
          code: shareCheckError.code 
        });
        return null;
      }

      if (existingShare) {
        const shareUrl = `${window.location.origin}${window.location.pathname}#/shared/${quizId}`;
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

      const shareUrl = `${window.location.origin}${window.location.pathname}#/shared/${quizId}`;
      
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
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select('id, title, user_id')
        .eq('id', quizId)
        .eq('user_id', currentUser.id) // Ensure current user owns this quiz
        .maybeSingle();

      if (quizError || !quizData) {
        logger.error('Quiz not found or user does not own this quiz', 'SupabaseService', { 
          quizId, 
          userId: currentUser.id,
          error: quizError?.message 
        });
        return null;
      }

      // Check if it's already shared using regular authenticated client
      const { data: existingShare, error: shareCheckError } = await supabase
        .from('shared_quizzes')
        .select('share_token')
        .eq('quiz_id', quizId)
        .maybeSingle();

      if (shareCheckError && shareCheckError.code !== 'PGRST116') {
        logger.error('Error checking existing share', 'SupabaseService', { quizId, error: shareCheckError.message });
        return null;
      }

      if (existingShare) {
        const shareUrl = `${window.location.origin}${window.location.pathname}#/shared/${quizId}`;
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

  // Debug function to check user authentication and permissions
  async debugUserPermissions(): Promise<void> {
    try {
      console.log('🔍 Debugging User Permissions...');
      
      // Check authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error('❌ Authentication failed:', authError?.message || 'No user found');
        return;
      }
      
      console.log('✅ User authenticated:', { id: user.id, email: user.email });
      
      // Check quiz ownership
      const { data: userQuizzes, error: quizError } = await supabase
        .from('quizzes')
        .select('id, title, created_at')
        .eq('user_id', user.id)
        .limit(5);
      
      if (quizError) {
        console.error('❌ Cannot read user quizzes:', quizError.message);
        return;
      }
      
      console.log(`✅ User has ${userQuizzes?.length || 0} quizzes`);
      if (userQuizzes && userQuizzes.length > 0) {
        console.log('📝 User quizzes:', userQuizzes);
      }
      
      // Check sharing permissions
      const permissionCheck = await this.checkUserSharePermissions(user.id);
      console.log('🔐 Share permissions:', permissionCheck);
      
    } catch (error) {
      console.error('❌ Debug failed:', error);
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
}

export const supabaseService = new SupabaseService()
