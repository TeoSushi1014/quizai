
import { Quiz, Question, QuizConfig } from '../../types';
import { getTranslator, translations } from '../../i18n'; // For default new question text

// Helper to get translations within the reducer if needed for default values
// Assuming 'en' as a fallback or a way to get current language if reducer was part of a context
const t = getTranslator('en'); // Or pass lang if available

export interface QuizReviewState {
  editableQuiz: Quiz | null;
  originalQuiz: Quiz | null; // To support reset/isDirty comparison
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  isDirty: boolean;
}

export type QuizReviewAction =
  | { type: 'INIT_QUIZ_DATA'; payload: { quiz: Quiz; language: keyof typeof translations } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'UPDATE_QUIZ_TITLE'; payload: string }
  | { type: 'UPDATE_QUESTION'; payload: { index: number; question: Question } }
  | { type: 'ADD_QUESTION'; payload: { language: keyof typeof translations } }
  | { type: 'REMOVE_QUESTION'; payload: { index: number } }
  | { type: 'RESET_QUIZ_STATE' };

export const initialQuizReviewState: QuizReviewState = {
  editableQuiz: null,
  originalQuiz: null,
  isLoading: true,
  isSaving: false,
  error: null,
  isDirty: false,
};

export function quizReducer(state: QuizReviewState, action: QuizReviewAction): QuizReviewState {
  switch (action.type) {
    case 'INIT_QUIZ_DATA':
      return {
        ...initialQuizReviewState,
        editableQuiz: JSON.parse(JSON.stringify(action.payload.quiz)), // Deep copy for editing
        originalQuiz: JSON.parse(JSON.stringify(action.payload.quiz)), // Deep copy for reference
        isLoading: false,
        isDirty: false,
      };

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, isSaving: false };

    case 'SET_SAVING':
      return { ...state, isSaving: action.payload };

    case 'UPDATE_QUIZ_TITLE':
      if (!state.editableQuiz) return state;
      return {
        ...state,
        editableQuiz: { ...state.editableQuiz, title: action.payload },
        isDirty: true,
      };

    case 'UPDATE_QUESTION':
      if (!state.editableQuiz) return state;
      const updatedQuestions = [...state.editableQuiz.questions];
      updatedQuestions[action.payload.index] = action.payload.question;
      return {
        ...state,
        editableQuiz: { ...state.editableQuiz, questions: updatedQuestions },
        isDirty: true,
      };

    case 'ADD_QUESTION':
      if (!state.editableQuiz) return state;
      const tInstance = getTranslator(action.payload.language);
      const newQuestion: Question = {
        id: `manual-q-${Date.now()}`,
        questionText: tInstance('reviewNewQuestionDefaultText'),
        options: [tInstance('reviewNewOptionDefault', { index: 1 }), tInstance('reviewNewOptionDefault', { index: 2 })],
        correctAnswer: tInstance('reviewNewOptionDefault', { index: 1 }),
        explanation: tInstance('reviewNewExplanationDefaultText'),
      };
      return {
        ...state,
        editableQuiz: {
          ...state.editableQuiz,
          questions: [...state.editableQuiz.questions, newQuestion],
        },
        isDirty: true,
      };

    case 'REMOVE_QUESTION':
      if (!state.editableQuiz || state.editableQuiz.questions.length <= 1) {
        // Prevent removing the last question from reducer to avoid empty questions array directly
        // The component should handle the alert/error message for this case.
        return { ...state, error: getTranslator(state.editableQuiz?.config?.language === "Vietnamese" ? 'vi' : 'en')('reviewCannotSaveNoQuestions') };
      }
      const filteredQuestions = state.editableQuiz.questions.filter(
        (_, index) => index !== action.payload.index
      );
      return {
        ...state,
        editableQuiz: { ...state.editableQuiz, questions: filteredQuestions },
        error: null, // Clear error if successfully removed
        isDirty: true,
      };

    case 'RESET_QUIZ_STATE':
      if (!state.originalQuiz) return state;
      return {
        ...state,
        editableQuiz: JSON.parse(JSON.stringify(state.originalQuiz)), // Reset to deep copy of original
        isDirty: false,
        error: null,
      };

    default:
      return state;
  }
}
