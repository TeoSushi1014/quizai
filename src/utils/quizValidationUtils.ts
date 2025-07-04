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
      logger.warn('Found quiz with invalid UUID, removing from collection', 'QuizValidation', { 
        quizId: quiz.id, 
        title: quiz.title 
      });
    }
  }

  if (invalidQuizzes.length > 0) {
    logger.info('Cleaned up invalid quizzes from collection', 'QuizValidation', { 
      totalQuizzes: quizzes.length,
      validQuizzes: validQuizzes.length,
      invalidQuizzes: invalidQuizzes.length
    });
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
 * Generates a detailed error message for invalid quiz IDs
 */
export function getInvalidQuizIdError(quizId: string): string {
  if (!quizId) {
    return 'Quiz ID is empty or undefined';
  }
  
  if (typeof quizId !== 'string') {
    return `Quiz ID must be a string, got ${typeof quizId}`;
  }
  
  if (quizId.includes('new-quiz-')) {
    return `Quiz ID appears to be a temporary ID (${quizId}). This should have been replaced with a proper UUID.`;
  }
  
  return `Quiz ID "${quizId}" is not a valid UUID format`;
}
