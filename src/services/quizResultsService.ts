import { supabase } from './supabaseClient';
import { logger } from './logService';
import { QuizResult, UserAnswer } from '../types';

export interface QuizResultRecord {
  id: string;
  user_id: string | null;
  quiz_id: string;
  score: number;
  total_questions: number;
  answers: UserAnswer[];
  time_taken: number | null;
  created_at: string;
  user_name: string | null;
  user_email: string | null;
  user_image_url: string | null;
  quiz_title: string | null;
}

export interface QuizHistoryParams {
  quizId: string;
  userId?: string;
  limit?: number;
  offset?: number;
}

export class QuizResultsService {
  async saveQuizResult(result: QuizResult): Promise<string | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        logger.warn('User not authenticated, cannot save quiz result', 'QuizResultsService', {
          quizId: result.quizId
        });
        return null;
      }

      const insertData = {
        user_id: session.user.id,
        quiz_id: result.quizId,
        score: Number(result.score),
        total_questions: Number(result.totalQuestions),
        answers: result.answers || [],
        time_taken: typeof result.timeTaken === 'number' ? Math.round(result.timeTaken) : null,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('quiz_results')
        .insert([insertData])
        .select('id')
        .single();

      if (error) {
        logger.error('Failed to save quiz result', 'QuizResultsService', {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        return null;
      }

      return data.id;
    } catch (error) {
      logger.error('Error saving quiz result', 'QuizResultsService', {
        quizId: result.quizId,
        error: (error as Error).message
      }, error as Error);
      return null;
    }
  }

  async getQuizHistory(params: QuizHistoryParams): Promise<QuizResultRecord[]> {
    try {
      let query = supabase
        .from('quiz_results')
        .select(`
          id,
          user_id,
          quiz_id,
          score,
          total_questions,
          answers,
          time_taken,
          created_at,
          users!user_id (
            name,
            email,
            image_url
          ),
          quizzes!quiz_id (
            title
          )
        `)
        .eq('quiz_id', params.quizId)
        .order('created_at', { ascending: false });

      if (params.userId) {
        query = query.eq('user_id', params.userId);
      }

      if (params.limit) {
        query = query.limit(params.limit);
      }
      if (params.offset) {
        query = query.range(params.offset, params.offset + (params.limit || 10) - 1);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to fetch quiz history', 'QuizResultsService', {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        return [];
      }

      return (data || []).map((record: any): QuizResultRecord => ({
        id: record.id,
        user_id: record.user_id,
        quiz_id: record.quiz_id,
        score: record.score,
        total_questions: record.total_questions,
        answers: record.answers || [],
        time_taken: record.time_taken,
        created_at: record.created_at,
        user_name: record.users?.name || 'Anonymous',
        user_email: record.users?.email || null,
        user_image_url: record.users?.image_url || null,
        quiz_title: record.quizzes?.title || null
      }));
    } catch (error) {
      logger.error('Error fetching quiz history', 'QuizResultsService', {
        quizId: params.quizId,
        error: (error as Error).message
      }, error as Error);
      return [];
    }
  }

  async getUserQuizHistory(userId: string, limit: number = 20): Promise<QuizResultRecord[]> {
    try {
      const { data, error } = await supabase
        .from('quiz_results')
        .select(`
          id,
          user_id,
          quiz_id,
          score,
          total_questions,
          answers,
          time_taken,
          created_at,
          quizzes:quiz_id (
            title,
            user_id
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Failed to fetch user quiz history', 'QuizResultsService', {
          error: error.message,
          code: error.code
        });
        return [];
      }

      return data.map((record: any) => ({
        id: record.id,
        user_id: record.user_id,
        quiz_id: record.quiz_id,
        score: record.score,
        total_questions: record.total_questions,
        answers: record.answers,
        time_taken: record.time_taken,
        created_at: record.created_at,
        quiz_title: record.quizzes?.title || 'Unknown Quiz'
      }));
    } catch (error) {
      logger.error('Error fetching user quiz history', 'QuizResultsService', {}, error as Error);
      return [];
    }
  }

  async getQuizStats(quizId: string): Promise<{
    totalAttempts: number;
    averageScore: number;
    bestScore: number;
    averageTime: number;
    uniqueUsers: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('quiz_results')
        .select('*')
        .eq('quiz_id', quizId);

      if (error) {
        logger.error('Failed to fetch quiz stats', 'QuizResultsService', {
          error: error.message,
          code: error.code
        });
        return {
          totalAttempts: 0,
          averageScore: 0,
          bestScore: 0,
          averageTime: 0,
          uniqueUsers: 0
        };
      }

      const results = data || [];
      const times = results
        .map(r => r.time_taken)
        .filter((time): time is number => typeof time === 'number' && !isNaN(time));

      const uniqueUserIds = new Set(results.map(r => r.user_id));

      return {
        totalAttempts: results.length,
        averageScore: results.length ? results.reduce((sum, r) => sum + r.score, 0) / results.length : 0,
        bestScore: results.length ? Math.max(...results.map(r => r.score)) : 0,
        averageTime: times.length ? times.reduce((sum, time) => sum + time, 0) / times.length : 0,
        uniqueUsers: uniqueUserIds.size
      };
    } catch (error) {
      logger.error('Error fetching quiz stats', 'QuizResultsService', {
        quizId,
        error: (error as Error).message
      }, error as Error);
      return {
        totalAttempts: 0,
        averageScore: 0,
        bestScore: 0,
        averageTime: 0,
        uniqueUsers: 0
      };
    }
  }

  async getQuizResult(resultId: string): Promise<QuizResultRecord | null> {
    try {
      const { data, error } = await supabase
        .from('quiz_results')
        .select(`
          id,
          user_id,
          quiz_id,
          score,
          total_questions,
          answers,
          time_taken,
          created_at,
          users!inner(
            name,
            email,
            image_url
          ),
          quizzes:quiz_id (
            title
          )
        `)
        .eq('id', resultId)
        .single();

      if (error) {
        logger.error('Failed to fetch quiz result', 'QuizResultsService', {
          error: error.message,
          code: error.code
        });
        return null;
      }

      return {
        id: data.id,
        user_id: data.user_id,
        quiz_id: data.quiz_id,
        score: data.score,
        total_questions: data.total_questions,
        answers: data.answers,
        time_taken: data.time_taken,
        created_at: data.created_at,
        user_name: data.users?.name || 'Anonymous User',
        user_email: data.users?.email || null,
        user_image_url: data.users?.image_url || null,
        quiz_title: data.quizzes?.title || 'Unknown Quiz'
      };
    } catch (error) {
      logger.error('Error fetching quiz result', 'QuizResultsService', {
        resultId,
        error: (error as Error).message
      }, error as Error);
      return null;
    }
  }
}

export const quizResultsService = new QuizResultsService();