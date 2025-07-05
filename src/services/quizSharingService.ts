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

export const shareQuizViaAPI = async (quiz: Quiz, currentUser?: UserProfile | null): Promise<{ shareUrl: string }> => {
  if (!currentUser) {
    throw new Error('User must be logged in to share quizzes');
  }

  const supabaseService = await import('./supabaseService').then(m => m.supabaseService);
  
  // Use supabaseId - if not available, the authentication system should ensure user has one
  if (!currentUser.supabaseId) {
    throw new Error('User must be properly authenticated with Supabase to share quizzes');
  }

  logger.info('Sharing quiz via Supabase', 'quizSharingService', { 
    quizId: quiz.id, 
    userId: currentUser.supabaseId 
  });

  // Ensure user exists in Supabase
  let userExists = await supabaseService.getUserById(currentUser.supabaseId);
  if (!userExists) {
    logger.info('User not found in Supabase, creating user first', 'quizSharingService', { 
      userId: currentUser.supabaseId 
    });
    userExists = await supabaseService.createUser(currentUser);
  }

  // Ensure quiz exists in Supabase
  const existingUserQuizzes = await supabaseService.getUserQuizzes(currentUser.supabaseId);
  const existingQuiz = existingUserQuizzes.find(q => q.id === quiz.id);
  
  if (existingQuiz) {
    logger.info('Quiz already exists in Supabase, updating it', 'quizSharingService', { 
      quizId: quiz.id 
    });
    await supabaseService.updateQuiz(quiz);
  } else {
    logger.info('Quiz does not exist in Supabase, creating it', 'quizSharingService', { 
      quizId: quiz.id 
    });
    await supabaseService.createQuiz(quiz, currentUser.supabaseId);
  }

  // Share the quiz
  const shareResult = await supabaseService.shareQuiz(quiz.id, true, undefined, currentUser.supabaseId);
  
  if (!shareResult) {
    throw new Error('Failed to create share entry in Supabase');
  }

  logger.info('Quiz shared successfully', 'quizSharingService', { 
    quizId: quiz.id, 
    shareUrl: shareResult.shareUrl,
    shareToken: shareResult.shareToken 
  });

  return { shareUrl: shareResult.shareUrl };
};

export const getSharedQuiz = async (quizId: string, currentUser?: UserProfile | null): Promise<QuizForSharing | null> => {
  if (!quizId || !validateQuizId(quizId)) {
    logger.warn('Invalid quiz ID provided to getSharedQuiz', 'quizSharingService', { quizId });
    return null;
  }

  logger.info('Fetching shared quiz from Supabase', 'quizSharingService', { quizId });
  
  const supabaseService = await import('./supabaseService').then(m => m.supabaseService);
  
  // Try to get from public shared quizzes first
  const publicQuiz = await supabaseService.getPublicQuizById(quizId);
  if (publicQuiz) {
    logger.info('Quiz found as public quiz in Supabase', 'quizSharingService', { quizId });
    
    // Ensure the quiz has a proper title
    if (!publicQuiz.title || publicQuiz.title.trim() === '') {
      publicQuiz.title = 'Shared Quiz';
      logger.info('Updated empty quiz title with fallback', 'quizSharingService', { quizId });
    }
    
    return publicQuiz;
  }

  // If user is logged in, also check their own quizzes
  if (currentUser?.supabaseId) {
    logger.info('Checking user\'s own quizzes', 'quizSharingService', { 
      quizId, 
      userId: currentUser.supabaseId 
    });
    
    const userQuizzes = await supabaseService.getUserQuizzes(currentUser.supabaseId);
    const foundQuiz = userQuizzes.find(quiz => quiz.id === quizId);
    
    if (foundQuiz) {
      logger.info('Quiz found in user Supabase quizzes', 'quizSharingService', { quizId });
      
      // Ensure the quiz has a proper title
      if (!foundQuiz.title || foundQuiz.title.trim() === '') {
        foundQuiz.title = 'Shared Quiz';
        logger.info('Updated empty user quiz title with fallback', 'quizSharingService', { quizId });
      }
      
      return {
        ...foundQuiz,
        creator: { 
          name: currentUser.name || 'Unknown', 
          email: currentUser.email || undefined 
        },
        isShared: true,
        sharedTimestamp: new Date().toISOString()
      };
    }
  }

  logger.warn('Quiz not found in Supabase', 'quizSharingService', { quizId });
  return null;
};

