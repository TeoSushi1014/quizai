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
  user_name?: string;
  user_email?: string;
  quiz_title?: string;
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
      // Check authentication first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        logger.warn('User not authenticated, cannot save quiz result', 'QuizResultsService', {
          quizId: result.quizId
        });
        return null;
      }

      logger.info('Saving quiz result to database', 'QuizResultsService', {
        quizId: result.quizId,
        score: result.score,
        totalQuestions: result.totalQuestions,
        userId: result.userId,
        sessionUserId: session.user.id,
        timeTaken: result.timeTaken
      });

      // Prepare the data with proper types
      const insertData = {
        user_id: session.user.id,
        quiz_id: result.quizId,
        score: Number(result.score),
        total_questions: Number(result.totalQuestions),
        answers: result.answers || [],
        time_taken: result.timeTaken ? Math.round(Number(result.timeTaken)) : null,
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
          hint: error.hint,
          insertData: {
            ...insertData,
            answers: `${insertData.answers.length} answers`
          }
        });
        return null;
      }

      logger.info('Quiz result saved successfully', 'QuizResultsService', {
        resultId: data.id,
        quizId: result.quizId,
        timeTaken: insertData.time_taken
      });

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
      logger.info('Fetching quiz history', 'QuizResultsService', {
        quizId: params.quizId,
        userId: params.userId,
        limit: params.limit
      });

      // Check authentication for RLS compliance
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        logger.warn('User not authenticated, returning empty quiz history', 'QuizResultsService');
        return [];
      }

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
          users!inner(
            name,
            email
          )
        `)
        .eq('quiz_id', params.quizId)
        .order('created_at', { ascending: false });

      // Filter by user if provided
      if (params.userId) {
        logger.info('Filtering quiz history by userId', 'QuizResultsService', { 
          userId: params.userId 
        });
        query = query.eq('user_id', params.userId);
      } else {
        logger.info('Getting all quiz history (no user filter)', 'QuizResultsService');
      }

      // Apply pagination
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

      // Transform data to include user info
      const results: QuizResultRecord[] = (data || []).map((record: any) => ({
        id: record.id,
        user_id: record.user_id,
        quiz_id: record.quiz_id,
        score: record.score,
        total_questions: record.total_questions,
        answers: record.answers || [],
        time_taken: record.time_taken,
        created_at: record.created_at,
        user_name: record.users?.name || 'Anonymous User',
        user_email: record.users?.email || null
      }));

      logger.info('Quiz history fetched successfully', 'QuizResultsService', {
        quizId: params.quizId,
        resultCount: results.length
      });

      return results;
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
      logger.info('Fetching user quiz history', 'QuizResultsService', {
        userId,
        limit
      });

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

      const results: QuizResultRecord[] = data.map((record: any) => ({
        id: record.id,
        user_id: record.user_id,
        quiz_id: record.quiz_id,
        score: record.score,
        total_questions: record.total_questions,
        answers: record.answers,
        time_taken: record.time_taken,
        created_at: record.created_at,
        // Include quiz title for better UX
        quiz_title: record.quizzes?.title || 'Unknown Quiz'
      }));

      logger.info('User quiz history fetched successfully', 'QuizResultsService', {
        userId,
        resultCount: results.length
      });

      return results;
    } catch (error) {
      logger.error('Error fetching user quiz history', 'QuizResultsService', {}, error as Error);
      return [];
    }
  }

  /**
   * Lấy thống kê tổng quan của một quiz
   */
  async getQuizStats(quizId: string): Promise<{
    totalAttempts: number;
    averageScore: number;
    bestScore: number;
    averageTime: number;
    uniqueUsers: number;
  }> {
    try {
      logger.info('Fetching quiz statistics', 'QuizResultsService', { quizId });

      const { data, error } = await supabase
        .from('quiz_results')
        .select('score, time_taken, user_id')
        .eq('quiz_id', quizId);

      if (error) {
        logger.error('Failed to fetch quiz statistics', 'QuizResultsService', {
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
      const scores = results.map(r => r.score);
      const times = results.filter(r => r.time_taken !== null).map(r => r.time_taken);
      const uniqueUserIds = new Set(results.filter(r => r.user_id).map(r => r.user_id));

      const stats = {
        totalAttempts: results.length,
        averageScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
        bestScore: scores.length > 0 ? Math.max(...scores) : 0,
        averageTime: times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
        uniqueUsers: uniqueUserIds.size
      };

      logger.info('Quiz statistics calculated', 'QuizResultsService', {
        quizId,
        ...stats
      });

      return stats;
    } catch (error) {
      logger.error('Error calculating quiz statistics', 'QuizResultsService', {}, error as Error);
      return {
        totalAttempts: 0,
        averageScore: 0,
        bestScore: 0,
        averageTime: 0,
        uniqueUsers: 0
      };
    }
  }

  /**
   * Lấy chi tiết một kết quả cụ thể
   */
  async getQuizResult(resultId: string): Promise<QuizResultRecord | null> {
    try {
      logger.info('Fetching quiz result details', 'QuizResultsService', { resultId });

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
          users:user_id (
            name,
            email
          ),
          quizzes:quiz_id (
            title,
            questions
          )
        `)
        .eq('id', resultId)
        .single();

      if (error) {
        logger.error('Failed to fetch quiz result details', 'QuizResultsService', {
          error: error.message,
          code: error.code
        });
        return null;
      }

      const result: QuizResultRecord = {
        id: data.id,
        user_id: data.user_id,
        quiz_id: data.quiz_id,
        score: data.score,
        total_questions: data.total_questions,
        answers: data.answers,
        time_taken: data.time_taken,
        created_at: data.created_at,
        user_name: (data.users as any)?.name || 'Anonymous User',
        user_email: (data.users as any)?.email || null,
        quiz_title: (data.quizzes as any)?.title || 'Unknown Quiz'
      };

      logger.info('Quiz result details fetched successfully', 'QuizResultsService', { resultId });

      return result;
    } catch (error) {
      logger.error('Error fetching quiz result details', 'QuizResultsService', {}, error as Error);
      return null;
    }
  }
}

export const quizResultsService = new QuizResultsService();
