import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext, useTranslation } from '../../App';
import { Question, QuizResult, UserAnswer } from '../../types';
import { Button, Card, ProgressBar, LoadingSpinner, Modal } from '../../components/ui';
import { CheckCircleIcon, CircleIcon, ChevronLeftIcon, ChevronRightIcon, XCircleIcon } from '../../constants';
import { useQuizFlow } from './hooks/useQuizFlow';
import PracticeQuizQuestion from './components/PracticeQuizQuestion'; 
import PracticeQuizExplanation from './components/PracticeQuizExplanation'; // Import the new explanation component

interface PracticeAttempt {
  questionId: string;
  selectedOption: string | null;
  isCorrect: boolean | null;
  firstTryCorrect: boolean | null;
  attempts: number;
}

const QuizPracticePage: React.FC = () => {
  const { t } = useTranslation();
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { setQuizResult: setGlobalQuizResult } = useAppContext();

  const [currentTentativeSelection, setCurrentTentativeSelection] = useState<string | null>(null);
  const [isCurrentSelectionChecked, setIsCurrentSelectionChecked] = useState(false);
  const [isCurrentSelectionCorrectFeedback, setIsCurrentSelectionCorrectFeedback] = useState<boolean | null>(null);
  const [practiceAttempts, setPracticeAttempts] = useState<PracticeAttempt[]>([]);
  const [showTimesUpModalState, setShowTimesUpModalState] = useState(false);
  const [isFinishingOrChecking, setIsFinishingOrChecking] = useState(false); 
  const isFinishingPracticeRef = useRef(false);

  const handleTimeUp = useCallback(() => {
    if (isFinishingPracticeRef.current) return;
    setShowTimesUpModalState(true);
  }, []);

  const {
    localActiveQuiz,
    currentQuestion,
    currentQuestionIndex,
    loading,
    timeLeft,
    goToNextQuestion,
    goToPreviousQuestion,
    formatTime,
    totalQuestions,
    shuffledQuestions,
    attemptSettings,
  } = useQuizFlow(quizId, handleTimeUp);

  // const explanationIconUrl = "https://img.icons8.com/?size=256&id=eoxMN35Z6JKg&format=png"; // Moved to PracticeQuizExplanation

  useEffect(() => {
    if (shuffledQuestions.length > 0 && practiceAttempts.length === 0) {
      setPracticeAttempts(shuffledQuestions.map(q => ({
        questionId: q.id, selectedOption: null, isCorrect: null, firstTryCorrect: null, attempts: 0,
      })));
    }
  }, [shuffledQuestions, practiceAttempts.length]);


  useEffect(() => {
    if (isFinishingPracticeRef.current) return;

    let nextTentativeSelection: string | null = null;
    let nextIsChecked = false;
    let nextCorrectFeedback: boolean | null = null;

    if (currentQuestion && practiceAttempts.length > 0) {
      const attempt = practiceAttempts.find(pa => pa.questionId === currentQuestion.id);
      if (attempt) {
        nextTentativeSelection = attempt.selectedOption;
        if (attempt.isCorrect !== null) { 
          nextIsChecked = true;
          nextCorrectFeedback = attempt.isCorrect;
        }
      }
    }
    
    setCurrentTentativeSelection(nextTentativeSelection);
    setIsCurrentSelectionChecked(nextIsChecked);
    setIsCurrentSelectionCorrectFeedback(nextCorrectFeedback);
    setIsFinishingOrChecking(false); // Reset checking state when question changes

  }, [currentQuestionIndex, currentQuestion, practiceAttempts]);


  const triggerFinishPractice = useCallback(() => {
    if (isFinishingPracticeRef.current || !localActiveQuiz) return;
    isFinishingPracticeRef.current = true; 
    setIsFinishingOrChecking(true); 

    let finalPracticeAttempts = [...practiceAttempts];

    if (currentQuestion && currentTentativeSelection && !isCurrentSelectionChecked) {
        finalPracticeAttempts = finalPracticeAttempts.map(pa =>
            pa.questionId === currentQuestion.id
            ? {
                ...pa,
                selectedOption: currentTentativeSelection,
                isCorrect: null, 
                attempts: (pa.attempts || 0), 
              }
            : pa
        );
    } else if (currentQuestion && !currentTentativeSelection && !isCurrentSelectionChecked) {
        finalPracticeAttempts = finalPracticeAttempts.map(pa =>
            pa.questionId === currentQuestion.id
            ? { ...pa, selectedOption: null, isCorrect: null }
            : pa
        );
    }


    const correctAnswersCount = finalPracticeAttempts.filter(pa => pa.isCorrect === true).length;
    const finalUserAnswersArray: UserAnswer[] = finalPracticeAttempts.map(pa => ({
      questionId: pa.questionId,
      answer: pa.selectedOption || "", 
    }));

    const scorePercentage = localActiveQuiz.questions.length > 0
      ? (correctAnswersCount / localActiveQuiz.questions.length) * 100
      : 0;

    const resultData: QuizResult = {
      quizId: localActiveQuiz.id,
      score: parseFloat(scorePercentage.toFixed(2)),
      answers: finalUserAnswersArray,
      totalCorrect: correctAnswersCount,
      totalQuestions: localActiveQuiz.questions.length,
      timeTaken: attemptSettings.timeLimit > 0 ? (attemptSettings.timeLimit * 60) - (timeLeft || 0) : undefined,
      sourceMode: 'practice',
      createdAt: new Date().toISOString(),
    };
    
    setGlobalQuizResult(resultData);
    navigate(`/results/${localActiveQuiz.id}`);
  }, [
    localActiveQuiz, 
    practiceAttempts, 
    currentQuestion, 
    currentTentativeSelection, 
    isCurrentSelectionChecked, 
    setGlobalQuizResult, 
    attemptSettings.timeLimit, 
    timeLeft,
    navigate
  ]);


  const handleSelectOption = (optionText: string) => {
    if (isCurrentSelectionChecked || isFinishingPracticeRef.current || isFinishingOrChecking) return;
    setCurrentTentativeSelection(optionText);
  };

  const handleCheckAnswer = () => {
    if (!currentTentativeSelection || !currentQuestion || isFinishingPracticeRef.current || isFinishingOrChecking) return;
    setIsFinishingOrChecking(true); // Indicate checking is in progress

    const isCorrect = currentTentativeSelection === currentQuestion.correctAnswer;
    setIsCurrentSelectionChecked(true);
    setIsCurrentSelectionCorrectFeedback(isCorrect);

    setPracticeAttempts(prev =>
      prev.map(pa =>
        pa.questionId === currentQuestion.id
          ? {
            ...pa,
            selectedOption: currentTentativeSelection,
            isCorrect: isCorrect,
            attempts: (pa.attempts || 0) + 1,
            ...((pa.attempts || 0) === 0 && { firstTryCorrect: isCorrect }),
          }
          : pa
      )
    );
    // setIsFinishingOrChecking(false) will be handled by useEffect when question changes or if explicitly reset
  };

  const handleNextQuestionLogic = useCallback(() => {
    if (!localActiveQuiz || !currentQuestion || isFinishingPracticeRef.current || isFinishingOrChecking) return;
    setIsFinishingOrChecking(true);

    if (currentTentativeSelection && !isCurrentSelectionChecked) {
      setPracticeAttempts(prev =>
        prev.map(pa =>
          pa.questionId === currentQuestion.id && (pa.selectedOption !== currentTentativeSelection || pa.isCorrect === null)
            ? { ...pa, selectedOption: currentTentativeSelection, isCorrect: pa.isCorrect, attempts: pa.attempts || 0 }
            : pa
        )
      );
    } else if (!currentTentativeSelection && !isCurrentSelectionChecked) {
       setPracticeAttempts(prev =>
        prev.map(pa =>
          pa.questionId === currentQuestion.id && pa.selectedOption !== null && pa.isCorrect === null
            ? { ...pa, selectedOption: null } 
            : pa
        )
      );
    }

    if (!goToNextQuestion()) { 
      triggerFinishPractice();
    } else {
      // Reset for next question will be handled by useEffect [currentQuestionIndex]
    }
  }, [localActiveQuiz, currentQuestion, goToNextQuestion, triggerFinishPractice, currentTentativeSelection, isCurrentSelectionChecked, isFinishingOrChecking]);
  
  const handleSkipQuestionLogic = useCallback(() => { 
    if (!localActiveQuiz || !currentQuestion || isFinishingPracticeRef.current || isFinishingOrChecking) return;
    setIsFinishingOrChecking(true);
    if (!goToNextQuestion()) {
      triggerFinishPractice();
    }
  }, [localActiveQuiz, currentQuestion, goToNextQuestion, triggerFinishPractice, isFinishingOrChecking]);


  const handlePreviousQuestionLogic = useCallback(() => {
    if (!currentQuestion || isFinishingPracticeRef.current || isFinishingOrChecking) return;
    setIsFinishingOrChecking(true);
    
    if (currentTentativeSelection && !isCurrentSelectionChecked) {
      setPracticeAttempts(prev =>
        prev.map(pa =>
          pa.questionId === currentQuestion.id && (pa.selectedOption !== currentTentativeSelection || pa.isCorrect === null)
            ? { ...pa, selectedOption: currentTentativeSelection, isCorrect: pa.isCorrect, attempts: pa.attempts || 0 }
            : pa
        )
      );
    } else if (!currentTentativeSelection && !isCurrentSelectionChecked) {
       setPracticeAttempts(prev =>
        prev.map(pa =>
          pa.questionId === currentQuestion.id && pa.selectedOption !== null && pa.isCorrect === null
            ? { ...pa, selectedOption: null }
            : pa
        )
      );
    }
    goToPreviousQuestion();
  }, [goToPreviousQuestion, currentTentativeSelection, isCurrentSelectionChecked, currentQuestion, isFinishingOrChecking]);

  const handleCloseTimesUpModalAndSubmit = useCallback(() => {
    triggerFinishPractice();
  }, [triggerFinishPractice]);


  // Add helper function to get option label from option value
  const getOptionLabel = (optionValue: string, options: string[]) => {
    const index = options.findIndex(option => option === optionValue);
    if (index === -1) return optionValue;
    return `${String.fromCharCode(65 + index)}. ${optionValue}`;
  };

  // Define renderQuizContent function
  const renderQuizContent = () => {
    if (!currentQuestion) return null;
  
    return (
      <div className="space-y-4">
        <PracticeQuizQuestion
          question={currentQuestion.questionText}
          options={currentQuestion.options}
          currentIndex={currentQuestionIndex}
          totalQuestions={totalQuestions}
          selectedOption={currentTentativeSelection}
          onSelectOption={handleSelectOption}
          onCheckAnswer={handleCheckAnswer}
          onSkipQuestion={handleSkipQuestionLogic}
          isSubmitting={isFinishingOrChecking}
          isAnswerChecked={isCurrentSelectionChecked}
          isAnswerCorrect={isCurrentSelectionCorrectFeedback}
          correctAnswer={currentQuestion.correctAnswer}
        />
        
        {isCurrentSelectionChecked && (
          <PracticeQuizExplanation 
            explanation={currentQuestion.explanation || t('resultsNoExplanation')}
            isCorrect={isCurrentSelectionCorrectFeedback === true}
            correctOptionLabel={getOptionLabel(currentQuestion.correctAnswer, currentQuestion.options)}
            showFeedbackBanner={false}
          />
        )}
      </div>
    );
  };

  if (isFinishingOrChecking && isFinishingPracticeRef.current) { // Show loading only when truly finishing
    return (
      <div className="flex flex-col items-center justify-center p-8 min-h-[400px]">
        <LoadingSpinner text={t('quizPracticeEnding') || "Processing..."} size="lg" />
      </div>
    );
  }

  if (loading || !localActiveQuiz) return <LoadingSpinner text={t('quizTakingLoading')} className="mt-24" size="xl"/>;

  if (!currentQuestion) {
    if (localActiveQuiz && totalQuestions > 0 && currentQuestionIndex >= totalQuestions) {
        if (!isFinishingPracticeRef.current) {
            triggerFinishPractice(); 
        }
        return (
          <div className="flex flex-col items-center justify-center p-8 min-h-[400px]">
            <LoadingSpinner text={t('quizPracticeEnding') || "Completing practice..."} size="lg" />
          </div>
        );
    }
    if (loading) {
        return <LoadingSpinner text={t('quizTakingLoading')} className="mt-24" size="xl"/>;
    }
    console.error("QuizPracticePage: currentQuestion is undefined, but not due to finishing. Quiz data might be missing or an error occurred.");
    return (
      <div className="flex flex-col items-center justify-center p-8 min-h-[400px]">
        <LoadingSpinner text={t('error') + " - " + (t('quizTakingLoading') || "Processing...")} size="lg" />
        <Button onClick={() => navigate('/dashboard')} className="mt-4">{t('resultsGoToDashboard')}</Button>
      </div>
    );
  }

  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;
  

  return (
    <Card className="max-w-2xl mx-auto shadow-2xl !rounded-2xl animate-page-slide-fade-in p-5 sm:p-6" useGlassEffect>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] mb-3 leading-tight tracking-tight line-clamp-2" title={localActiveQuiz.title}>
           {t('quizPracticeTitle', { quizTitle: localActiveQuiz.title })}
        </h1>
        <div className="flex justify-between items-center text-xs text-[var(--color-text-secondary)] mb-2">
          {timeLeft !== null && <span className={`font-semibold ${timeLeft <= 60 ? 'text-red-400 animate-pulse' : 'text-[var(--color-primary-accent)]'}`}>{t('quizTakingTimeLeft', { time: formatTime(timeLeft) })}</span>}
          {/* Removed LightbulbIcon tooltip */}
        </div>
      </div>

      {renderQuizContent()}

      <div className="quiz-navigation-actions mt-6 pt-6 border-t border-[var(--color-border-default)] flex flex-col sm:flex-row sm:justify-between gap-3">
        <Button
            variant="secondary"
            onClick={handlePreviousQuestionLogic}
            disabled={isFinishingOrChecking || currentQuestionIndex === 0}
            size="md"
            leftIcon={<ChevronLeftIcon className="w-4 h-4"/>}
            className="w-full sm:w-auto"
        >
        {t('previous')}
        </Button>
      
        <Button
          variant={isLastQuestion && isCurrentSelectionChecked ? "primary" : "secondary"} // Primary if last question and checked
          onClick={isCurrentSelectionChecked ? handleNextQuestionLogic : triggerFinishPractice}
          disabled={isFinishingOrChecking}
          size="md"
          rightIcon={<ChevronRightIcon className="w-4 h-4"/>}
          className="w-full sm:w-auto"
        >
          {isCurrentSelectionChecked ? (isLastQuestion ? t('finishPractice') : t('nextQuestion')) : t('finishPractice') /* If not checked, this button becomes finish */}
        </Button>
      </div>


      {showTimesUpModalState && (
        <Modal
          isOpen={showTimesUpModalState && !isFinishingPracticeRef.current}
          onClose={handleCloseTimesUpModalAndSubmit} 
          title={t('timesUp')}
          size="md"
          hideCloseButton={true} 
          footerContent={
            <div className="flex justify-center">
              <Button variant="primary" onClick={handleCloseTimesUpModalAndSubmit} size="md">
                {t('timesUpSubmit')}
              </Button>
            </div>
          }
        >
          <p className="text-[var(--color-text-body)] text-base leading-relaxed text-center">
            {t('timesUpMessage')}
          </p>
        </Modal>
      )}
    </Card>
  );
};
QuizPracticePage.displayName = "QuizPracticePage";

export default QuizPracticePage;
