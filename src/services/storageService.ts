import localforage from 'localforage';
import { Quiz } from '../types';
import { logger } from './logService';
import { validateAndCleanQuizzes } from '../utils/quizValidationUtils';

// --- Configuration for LocalForage ---
const LOCALFORAGE_CONFIG = {
  name: 'QuizAI',
  storeName: 'quiz_data_store', 
  description: 'Stores QuizAI quizzes and related data'
};
localforage.config(LOCALFORAGE_CONFIG);

const QUIZAI_LOCALFORAGE_KEY_QUIZZES = 'quizai-lf-quizzes';
const QUIZAI_LEGACY_LOCALSTORAGE_KEY_QUIZZES = 'quizzes';


export const quizStorage = {
  async getAllQuizzes(): Promise<Quiz[]> {
    try {
      const quizzesLF = await localforage.getItem<Quiz[]>(QUIZAI_LOCALFORAGE_KEY_QUIZZES);
      if (quizzesLF !== null && quizzesLF !== undefined) {
        logger.info('Quizzes loaded from LocalForage.', 'StorageService', { count: quizzesLF.length });
        // Validate and clean quizzes before returning
        const validQuizzes = validateAndCleanQuizzes(quizzesLF);
        if (validQuizzes.length !== quizzesLF.length) {
          // Save the cleaned data back to storage
          await localforage.setItem(QUIZAI_LOCALFORAGE_KEY_QUIZZES, validQuizzes);
        }
        return validQuizzes;
      }
      
      logger.info('No quizzes in LocalForage, trying legacy localStorage.', 'StorageService');
      const localQuizzesJson = localStorage.getItem(QUIZAI_LEGACY_LOCALSTORAGE_KEY_QUIZZES);
      if (localQuizzesJson) {
        const parsedQuizzes = JSON.parse(localQuizzesJson);
        logger.info('Quizzes loaded from legacy localStorage.', 'StorageService', { count: parsedQuizzes.length });
        // Validate and clean quizzes
        const validQuizzes = validateAndCleanQuizzes(parsedQuizzes);
        // Optionally, migrate to LocalForage here: await localforage.setItem(QUIZAI_LOCALFORAGE_KEY_QUIZZES, validQuizzes);
        return validQuizzes;
      }
      logger.info('No quizzes found in any local storage.', 'StorageService');
      return [];

    } catch (error) {
      logger.error('Error reading quizzes from LocalForage.', 'StorageService', undefined, error as Error);
      try {
        const localQuizzesJson = localStorage.getItem(QUIZAI_LEGACY_LOCALSTORAGE_KEY_QUIZZES);
        if (localQuizzesJson) {
          const parsedFallback = JSON.parse(localQuizzesJson);
          logger.warn('Fell back to localStorage for reading quizzes.', 'StorageService', { count: parsedFallback.length });
          // Validate and clean quizzes before returning
          const validQuizzes = validateAndCleanQuizzes(parsedFallback);
          return validQuizzes;
        }
        return [];
      } catch (lsError) {
        logger.error('Error reading quizzes from localStorage after LocalForage failure.', 'StorageService', undefined, lsError as Error);
        return []; 
      }
    }
  },

  async saveQuizzes(quizzes: Quiz[]): Promise<void> {
    try {
      await localforage.setItem(QUIZAI_LOCALFORAGE_KEY_QUIZZES, quizzes);
      logger.info('Quizzes saved to LocalForage.', 'StorageService', { count: quizzes.length });
    } catch (error) {
      logger.error('Error saving quizzes to LocalForage.', 'StorageService', { count: quizzes.length }, error as Error);
      try {
        localStorage.setItem(QUIZAI_LEGACY_LOCALSTORAGE_KEY_QUIZZES, JSON.stringify(quizzes));
        logger.warn('Saved quizzes to localStorage as a fallback due to LocalForage error.', 'StorageService', { count: quizzes.length });
      } catch (lsError) {
        logger.error('Error saving quizzes to localStorage after LocalForage failure.', 'StorageService', { count: quizzes.length }, lsError as Error);
      }
    }
  }
};