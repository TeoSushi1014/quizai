import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Quiz, Question } from '../../../types';
import { useAppContext } from '../../../App';
import { AttemptSettings } from '../components/QuizCard';

// Helper function for shuffling (Fisher-Yates shuffle)
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

interface UseQuizFlowOptions {
  onTimeUp?: () => void;
}

export const useQuizFlow = (quizIdParam?: string, options?: UseQuizFlowOptions) => {
  const { quizzes, activeQuiz: globalActiveQuiz, setActiveQuiz: setGlobalActiveQuiz } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const { quizId: routeQuizId } = useParams<{ quizId?: string }>();
  const quizId = quizIdParam || routeQuizId;

  const [localActiveQuiz, setLocalActiveQuiz] = useState<Quiz | null>(null);
  const [attemptSettings, setAttemptSettings] = useState<AttemptSettings>(DEFAULT_ATTEMPT_SETTINGS);
  const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null); // Changed NodeJS.Timeout to number

  useEffect(() => {
    let mounted = true;
    const loadQuizData = () => {
      if (!quizId) {
        if (mounted) navigate('/dashboard');
        return;
      }

      const routeState = location.state as { attemptSettings?: AttemptSettings } | null;
      const currentAttemptSettings = routeState?.attemptSettings || 
                                     (localActiveQuiz?.id === quizId ? attemptSettings : DEFAULT_ATTEMPT_SETTINGS);
      
      if (mounted) setAttemptSettings(currentAttemptSettings);

      let quizToLoad = globalActiveQuiz && globalActiveQuiz.id === quizId ? globalActiveQuiz : quizzes.find(q => q.id === quizId);

      if (quizToLoad) {
        if (mounted) {
          setLocalActiveQuiz(quizToLoad);
          if (!globalActiveQuiz || globalActiveQuiz.id !== quizToLoad.id) {
            setGlobalActiveQuiz(quizToLoad);
          }
          
          let questionsToUse = quizToLoad.questions;
          if (currentAttemptSettings.shuffleQuestions) {
            questionsToUse = shuffleArray([...quizToLoad.questions]);
          }
          setShuffledQuestions(questionsToUse);
          setCurrentQuestionIndex(0); 

          if (currentAttemptSettings.timeLimit > 0) {
            setTimeLeft(currentAttemptSettings.timeLimit * 60);
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
    };
  }, [quizId, quizzes, globalActiveQuiz, navigate, setGlobalActiveQuiz, location.state]);


  useEffect(() => {
    if (timeLeft === null) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    if (timeLeft <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (localActiveQuiz && options?.onTimeUp) {
        options.onTimeUp();
      }
      return;
    }
    timerRef.current = window.setInterval(() => { // Use window.setInterval
      setTimeLeft(prevTime => (prevTime ? prevTime - 1 : 0));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLeft, localActiveQuiz, options]);

  const currentQuestion = useMemo(() => {
    if (!shuffledQuestions || shuffledQuestions.length === 0 || currentQuestionIndex >= shuffledQuestions.length) return undefined;
    const question = shuffledQuestions[currentQuestionIndex];
    if (question && attemptSettings.shuffleAnswers) {
      return { ...question, options: shuffleArray([...question.options]) };
    }
    return question;
  }, [shuffledQuestions, currentQuestionIndex, attemptSettings.shuffleAnswers]);

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
    attemptSettings,
    goToNextQuestion,
    goToPreviousQuestion,
    formatTime,
    totalQuestions: shuffledQuestions.length,
    setShuffledQuestions, // Expose if manual re-shuffling or question set modification is needed externally
    setCurrentQuestionIndex // Expose if direct jumping to questions is needed
  };
};