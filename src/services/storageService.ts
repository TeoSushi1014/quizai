import localforage from 'localforage';
import { Quiz } from '../types';
import { logger } from './logService';
import { validateAndCleanQuizzes } from '../utils/quizValidationUtils';
import { migrateLegacyQuizIds, needsLegacyMigration } from '../utils/legacyMigrationUtils';

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
        
        // Check if migration is needed for legacy quiz IDs
        if (needsLegacyMigration(quizzesLF)) {
          logger.info('Legacy quiz IDs detected, performing migration', 'StorageService');
          const { migratedQuizzes, migrationReport } = migrateLegacyQuizIds(quizzesLF);
          
          // Save migrated data back to storage
          await localforage.setItem(QUIZAI_LOCALFORAGE_KEY_QUIZZES, migratedQuizzes);
          logger.info('Legacy quiz migration completed and saved', 'StorageService', migrationReport);
          
          return migratedQuizzes;
        }
        
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
        
        // Check if migration is needed for legacy quiz IDs
        if (needsLegacyMigration(parsedQuizzes)) {
          logger.info('Legacy quiz IDs detected in localStorage, performing migration', 'StorageService');
          const { migratedQuizzes, migrationReport } = migrateLegacyQuizIds(parsedQuizzes);
          
          // Save migrated data to LocalForage and update localStorage
          await localforage.setItem(QUIZAI_LOCALFORAGE_KEY_QUIZZES, migratedQuizzes);
          localStorage.setItem(QUIZAI_LEGACY_LOCALSTORAGE_KEY_QUIZZES, JSON.stringify(migratedQuizzes));
          logger.info('Legacy quiz migration completed and saved to both storage systems', 'StorageService', migrationReport);
          
          return migratedQuizzes;
        }
        
        // Validate and clean quizzes
        const validQuizzes = validateAndCleanQuizzes(parsedQuizzes);
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
          
          // Check for migration even in fallback scenario
          if (needsLegacyMigration(parsedFallback)) {
            logger.info('Legacy quiz IDs detected in fallback localStorage, performing migration', 'StorageService');
            const { migratedQuizzes } = migrateLegacyQuizIds(parsedFallback);
            localStorage.setItem(QUIZAI_LEGACY_LOCALSTORAGE_KEY_QUIZZES, JSON.stringify(migratedQuizzes));
            return migratedQuizzes;
          }
          
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