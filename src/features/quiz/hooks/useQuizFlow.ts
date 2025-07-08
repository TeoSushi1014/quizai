

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Quiz, Question } from '../../../types';
import { useAppContext } from '../../../App';
import { AttemptSettings } from '../components/QuizCard';


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
  timeLimit: 0,
};

export const useQuizFlow = (quizIdParam?: string, onTimeUp?: () => void) => {
  const { quizzes, activeQuiz: globalActiveQuiz, setActiveQuiz: setGlobalActiveQuiz } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const { quizId: routeQuizId } = useParams<{ quizId?: string }>();
  const quizId = quizIdParam || routeQuizId;

  const [localActiveQuiz, setLocalActiveQuiz] = useState<Quiz | null>(null);
  const [attemptSettingsState, setAttemptSettingsState] = useState<AttemptSettings>(DEFAULT_ATTEMPT_SETTINGS); 
  const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0); // Track elapsed time
  const timerRef = useRef<number | null>(null);
  const elapsedTimerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  
  const routeAttemptSettingsFromState = (location.state as { attemptSettings?: AttemptSettings } | null)?.attemptSettings;
  const stableRouteAttemptSettings = useMemo(() => {
    return routeAttemptSettingsFromState;
  }, [JSON.stringify(routeAttemptSettingsFromState)]); 

  useEffect(() => {
    let mounted = true;
    const loadQuizData = () => {
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
          setCurrentQuestionIndex(0);

          if (newAttemptSettings.timeLimit > 0) {
            setTimeLeft(newAttemptSettings.timeLimit * 60);
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
    };
  }, [quizId, quizzes, globalActiveQuiz, navigate, setGlobalActiveQuiz, stableRouteAttemptSettings, localActiveQuiz?.id, attemptSettingsState]); 

  // Start elapsed time tracking when quiz loads
  useEffect(() => {
    if (localActiveQuiz && !loading) {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
        setElapsedTime(0);
      }
      
      // Start elapsed time counter
      elapsedTimerRef.current = window.setInterval(() => {
        const currentTime = Date.now();
        const elapsed = Math.floor((currentTime - startTimeRef.current!) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
      
      return () => {
        if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      };
    }
  }, [localActiveQuiz, loading]);

  useEffect(() => {
    return () => {
      startTimeRef.current = null;
      if (timerRef.current) clearInterval(timerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, []);

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
      return true;
    }
    return false;
  }, [currentQuestionIndex, shuffledQuestions.length]);

  const goToPreviousQuestion = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      return true;
    }
    return false;
  }, [currentQuestionIndex]);

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
    loading,
    timeLeft,
    elapsedTime, // Add elapsed time to return
    attemptSettings: attemptSettingsState, 
    goToNextQuestion,
    goToPreviousQuestion,
    formatTime,
    totalQuestions: shuffledQuestions.length,
    setShuffledQuestions,
    setCurrentQuestionIndex
  };
};