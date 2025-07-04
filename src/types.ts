import { TokenResponse as GoogleTokenResponse } from '@react-oauth/google';

export interface Question {
  id: string;
  questionText: string;
  options: string[]; 
  correctAnswer: string; 
  explanation: string; 
}

export type AIModelType = 'gemini'; 

export interface Quiz {
  id: string;
  title: string;
  questions: Question[];
  createdAt: string; 
  lastModified: string; 
  sourceContentSnippet?: string; 
  config?: QuizConfig; 
  userId?: string; 
  creator?: { name: string; email?: string };
  isShared?: boolean;
  sharedTimestamp?: string;
}

export interface QuizConfig {
  numQuestions: number;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'AI-Determined';
  language: string; 
  customUserPrompt?: string; 
  selectedModel: AIModelType; 
}

export interface UserAnswer {
  questionId: string;
  answer: string;
}

export interface QuizResult {
  id?: string; 
  quizId: string;
  userId?: string; 
  score: number; 
  answers: UserAnswer[];
  timeTaken?: number; 
  totalCorrect: number;
  totalQuestions: number;
  createdAt?: string; 
  sourceMode?: 'practice' | 'take'; 
}

export type AppView = 'home' | 'dashboard' | 'create-quiz' | 'take-quiz' | 'results' | 'review-quiz' | 'settings' | 'profile';

export type Language = 'en' | 'vi';

export interface UserProfile {
  id: string;
  name?: string | null;
  email?: string | null;
  imageUrl?: string | null;
  accessToken?: string; 
  bio?: string | null;
  quizCount?: number | null;
  completionCount?: number | null;
  averageScore?: number | null;
}

export type SyncState = 'idle' | 'syncing' | 'success' | 'error';

export interface AppContextType {
  currentView: AppView; 
  setCurrentView: (viewPath: string, params?: Record<string, string | number>) => void; 
  
  language: Language;
  setLanguage: (lang: Language) => void;

  quizzes: Quiz[]; 
  addQuiz: (quiz: Quiz) => void;
  deleteQuiz: (quizId: string) => void;
  updateQuiz: (updatedQuiz: Quiz) => void;
  getQuizByIdFromAll: (quizId: string) => Quiz | null; 
  
  activeQuiz: Quiz | null;
  setActiveQuiz: (quiz: Quiz | null) => void;
  
  quizResult: QuizResult | null;
  setQuizResult: (result: QuizResult | null) => void;
  
  currentUser: UserProfile | null;
  login: (user: UserProfile, tokenResponse?: GoogleTokenResponse) => Promise<UserProfile | null>; 
  logout: () => void;
  updateUserProfile: (updatedProfile: Partial<UserProfile>) => Promise<boolean>;

  isLoading: boolean;
  isDriveLoading: boolean; 
  driveSyncError: string | null; 
  lastDriveSync: Date | null; 
  syncWithGoogleDrive: () => Promise<void>; 
  setDriveSyncError: (error: string | null) => void; 
  syncState: SyncState; 
  currentSyncActivityMessage: string | null;
  
  isDriveSyncEnabled: boolean;
  setDriveSyncEnabled: (enabled: boolean) => void;
  driveSyncMode: 'auto' | 'manual' | 'backup-only';
  setDriveSyncMode: (mode: 'auto' | 'manual' | 'backup-only') => void; 

  showSuccessNotification: (message: string, duration?: number, key?: string) => void;
  showErrorNotification: (message: string, duration?: number, key?: string) => void;
}