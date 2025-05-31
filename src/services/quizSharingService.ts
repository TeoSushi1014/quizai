
import { Quiz, Question, UserProfile } from '../types'; // Added UserProfile
import { logger } from './logService';

interface QuizForSharing extends Quiz {
  creator?: { name: string, email?: string }; // Make email optional
  isShared?: boolean;
  sharedTimestamp?: string;
}

/**
 * Chuẩn bị Quiz để chia sẻ - xóa bớt dữ liệu nhạy cảm nếu cần
 */
export const prepareQuizForSharing = (quiz: Quiz, currentUser?: UserProfile | null): QuizForSharing => { // Added currentUser
  const sharedQuiz: QuizForSharing = {
    ...quiz,
    creator: currentUser ? { name: currentUser.name || 'Anonymous' } : { name: 'Anonymous' },
    isShared: true,
    sharedTimestamp: new Date().toISOString()
  };
  
  // Example: remove internal notes or sensitive config if they existed
  // delete sharedQuiz.internalNotes; 

  return sharedQuiz;
};

/**
 * Chia sẻ quiz qua API (nếu có API server)
 */
export const shareQuizViaAPI = async (quiz: Quiz, currentUser?: UserProfile | null): Promise<string> => { // Added currentUser
  try {
    const quizForSharing = prepareQuizForSharing(quiz, currentUser);
    
    // Hypothetical API server integration
    // @ts-ignore
    const apiUrl = typeof import.meta.env !== 'undefined' ? import.meta.env.VITE_API_URL : process.env.REACT_APP_API_URL;
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
      return data.shareUrl || `${window.location.origin}/#/shared/${quiz.id}`; // Fallback to local URL format
    }
    
    // If no API server, simulate by saving to localStorage (for demo purposes on same browser)
    logger.info('No API_URL configured, using localStorage for sharing simulation', 'quizSharingService', { quizId: quiz.id });
    const sharedQuizzes = JSON.parse(localStorage.getItem('quizai_shared_quizzes') || '{}');
    sharedQuizzes[quiz.id] = quizForSharing;
    localStorage.setItem('quizai_shared_quizzes', JSON.stringify(sharedQuizzes));
    
    return `${window.location.origin}/#/shared/${quiz.id}`;
  } catch (error) {
    logger.error('Failed to share quiz', 'quizSharingService', { quizId: quiz.id }, error as Error);
    throw error;
  }
};

/**
 * Lấy quiz từ dữ liệu chia sẻ
 */
export const getSharedQuiz = async (quizId: string): Promise<QuizForSharing | null> => {
  try {
    // Hypothetical API server integration
    // @ts-ignore
    const apiUrl = typeof import.meta.env !== 'undefined' ? import.meta.env.VITE_API_URL : process.env.REACT_APP_API_URL;
    if (apiUrl) {
      logger.info('Fetching shared quiz via API', 'quizSharingService', { quizId, apiUrl });
      const response = await fetch(`${apiUrl}/api/shared-quizzes/${quizId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          logger.warn('Shared quiz not found via API', 'quizSharingService', { quizId });
          return null;
        }
        const errorData = await response.text();
        logger.error('API fetch shared quiz failed', 'quizSharingService', { status: response.status, errorData });
        throw new Error(`Failed to get shared quiz via API: ${response.statusText}`);
      }
      
      const data = await response.json();
      logger.info('Shared quiz fetched via API successfully', 'quizSharingService', { quizId });
      return parseQuizFromSharedJson(data);
    }
    
    // If no API server, lấy từ localStorage chung
    logger.info('No API_URL configured, fetching shared quiz from localStorage simulation', 'quizSharingService', { quizId });
    const sharedQuizzes = JSON.parse(localStorage.getItem('quizai_shared_quizzes') || '{}');
    const quizData = sharedQuizzes[quizId];
    
    if (quizData) {
        return parseQuizFromSharedJson(quizData);
    }
    return null;

  } catch (error) {
    logger.error('Failed to get shared quiz', 'quizSharingService', { quizId }, error as Error);
    return null;
  }
};

/**
 * Parse quiz từ dữ liệu JSON được chia sẻ
 */
export const parseQuizFromSharedJson = (data: any): QuizForSharing => {
  // Validate dữ liệu và đảm bảo có đủ trường cần thiết
  if (!data || typeof data !== 'object' || !data.id || !data.title || !data.questions || !Array.isArray(data.questions)) {
    logger.error('Invalid shared quiz data structure', 'quizSharingService', { dataPreview: JSON.stringify(data).substring(0,100) });
    throw new Error('Invalid shared quiz data structure');
  }
  
  return {
    id: data.id,
    title: data.title,
    questions: data.questions.map((q: any) => ({ // Basic validation for questions
        id: q.id || `q-${Math.random().toString(36).substr(2,9)}`,
        questionText: q.questionText || "",
        options: Array.isArray(q.options) ? q.options : [],
        correctAnswer: q.correctAnswer || "",
        explanation: q.explanation || ""
    })),
    createdAt: data.createdAt || new Date().toISOString(),
    lastModified: data.lastModified || new Date().toISOString(),
    config: data.config || {
      difficulty: 'Medium',
      language: 'English', // Default language
      numQuestions: data.questions.length,
      selectedModel: 'gemini' // Default model
    },
    sourceContentSnippet: data.sourceContentSnippet || '',
    creator: data.creator || { name: 'Unknown' }, // Ensure creator field exists
    isShared: true, // Mark as shared
    sharedTimestamp: data.sharedTimestamp || new Date().toISOString(),
  };
};
