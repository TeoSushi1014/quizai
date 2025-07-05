import { Quiz, UserProfile } from '../types';
import { logger } from './logService';
import { validateQuizId } from '../utils/quizValidationUtils';
import { SupabaseService } from './supabaseService';

interface QuizForSharing extends Quiz {
  creator?: { name: string, email?: string };
  isShared?: boolean;
  sharedTimestamp?: string;
}

const SHARED_QUIZ_STORAGE_KEY = 'quizai_shared_quizzes_v2';
const supabaseService = new SupabaseService();

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
    const quizForSharing = prepareQuizForSharing(quiz, currentUser);
    
    // Try to share via Supabase first
    try {
      logger.info('Attempting to share quiz via Supabase', 'quizSharingService', { quizId: quiz.id });
      
      const supabaseService = await import('./supabaseService').then(m => m.supabaseService);
      const shareResult = await supabaseService.shareQuiz(quiz.id);
      
      if (shareResult) {
        logger.info('Quiz shared via Supabase successfully', 'quizSharingService', { 
          quizId: quiz.id, 
          shareUrl: shareResult.shareUrl 
        });
        return { shareUrl: shareResult.shareUrl, isDemo: false };
      }
    } catch (supabaseError) {
      logger.warn('Supabase sharing failed, falling back to API/localStorage', 'quizSharingService', { 
        quizId: quiz.id 
      }, supabaseError as Error);
    }
    
    // @ts-ignore
    const apiUrl = typeof import.meta.env !== 'undefined' ? import.meta.env.VITE_API_URL : undefined;
    
    if (apiUrl) {
      logger.info('Sharing quiz via API', 'quizSharingService', { quizId: quiz.id, apiUrl });
      
      const response = await fetch(`${apiUrl}/api/shared-quizzes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(quizForSharing),
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        logger.error('API share failed', 'quizSharingService', { status: response.status, errorData });
        throw new Error(`Failed to share quiz via API: ${response.statusText}`);
      }
      
      const data = await response.json();
      logger.info('Quiz shared via API successfully', 'quizSharingService', { quizId: quiz.id, shareUrl: data.shareUrl });
      return { shareUrl: data.shareUrl || `${window.location.origin}${window.location.pathname}#/shared/${quiz.id}`, isDemo: false };
    }
    
    logger.info('No API_URL configured, using localStorage for sharing simulation', 'quizSharingService', { quizId: quiz.id });
    return await shareQuizLocally(quizForSharing);
    
  } catch (error) {
    logger.error('Failed to share quiz', 'quizSharingService', { quizId: quiz.id }, error as Error);
    throw error;
  }
};

const shareQuizLocally = async (quizForSharing: QuizForSharing): Promise<{ shareUrl: string; isDemo: boolean }> => {
  try {
    const sharedQuizzes = JSON.parse(localStorage.getItem(SHARED_QUIZ_STORAGE_KEY) || '{}');
    sharedQuizzes[quizForSharing.id] = quizForSharing;
    localStorage.setItem(SHARED_QUIZ_STORAGE_KEY, JSON.stringify(sharedQuizzes));
    
    logger.info('Quiz shared locally', 'quizSharingService', { quizId: quizForSharing.id });
    
    return { 
      shareUrl: `${window.location.origin}${window.location.pathname}#/shared/${quizForSharing.id}`, 
      isDemo: true 
    };
  } catch (error) {
    logger.error('Failed to share quiz locally', 'quizSharingService', { quizId: quizForSharing.id }, error as Error);
    throw error;
  }
};

export const getSharedQuiz = async (quizId: string, currentUser?: UserProfile | null): Promise<QuizForSharing | null> => {
  try {
    if (!quizId || !validateQuizId(quizId)) {
      logger.warn('Invalid quiz ID provided to getSharedQuiz', 'quizSharingService', { quizId });
      return null;
    }

    // For logged-in users, try Supabase first
    if (currentUser) {
      logger.info('User is logged in, fetching quiz from Supabase', 'quizSharingService', { quizId, userId: currentUser.id });
      
      try {
        // First try to get from user's own quizzes
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
        
        // Then try to get from public quizzes
        logger.info('Quiz not found in user Supabase quizzes, checking public quizzes', 'quizSharingService', { quizId });
        const publicQuiz = await supabaseService.getPublicQuizById(quizId);
        if (publicQuiz) {
          logger.info('Quiz found as public quiz in Supabase', 'quizSharingService', { quizId });
          return publicQuiz;
        }
        
      } catch (supabaseError) {
        logger.error('Supabase connection failed, falling back to localStorage', 'quizSharingService', { quizId }, supabaseError as Error);
        // Continue to localStorage fallback
      }
    } else {
      logger.info('User not logged in, checking localStorage only', 'quizSharingService', { quizId });
    }

    // Fallback to localStorage for both logged-in (if Supabase fails) and non-logged-in users
    logger.info('Attempting to fetch quiz from localStorage', 'quizSharingService', { quizId });
    const localQuiz = await getSharedQuizLocally(quizId);
    if (localQuiz) {
      logger.info('Quiz found in localStorage', 'quizSharingService', { quizId });
      return localQuiz;
    }

    logger.warn('Quiz not found in any storage location', 'quizSharingService', { quizId });
    return null;
    
  } catch (error) {
    logger.error('Unexpected error in getSharedQuiz', 'quizSharingService', { quizId }, error as Error);
    return null;
  }
};

const getSharedQuizLocally = async (quizId: string): Promise<QuizForSharing | null> => {
  try {
    const sharedQuizzes = JSON.parse(localStorage.getItem(SHARED_QUIZ_STORAGE_KEY) || '{}');
    const quizData = sharedQuizzes[quizId];
    
    if (quizData) {
      logger.info('Shared quiz found in localStorage', 'quizSharingService', { quizId });
      return parseQuizFromSharedJson(quizData);
    }
    
    const legacySharedQuizzes = JSON.parse(localStorage.getItem('quizai_shared_quizzes') || '{}');
    const legacyQuizData = legacySharedQuizzes[quizId];
    
    if (legacyQuizData) {
      logger.info('Shared quiz found in legacy localStorage', 'quizSharingService', { quizId });
      const parsedQuiz = parseQuizFromSharedJson(legacyQuizData);
      
      const newSharedQuizzes = JSON.parse(localStorage.getItem(SHARED_QUIZ_STORAGE_KEY) || '{}');
      newSharedQuizzes[quizId] = parsedQuiz;
      localStorage.setItem(SHARED_QUIZ_STORAGE_KEY, JSON.stringify(newSharedQuizzes));
      
      return parsedQuiz;
    }
    
    logger.warn('Shared quiz not found in localStorage', 'quizSharingService', { quizId });
    return null;
  } catch (error) {
    logger.error('Failed to get shared quiz from localStorage', 'quizSharingService', { quizId }, error as Error);
    return null;
  }
};

export const parseQuizFromSharedJson = (data: any): QuizForSharing => {
  if (!data || typeof data !== 'object' || !data.id || !data.title || !data.questions || !Array.isArray(data.questions)) {
    logger.error('Invalid shared quiz data structure', 'quizSharingService', { dataPreview: JSON.stringify(data).substring(0,100) });
    throw new Error('Invalid shared quiz data structure');
  }
  
  if (!validateQuizId(data.id)) {
    logger.error('Shared quiz has invalid ID format', 'quizSharingService', { quizId: data.id });
    throw new Error('Shared quiz has invalid ID format');
  }
  
  return {
    id: data.id,
    title: data.title,
    questions: data.questions.map((q: any, index: number) => ({ 
        id: q.id || `q-${data.id}-${index}`,
        questionText: q.questionText || "",
        options: Array.isArray(q.options) ? q.options : [],
        correctAnswer: q.correctAnswer || "",
        explanation: q.explanation || ""
    })),
    createdAt: data.createdAt || new Date().toISOString(),
    lastModified: data.lastModified || new Date().toISOString(),
    config: data.config || {
      difficulty: 'Medium',
      language: 'English', 
      numQuestions: data.questions.length,
      selectedModel: 'gemini' 
    },
    sourceContentSnippet: data.sourceContentSnippet || '',
    creator: data.creator || { name: 'Unknown' }, 
    isShared: true, 
    sharedTimestamp: data.sharedTimestamp || new Date().toISOString(),
  };
};

export const listSharedQuizzes = (): string[] => {
  try {
    const sharedQuizzes = JSON.parse(localStorage.getItem(SHARED_QUIZ_STORAGE_KEY) || '{}');
    return Object.keys(sharedQuizzes);
  } catch (error) {
    logger.error('Failed to list shared quizzes', 'quizSharingService', undefined, error as Error);
    return [];
  }
};

export const clearSharedQuizzes = (): void => {
  try {
    localStorage.removeItem(SHARED_QUIZ_STORAGE_KEY);
    localStorage.removeItem('quizai_shared_quizzes');
    logger.info('Cleared all shared quizzes', 'quizSharingService');
  } catch (error) {
    logger.error('Failed to clear shared quizzes', 'quizSharingService', undefined, error as Error);
  }
};