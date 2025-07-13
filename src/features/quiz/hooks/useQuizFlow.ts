

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Quiz, Question, QuizProgress } from '../../../types';
import { useAppContext } from '../../../App';
import { AttemptSettings } from '../components/QuizCard';
import { quizProgressService } from '../../../services/quizProgressService';
import { logger } from '../../../services/logService';


function shuffleArray<T>(array: T[]): T[] {
  if (!array) return [];
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

const DEFAULT_ATTEMPT_SETTINGS: AttemptSettings = {
  shuffleQuestions: false,
  shuffleAnswers: false,
  timeLimit: '',
};

export const useQuizFlow = (quizIdParam?: string, onTimeUp?: () => void) => {
  const { quizzes, activeQuiz: globalActiveQuiz, setActiveQuiz: setGlobalActiveQuiz, currentUser } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const { quizId: routeQuizId } = useParams<{ quizId?: string }>();
  const quizId = quizIdParam || routeQuizId;

  const [localActiveQuiz, setLocalActiveQuiz] = useState<Quiz | null>(null);
  const [attemptSettingsState, setAttemptSettingsState] = useState<AttemptSettings>(DEFAULT_ATTEMPT_SETTINGS); 
  const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0); 
  const [progressId, setProgressId] = useState<string | null>(null);
  const [quizMode, setQuizMode] = useState<'practice' | 'take'>('take');
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  
  const timerRef = useRef<number | null>(null);
  const elapsedTimerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const progressSaveIntervalRef = useRef<number | null>(null);
  
  // Detect mode based on the route path
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('/practice/')) {
      setQuizMode('practice');
    } else if (path.includes('/take/')) {
      setQuizMode('take');
    }
  }, [location.pathname]);

  const routeAttemptSettingsFromState = (location.state as { attemptSettings?: AttemptSettings } | null)?.attemptSettings;
  const stableRouteAttemptSettings = useMemo(() => {
    return routeAttemptSettingsFromState;
  }, [JSON.stringify(routeAttemptSettingsFromState)]); 

  const loadSavedProgress = useCallback(async () => {
    if (!currentUser?.id || !quizId) return false;
    
    try {
      const progress = await quizProgressService.getQuizProgress(
        currentUser.id, 
        quizId, 
        quizMode
      );
      
      if (!progress) return false;
      
      setProgressId(progress.id || null);
      setCurrentQuestionIndex(progress.currentQuestionIndex);
      setUserAnswers(progress.answers || {});
      setElapsedTime(progress.elapsedTime || 0);
      
      logger.info('Loaded saved quiz progress', 'useQuizFlow', { 
        quizId, 
        userId: currentUser.id,
        currentQuestionIndex: progress.currentQuestionIndex,
        elapsedTime: progress.elapsedTime 
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to load quiz progress', 'useQuizFlow', { quizId, userId: currentUser.id }, error as Error);
      return false;
    }
  }, [currentUser?.id, quizId, quizMode]);

  const saveProgress = useCallback(async (completed = false) => {
    if (!currentUser?.id || !quizId || !localActiveQuiz || isSavingProgress) return;
    
    try {
      setIsSavingProgress(true);
      
      const progress: QuizProgress = {
        id: progressId || undefined,
        quizId,
        userId: currentUser.id,
        currentQuestionIndex,
        answers: userAnswers,
        completed,
        mode: quizMode,
        elapsedTime
      };
      
      const savedId = await quizProgressService.saveQuizProgress(progress);
      
      if (savedId && !progressId) {
        setProgressId(savedId);
      }
      
      logger.info('Saved quiz progress', 'useQuizFlow', { 
        quizId, 
        userId: currentUser.id,
        currentQuestionIndex,
        answersCount: Object.keys(userAnswers).length,
        completed
      });
    } catch (error) {
      logger.error('Failed to save quiz progress', 'useQuizFlow', { quizId, userId: currentUser.id }, error as Error);
    } finally {
      setIsSavingProgress(false);
    }
  }, [currentUser?.id, quizId, localActiveQuiz, progressId, currentQuestionIndex, userAnswers, quizMode, elapsedTime, isSavingProgress]);

  useEffect(() => {
    let mounted = true;
    const loadQuizData = async () => {
      if (!quizId) {
        if (mounted) navigate('/dashboard');
        return;
      }

      const newAttemptSettings = stableRouteAttemptSettings ||
                               (localActiveQuiz?.id === quizId ? attemptSettingsState : DEFAULT_ATTEMPT_SETTINGS);

      if (mounted) {
        if (JSON.stringify(newAttemptSettings) !== JSON.stringify(attemptSettingsState)) {
          setAttemptSettingsState(newAttemptSettings);
        }
      }

      let quizToLoad = globalActiveQuiz && globalActiveQuiz.id === quizId ? globalActiveQuiz : quizzes.find(q => q.id === quizId);

      if (quizToLoad) {
        if (mounted) {
          setLocalActiveQuiz(quizToLoad);
          if (!globalActiveQuiz || globalActiveQuiz.id !== quizToLoad.id) {
            setGlobalActiveQuiz(quizToLoad);
          }

          let questionsToUse = quizToLoad.questions;
          if (newAttemptSettings.shuffleQuestions) {
            questionsToUse = shuffleArray([...quizToLoad.questions]);
          }
          setShuffledQuestions(questionsToUse);
          
          // Try to load saved progress for logged-in users
          if (currentUser?.id) {
            const progressLoaded = await loadSavedProgress();
            if (!progressLoaded) {
              setCurrentQuestionIndex(0);
              setUserAnswers({});
            }
          } else {
            setCurrentQuestionIndex(0);
          }

          if (newAttemptSettings.timeLimit !== '' && Number(newAttemptSettings.timeLimit) > 0) {
            setTimeLeft(Number(newAttemptSettings.timeLimit) * 60);
          } else {
            setTimeLeft(null);
          }
        }
      } else {
        if (mounted) navigate('/dashboard');
      }
      if (mounted) setLoading(false);
    };

    loadQuizData();
    return () => {
      mounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      if (progressSaveIntervalRef.current) clearInterval(progressSaveIntervalRef.current);
    };
  }, [quizId, quizzes, globalActiveQuiz, navigate, setGlobalActiveQuiz, stableRouteAttemptSettings, localActiveQuiz?.id, attemptSettingsState, loadSavedProgress, currentUser?.id]); 

  // Start elapsed time tracking and progress auto-saving when quiz loads
  useEffect(() => {
    if (localActiveQuiz && !loading) {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
        if (elapsedTime === 0) {
          setElapsedTime(0);
        }
      }
      
      // Start elapsed time counter
      elapsedTimerRef.current = window.setInterval(() => {
        const currentTime = Date.now();
        const elapsed = Math.floor((currentTime - startTimeRef.current!) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
      
      // Set up auto-save interval if user is logged in
      if (currentUser?.id) {
        progressSaveIntervalRef.current = window.setInterval(() => {
          saveProgress(false);
        }, 30000); // Save progress every 30 seconds
      }
      
      return () => {
        if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
        if (progressSaveIntervalRef.current) clearInterval(progressSaveIntervalRef.current);
      };
    }
  }, [localActiveQuiz, loading, elapsedTime, currentUser?.id, saveProgress]);

  // Cleanup all intervals and timers on unmount
  useEffect(() => {
    return () => {
      startTimeRef.current = null;
      if (timerRef.current) clearInterval(timerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      if (progressSaveIntervalRef.current) clearInterval(progressSaveIntervalRef.current);
    };
  }, []);

  // Time limit management
  useEffect(() => {
    if (timeLeft === null) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    if (timeLeft <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (localActiveQuiz && onTimeUp) {
        onTimeUp();
      }
      return;
    }
    timerRef.current = window.setInterval(() => {
      setTimeLeft(prevTime => (prevTime ? prevTime - 1 : 0));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLeft, localActiveQuiz, onTimeUp]);

  const currentQuestion = useMemo(() => {
    if (!shuffledQuestions || shuffledQuestions.length === 0 || currentQuestionIndex >= shuffledQuestions.length) return undefined;
    const question = shuffledQuestions[currentQuestionIndex];
    if (question && attemptSettingsState.shuffleAnswers) { 
      return { ...question, options: shuffleArray([...question.options]) };
    }
    return question;
  }, [shuffledQuestions, currentQuestionIndex, attemptSettingsState.shuffleAnswers]); 

  const goToNextQuestion = useCallback(() => {
    if (currentQuestionIndex < shuffledQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      
      // Save progress when moving to next question if user is logged in
      if (currentUser?.id) {
        saveProgress(false);
      }
      
      return true;
    }
    return false;
  }, [currentQuestionIndex, shuffledQuestions.length, currentUser?.id, saveProgress]);

  const goToPreviousQuestion = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      return true;
    }
    return false;
  }, [currentQuestionIndex]);

  const updateUserAnswer = useCallback((questionId: string, answer: string) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  }, []);
  
  const markQuizCompleted = useCallback(async () => {
    if (currentUser?.id && quizId) {
      await saveProgress(true);
    }
  }, [currentUser?.id, quizId, saveProgress]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    localActiveQuiz,
    shuffledQuestions,
    currentQuestion,
    currentQuestionIndex,
    userAnswers,
    loading,
    timeLeft,
    elapsedTime,
    attemptSettings: attemptSettingsState, 
    goToNextQuestion,
    goToPreviousQuestion,
    updateUserAnswer,
    formatTime,
    totalQuestions: shuffledQuestions.length,
    setShuffledQuestions,
    setCurrentQuestionIndex,
    saveProgress,
    markQuizCompleted,
    quizMode
  };
};