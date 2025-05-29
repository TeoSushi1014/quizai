
// Removed QuestionType enum
// export enum QuestionType {
//   MultipleChoice = 'multiple-choice',
//   OpenEnded = 'open-ended',
// }

export interface Question {
  id: string;
  questionText: string;
  options: string[]; // Kept for multiple-choice
  correctAnswer: string; // For multiple choice, this will be the option text.
  // questionType: QuestionType; // Removed
  explanation: string; // AI-generated explanation
}

export type AIModelType = 'gemini'; // Only Gemini is supported now

export interface Quiz {
  id: string;
  title: string;
  questions: Question[];
  createdAt: string; // ISO date string
  sourceContentSnippet?: string; // Snippet of source for context
  config?: QuizConfig; // Configuration used for generating this quiz
  userId?: string; // Optional: for associating with a logged-in user (frontend simulation)
}

export interface QuizConfig {
  numQuestions: number;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'AI-Determined';
  // questionTypes: QuestionType[]; // Removed
  language: string; // e.g., 'English'
  // timeLimit?: number; // Removed: Will be a per-attempt setting
  customUserPrompt?: string; // User-provided detailed prompt
  selectedModel: AIModelType; // Still kept for structure, but will always be 'gemini'
  // shuffleQuestions?: boolean; // Removed: Will be a per-attempt setting
  // shuffleAnswers?: boolean; // Removed: Will be a per-attempt setting
}

export interface UserAnswer {
  questionId: string;
  answer: string;
}

export interface QuizResult {
  id?: string; // Added for database purposes
  quizId: string;
  userId?: string; // Added for database association
  score: number; // Percentage
  answers: UserAnswer[];
  timeTaken?: number; // in seconds
  totalCorrect: number;
  totalQuestions: number;
  createdAt?: string; // ISO date string - For when the result record itself was created
  sourceMode?: 'practice' | 'take'; // To distinguish the origin of the result
}

export type AppView = 'home' | 'dashboard' | 'create-quiz' | 'take-quiz' | 'results' | 'review-quiz' | 'settings'; // Added 'settings'

export type Language = 'en' | 'vi';

export interface UserProfile {
  id: string;
  name?: string | null;
  email?: string | null;
  imageUrl?: string | null;
  accessToken?: string; // Added to store Google Access Token
}

export interface AppContextType {
  currentView: AppView; 
  setCurrentView: (viewPath: string, params?: Record<string, string | number>) => void; 
  
  language: Language;
  setLanguage: (lang: Language) => void;

  quizzes: Quiz[];
  addQuiz: (quiz: Quiz) => void;
  deleteQuiz: (quizId: string) => void;
  updateQuiz: (updatedQuiz: Quiz) => void;
  
  activeQuiz: Quiz | null;
  setActiveQuiz: (quiz: Quiz | null) => void;
  
  quizResult: QuizResult | null;
  setQuizResult: (result: QuizResult | null) => void;
  
  currentUser: UserProfile | null;
  login: (user: UserProfile, token?: string) => void; // Added token parameter
  logout: () => void;

  isGeminiKeyAvailable: boolean;
  isLoading: boolean;
  isDriveLoading: boolean; // Added for Drive operations
  driveSyncError: string | null; // To display Drive sync errors
  lastDriveSync: Date | null; // Timestamp of last successful sync
  syncWithGoogleDrive: () => Promise<void>; // Manual sync function
  setDriveSyncError: (error: string | null) => void; // Function to set Drive sync error
}
