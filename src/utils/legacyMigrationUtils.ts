import { Quiz } from '../types';
import { generateQuizId } from './uuidUtils';
import { isLegacyQuizId, getQuizValidationStats } from './quizValidationUtils';
import { logger } from '../services/logService';

/**
 * Migrates legacy quiz IDs to proper UUIDs
 * This can be used as a one-time migration for existing users
 */
export function migrateLegacyQuizIds(quizzes: Quiz[]): {
  migratedQuizzes: Quiz[];
  migrationReport: {
    totalQuizzes: number;
    migrated: number;
    alreadyValid: number;
    errors: number;
  };
} {
  const migratedQuizzes: Quiz[] = [];
  const migrationReport = {
    totalQuizzes: quizzes.length,
    migrated: 0,
    alreadyValid: 0,
    errors: 0
  };

  const stats = getQuizValidationStats(quizzes);
  logger.info('Starting legacy quiz ID migration', 'LegacyMigration', stats);

  for (const quiz of quizzes) {
    try {
      if (isLegacyQuizId(quiz.id)) {
        // Generate a new UUID for this quiz
        const newId = generateQuizId();
        const migratedQuiz: Quiz = {
          ...quiz,
          id: newId,
          lastModified: new Date().toISOString() // Update last modified to indicate migration
        };
        
        migratedQuizzes.push(migratedQuiz);
        migrationReport.migrated++;
        
        logger.info('Migrated legacy quiz ID', 'LegacyMigration', {
          oldId: quiz.id,
          newId: newId,
          title: quiz.title
        });
      } else {
        // Quiz already has valid ID, keep as is
        migratedQuizzes.push(quiz);
        migrationReport.alreadyValid++;
      }
    } catch (error) {
      logger.error('Error migrating quiz', 'LegacyMigration', {
        quizId: quiz.id,
        title: quiz.title
      }, error as Error);
      migrationReport.errors++;
      
      // For errored quizzes, try to keep them if they have valid IDs
      if (quiz.id && typeof quiz.id === 'string' && quiz.id.length > 0) {
        migratedQuizzes.push(quiz);
      }
    }
  }

  logger.info('Legacy quiz ID migration completed', 'LegacyMigration', migrationReport);
  return { migratedQuizzes, migrationReport };
}

/**
 * Checks if migration is needed for a collection of quizzes
 */
export function needsLegacyMigration(quizzes: Quiz[]): boolean {
  return quizzes.some(quiz => isLegacyQuizId(quiz.id));
}
