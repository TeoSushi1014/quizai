import { supabase } from './supabaseClient';
import { QuizProgress } from '../types';
import { logger } from './logService';
import { Database } from './database.types';

type QuizProgressRow = Database['public']['Tables']['quiz_progress']['Row'];

class QuizProgressService {
  /**
   * Save or update quiz progress
   * @param progress 
   * @returns progress id if successful, null otherwise
   */
  async saveQuizProgress(progress: QuizProgress): Promise<string | null> {
    try {
      if (!progress.userId) {
        logger.warn('Cannot save progress: no user ID provided', 'QuizProgressService');
        return null;
      }

      const { data, error } = await supabase
        .from('quiz_progress')
        .upsert({
          id: progress.id,
          user_id: progress.userId,
          quiz_id: progress.quizId,
          current_question_index: progress.currentQuestionIndex,
          answers: progress.answers,
          completed: progress.completed,
          mode: progress.mode,
          elapsed_time: progress.elapsedTime,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'user_id,quiz_id,mode'
        });

      if (error) {
        logger.error('Failed to save quiz progress', 'QuizProgressService', { progress }, error);
        return null;
      }

      // Data might be undefined in newer versions of Supabase JS client
      return progress.id || null;
    } catch (error) {
      logger.error('Exception saving quiz progress', 'QuizProgressService', { progress }, error as Error);
      return null;
    }
  }

  /**
   * Get quiz progress for a specific user, quiz, and mode
   * @param userId 
   * @param quizId 
   * @param mode 
   * @returns Quiz progress if found, null otherwise
   */
  async getQuizProgress(userId: string, quizId: string, mode: 'practice' | 'take'): Promise<QuizProgress | null> {
    try {
      const { data, error } = await supabase
        .from('quiz_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('quiz_id', quizId)
        .eq('mode', mode)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') { // PGRST116 is "no rows returned" - not an error
          logger.error('Failed to fetch quiz progress', 'QuizProgressService', { userId, quizId, mode }, error);
        }
        return null;
      }

      if (!data) return null;

      const progressData = data as QuizProgressRow;
      
      return {
        id: progressData.id,
        quizId: progressData.quiz_id,
        userId: progressData.user_id,
        currentQuestionIndex: progressData.current_question_index,
        answers: progressData.answers || {},
        completed: progressData.completed,
        mode: progressData.mode,
        elapsedTime: progressData.elapsed_time,
        lastUpdated: progressData.last_updated
      };
    } catch (error) {
      logger.error('Exception fetching quiz progress', 'QuizProgressService', { userId, quizId, mode }, error as Error);
      return null;
    }
  }

  /**
   * Delete quiz progress
   * @param userId 
   * @param quizId 
   * @param mode 
   * @returns true if successful, false otherwise
   */
  async deleteQuizProgress(userId: string, quizId: string, mode: 'practice' | 'take'): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('quiz_progress')
        .delete()
        .eq('user_id', userId)
        .eq('quiz_id', quizId)
        .eq('mode', mode);

      if (error) {
        logger.error('Failed to delete quiz progress', 'QuizProgressService', { userId, quizId, mode }, error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Exception deleting quiz progress', 'QuizProgressService', { userId, quizId, mode }, error as Error);
      return false;
    }
  }

  /**
   * List all quiz progress for a user
   * @param userId 
   * @returns Array of quiz progress
   */
  async listQuizProgress(userId: string): Promise<QuizProgress[]> {
    try {
      const { data, error } = await supabase
        .from('quiz_progress')
        .select('*')
        .eq('user_id', userId)
        .order('last_updated', { ascending: false });

      if (error) {
        logger.error('Failed to list quiz progress', 'QuizProgressService', { userId }, error);
        return [];
      }

      if (!data) return [];
      
      return data.map((item) => ({
        id: item.id,
        quizId: item.quiz_id,
        userId: item.user_id,
        currentQuestionIndex: item.current_question_index,
        answers: item.answers || {},
        completed: item.completed,
        mode: item.mode,
        elapsedTime: item.elapsed_time,
        lastUpdated: item.last_updated
      }));
    } catch (error) {
      logger.error('Exception listing quiz progress', 'QuizProgressService', { userId }, error as Error);
      return [];
    }
  }
}

export const quizProgressService = new QuizProgressService(); 