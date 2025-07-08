import { Quiz } from '../types';
import { isValidUUID } from './uuidUtils';
import { logger } from '../services/logService';

/**
 * Validates and cleans up quiz data, removing any quizzes with invalid IDs
 */
export function validateAndCleanQuizzes(quizzes: Quiz[]): Quiz[] {
  const validQuizzes: Quiz[] = [];
  const invalidQuizzes: Quiz[] = [];

  for (const quiz of quizzes) {
    if (isValidUUID(quiz.id)) {
      validQuizzes.push(quiz);
    } else {
      invalidQuizzes.push(quiz);
      if (quiz.id.startsWith('new-quiz-')) {
        logger.warn('Found legacy quiz with old ID format', 'QuizValidation', { 
          quizId: quiz.id, 
          title: quiz.title
        });
      } else {
        logger.warn('Found quiz with invalid UUID', 'QuizValidation', { 
          quizId: quiz.id, 
          title: quiz.title
        });
      }
    }
  }

  return validQuizzes;
}

/**
 * Validates a single quiz ID
 */
export function validateQuizId(quizId: string): boolean {
  return isValidUUID(quizId);
}

/**
 * Checks if a quiz ID is a legacy format
 */
export function isLegacyQuizId(quizId: string): boolean {
  return typeof quizId === 'string' && quizId.startsWith('new-quiz-') && /^new-quiz-\d+$/.test(quizId);
}

/**
 * Generates a detailed error message for invalid quiz IDs
 */
export function getInvalidQuizIdError(quizId: string): string {
  if (!quizId) {
    return 'Quiz ID is empty or undefined';
  }
  
  if (typeof quizId !== 'string') {
    return `Quiz ID must be a string, got ${typeof quizId}`;
  }
  
  if (isLegacyQuizId(quizId)) {
    return `Quiz ID is in legacy format (${quizId}). This quiz was created before the UUID system was implemented and should be migrated or removed.`;
  }
  
  return `Quiz ID "${quizId}" is not a valid UUID format`;
}

/**
 * Gets statistics about quiz ID validity in a collection
 */
export function getQuizValidationStats(quizzes: Quiz[]): {
  total: number;
  valid: number;
  legacy: number;
  invalid: number;
} {
  const stats = {
    total: quizzes.length,
    valid: 0,
    legacy: 0,
    invalid: 0
  };

  for (const quiz of quizzes) {
    if (isValidUUID(quiz.id)) {
      stats.valid++;
    } else if (isLegacyQuizId(quiz.id)) {
      stats.legacy++;
    } else {
      stats.invalid++;
    }
  }

  return stats;
}
