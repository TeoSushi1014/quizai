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

  async createQuiz(quiz: Quiz, userId: string): Promise<Quiz | null> {
    try {
      const quizForDb = {
        id: quiz.id,
        user_id: userId,
        title: quiz.title,
        questions: quiz.questions,
        source_content: quiz.sourceContentSnippet || null,
        source_file_name: null,
        config: quiz.config || {}
      }

      const { data, error } = await supabase
        .from('quizzes')
        .insert([quizForDb])
        .select()
        .single()

      if (error) throw error
      
      logger.info('Quiz created in Supabase', 'SupabaseService', { quizId: data.id })
      return this.mapDatabaseQuizToQuiz(data)
    } catch (error) {
      logger.error('Failed to create quiz', 'SupabaseService', { quizId: quiz.id }, error as Error)
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
      logger.info('Fetching public quiz by ID', 'SupabaseService', { quizId });
      
      const { data, error } = await supabase
        .from('quizzes')
        .select(`
          *,
          users(name, email)
        `)
        .eq('id', quizId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          logger.info('Quiz not found in database', 'SupabaseService', { quizId });
          return null;
        }
        logger.error('Error fetching public quiz', 'SupabaseService', { quizId }, error);
        throw error;
      }

      if (!data) {
        logger.info('No data returned for quiz', 'SupabaseService', { quizId });
        return null;
      }

      const quiz = this.mapDatabaseQuizToQuiz(data);
      return {
        ...quiz,
        creator: {
          name: data.users?.name || 'Unknown',
          email: data.users?.email
        },
        isShared: true,
        sharedTimestamp: data.created_at
      };
      
    } catch (error) {
      logger.error('Failed to get public quiz by ID', 'SupabaseService', { quizId }, error as Error);
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
}

export const supabaseService = new SupabaseService()
