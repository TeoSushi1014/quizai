import { Quiz, UserProfile } from '../types';
import { logger } from './logService';
import { validateQuizId } from '../utils/quizValidationUtils';

interface QuizForSharing extends Quiz {
  creator?: { name: string, email?: string };
  isShared?: boolean;
  sharedTimestamp?: string;
}

export const prepareQuizForSharing = (quiz: Quiz, currentUser?: UserProfile | null): QuizForSharing => {
  if (!quiz.id || !validateQuizId(quiz.id)) {
    throw new Error('Cannot share quiz: Invalid quiz ID format');
  }

  if (!quiz.questions || quiz.questions.length === 0) {
    throw new Error('Cannot share quiz: Quiz has no questions');
  }

  const sharedQuiz: QuizForSharing = {
    ...quiz,
    creator: currentUser ? { 
      name: currentUser.name || 'Anonymous',
      email: currentUser.email || undefined
    } : { name: 'Anonymous' },
    isShared: true,
    sharedTimestamp: new Date().toISOString()
  };
  return sharedQuiz;
};

export const shareQuizViaAPI = async (quiz: Quiz, currentUser?: UserProfile | null): Promise<{ shareUrl: string; isDemo: boolean }> => {
  try {
    if (!currentUser) {
      throw new Error('User must be logged in to share quizzes');
    }
    
    // First save the quiz to Supabase if it doesn't exist there
    logger.info('Ensuring quiz exists in Supabase before sharing', 'quizSharingService', { quizId: quiz.id });
    
    const supabaseService = await import('./supabaseService').then(m => m.supabaseService);
    
    // Check if user exists in Supabase first
    let userExists = await supabaseService.getUserById(currentUser.id);
    if (!userExists) {
      logger.info('User not found in Supabase, creating user first', 'quizSharingService', { userId: currentUser.id });
      userExists = await supabaseService.createUser(currentUser);
    }
    
    // Always try to create/update quiz to ensure it exists
    logger.info('Ensuring quiz exists in Supabase database', 'quizSharingService', { quizId: quiz.id });
    
    // First check if quiz already exists
    const existingUserQuizzes = await supabaseService.getUserQuizzes(currentUser.id);
    const existingQuiz = existingUserQuizzes.find(q => q.id === quiz.id);
    
    let quizOperationResult = null;
    
    if (existingQuiz) {
      logger.info('Quiz already exists in Supabase, updating it', 'quizSharingService', { quizId: quiz.id });
      quizOperationResult = await supabaseService.updateQuiz(quiz);
    } else {
      logger.info('Quiz does not exist in Supabase, creating it', 'quizSharingService', { quizId: quiz.id });
      quizOperationResult = await supabaseService.createQuiz(quiz, currentUser.id);
      
      // If creation failed (possibly due to concurrent creation), try to update
      if (!quizOperationResult) {
        logger.info('Quiz creation failed, attempting to update in case it was created concurrently', 'quizSharingService', { quizId: quiz.id });
        quizOperationResult = await supabaseService.updateQuiz(quiz);
      }
    }
    
    // Verify quiz exists now
    try {
      const verifyQuizzes = await supabaseService.getUserQuizzes(currentUser.id);
      const finalQuizCheck = verifyQuizzes.find(q => q.id === quiz.id);
      if (!finalQuizCheck) {
        throw new Error('Quiz still not found in Supabase after creation/update attempts');
      }
      logger.info('Quiz verified to exist in Supabase', 'quizSharingService', { quizId: quiz.id });
    } catch (verifyError) {
      logger.error('Failed to verify quiz exists in Supabase', 'quizSharingService', { quizId: quiz.id }, verifyError as Error);
      throw new Error('Unable to ensure quiz exists in Supabase database');
    }
    
    // Now share the quiz via Supabase
    logger.info('Starting quiz share process in Supabase', 'quizSharingService', { quizId: quiz.id });
    const shareResult = await supabaseService.shareQuiz(quiz.id);
    
    if (shareResult) {
      logger.info('Quiz shared via Supabase successfully', 'quizSharingService', { 
        quizId: quiz.id, 
        shareUrl: shareResult.shareUrl,
        shareToken: shareResult.shareToken 
      });
      return { shareUrl: shareResult.shareUrl, isDemo: false };
    } else {
      logger.error('shareQuiz returned null - check Supabase logs', 'quizSharingService', { quizId: quiz.id });
      throw new Error('Failed to create share entry in Supabase - shareQuiz returned null');
    }
    
  } catch (error) {
    logger.error('Failed to share quiz', 'quizSharingService', { quizId: quiz.id }, error as Error);
    throw error;
  }
};

export const getSharedQuiz = async (quizId: string, currentUser?: UserProfile | null): Promise<QuizForSharing | null> => {
  try {
    if (!quizId || !validateQuizId(quizId)) {
      logger.warn('Invalid quiz ID provided to getSharedQuiz', 'quizSharingService', { quizId });
      return null;
    }

    logger.info('Fetching shared quiz from Supabase', 'quizSharingService', { quizId });
    
    const supabaseService = await import('./supabaseService').then(m => m.supabaseService);
    
    // Try to get from public shared quizzes
    const publicQuiz = await supabaseService.getPublicQuizById(quizId);
    if (publicQuiz) {
      logger.info('Quiz found as public quiz in Supabase', 'quizSharingService', { quizId });
      return publicQuiz;
    }

    // If user is logged in, also check their own quizzes
    if (currentUser) {
      logger.info('Also checking user\'s own quizzes', 'quizSharingService', { quizId, userId: currentUser.id });
      const userQuizzes = await supabaseService.getUserQuizzes(currentUser.id);
      const foundQuiz = userQuizzes.find(quiz => quiz.id === quizId);
      
      if (foundQuiz) {
        logger.info('Quiz found in user Supabase quizzes', 'quizSharingService', { quizId });
        return {
          ...foundQuiz,
          creator: { name: currentUser.name || 'Unknown', email: currentUser.email || undefined },
          isShared: true,
          sharedTimestamp: new Date().toISOString()
        };
      }
    }

    logger.warn('Quiz not found in Supabase', 'quizSharingService', { quizId });
    return null;
    
  } catch (error) {
    logger.error('Error fetching shared quiz from Supabase', 'quizSharingService', { quizId }, error as Error);
    return null;
  }
};