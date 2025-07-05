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

    if (currentUser) {
      logger.info('User is logged in, fetching quiz from Supabase', 'quizSharingService', { quizId, userId: currentUser.id });
      
      try {
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
        
        logger.info('Quiz not found in user Supabase quizzes, checking other users', 'quizSharingService', { quizId });
        
        const publicQuiz = await supabaseService.getPublicQuizById(quizId);
        if (publicQuiz) {
          logger.info('Quiz found as public quiz in Supabase', 'quizSharingService', { quizId });
          return publicQuiz;
        }
        
      } catch (supabaseError) {
        logger.error('Error fetching quiz from Supabase', 'quizSharingService', { quizId }, supabaseError as Error);
      }
    }

    // @ts-ignore
    const apiUrl = typeof import.meta.env !== 'undefined' ? import.meta.env.VITE_API_URL : undefined;
    
    if (apiUrl) {
      logger.info('Fetching shared quiz via API', 'quizSharingService', { quizId, apiUrl });
      
      try {
        const response = await fetch(`${apiUrl}/api/shared-quizzes/${quizId}`);
        
        if (response.ok) {
          const data = await response.json();
          logger.info('Shared quiz fetched via API successfully', 'quizSharingService', { quizId });
          return parseQuizFromSharedJson(data);
        } else if (response.status === 404) {
          logger.warn('Shared quiz not found via API', 'quizSharingService', { quizId });
        } else {
          const errorData = await response.text();
          logger.error('API fetch shared quiz failed', 'quizSharingService', { status: response.status, errorData });
        }
      } catch (apiError) {
        logger.error('API request failed', 'quizSharingService', { quizId }, apiError as Error);
      }
    }
    
    logger.info('Fetching shared quiz from localStorage', 'quizSharingService', { quizId });
    return await getSharedQuizLocally(quizId);

  } catch (error) {
    logger.error('Failed to get shared quiz', 'quizSharingService', { quizId }, error as Error);
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