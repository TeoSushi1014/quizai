import localforage from 'localforage';
import { supabase } from './supabaseClient';
import { Quiz } from '../types';
import { logger } from './logService';
import { validateAndCleanQuizzes } from '../utils/quizValidationUtils';

// --- Configuration for LocalForage ---
const QUIZZES_STORE_NAME = 'quizzes';
const QUIZ_STORE_CONFIG = {
  name: QUIZZES_STORE_NAME,
  storeName: 'quiz_data'
};

// Initialize LocalForage instance for quizzes
const quizStore = localforage.createInstance(QUIZ_STORE_CONFIG);

class QuizStorage {
  async getAllQuizzes(): Promise<Quiz[]> {
    try {
      logger.info('Getting all quizzes from storage', 'QuizStorage');
      const quizzes = await quizStore.getItem<Quiz[]>(QUIZZES_STORE_NAME) || [];
      
      // Validate and clean quizzes
      const cleanedQuizzes = validateAndCleanQuizzes(quizzes);
      
      if (cleanedQuizzes.length !== quizzes.length) {
        logger.info('Some quizzes were cleaned during validation', 'QuizStorage', {
          original: quizzes.length,
          cleaned: cleanedQuizzes.length
        });
        await this.saveQuizzes(cleanedQuizzes);
      }
      
      return cleanedQuizzes;
    } catch (error) {
      logger.error('Failed to get quizzes from storage', 'QuizStorage', {}, error as Error);
      return [];
    }
  }

  async saveQuizzes(quizzes: Quiz[]): Promise<void> {
    try {
      logger.info('Saving quizzes to storage', 'QuizStorage', { count: quizzes.length });
      await quizStore.setItem(QUIZZES_STORE_NAME, quizzes);
    } catch (error) {
      logger.error('Failed to save quizzes to storage', 'QuizStorage', {}, error as Error);
      throw error;
    }
  }

  async clearQuizzes(): Promise<void> {
    try {
      logger.info('Clearing all quizzes from storage', 'QuizStorage');
      await quizStore.removeItem(QUIZZES_STORE_NAME);
    } catch (error) {
      logger.error('Failed to clear quizzes from storage', 'QuizStorage', {}, error as Error);
      throw error;
    }
  }
}

export const quizStorage = new QuizStorage();