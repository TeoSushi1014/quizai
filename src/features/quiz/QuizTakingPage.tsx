import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext, useTranslation } from '../../App';
import { UserAnswer, QuizResult } from '../../types';
import { Button, Card, LoadingSpinner, ProgressBar, Modal } from '../../components/ui';
import MathText from '../../components/MathText';
import { ChevronLeftIcon, ChevronRightIcon } from '../../constants';
import { useQuizFlow } from './hooks/useQuizFlow';
import { supabaseService } from '../../services/supabaseService';

const QuizTakingPage: React.FC = () => {
  const { setQuizResult, currentUser } = useAppContext();
  const { t } = useTranslation();
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();

  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({}); 
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showTimesUpModalState, setShowTimesUpModalState] = useState(false); 

  const handleTimeUp = useCallback(() => {
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
    attemptSettings,
  } = useQuizFlow(quizId, handleTimeUp);


  useEffect(() => {
    if (currentQuestion && userAnswers[currentQuestion.id]) {
      setSelectedOption(userAnswers[currentQuestion.id]);
    } else {
      setSelectedOption(null); 
    }
  }, [currentQuestion, userAnswers]);


  const handleSelectOption = (option: string) => {
    setSelectedOption(option);
  };
  
  const storeCurrentAnswer = useCallback(() => {
    if (currentQuestion && selectedOption) {
      setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: selectedOption }));
    } else if (currentQuestion && !selectedOption && userAnswers[currentQuestion.id]) {
      setUserAnswers(prev => {
        const newAnswers = {...prev};
        delete newAnswers[currentQuestion.id];
        return newAnswers;
      });
    }
  }, [currentQuestion, selectedOption, userAnswers]);

  const handleFinalSubmit = useCallback(async () => {
    if (!localActiveQuiz) return;
    
    let finalUserAnswersMap = { ...userAnswers };
    if (currentQuestion && selectedOption) {
      finalUserAnswersMap[currentQuestion.id] = selectedOption;
    } else if (currentQuestion && !selectedOption && finalUserAnswersMap[currentQuestion.id]) {
      delete finalUserAnswersMap[currentQuestion.id];
    }
    
    let correctCount = 0;
    const finalUserAnswersArray: UserAnswer[] = [];

    localActiveQuiz.questions.forEach(q => {
      const userAnswerText = finalUserAnswersMap[q.id]; 
      if (userAnswerText) {
        finalUserAnswersArray.push({ questionId: q.id, answer: userAnswerText });
        if (userAnswerText === q.correctAnswer) {
          correctCount++;
        }
      } else {
        finalUserAnswersArray.push({ questionId: q.id, answer: "" }); 
      }
    });
    
    const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
    
    const result: QuizResult = {
      quizId: localActiveQuiz.id,
      score: parseFloat(score.toFixed(2)),
      answers: finalUserAnswersArray,
      totalCorrect: correctCount,
      totalQuestions: totalQuestions,
      timeTaken: attemptSettings.timeLimit > 0 ? (attemptSettings.timeLimit * 60) - (timeLeft || 0) : undefined,
      sourceMode: 'take',
      createdAt: new Date().toISOString(),
    };
    setQuizResult(result);
    
    // Save to database if user is logged in
    if (currentUser) {
      try {
        const saved = await supabaseService.saveQuizResult(result, currentUser.id, currentUser);
        if (saved) {
          console.log('Quiz result saved to database successfully');
        } else {
          console.log('Quiz result not saved to database (user not authenticated with Supabase, using local storage only)');
        }
      } catch (error) {
        console.error('Failed to save quiz result to database:', error);
        // Continue anyway - result is still saved locally
      }
    } else {
      console.log('No user logged in, quiz result saved locally only');
    }
    
    setShowConfirmationModal(false);
    setShowTimesUpModalState(false);
    navigate(`/results/${localActiveQuiz.id}`);
  }, [
    localActiveQuiz, 
    userAnswers, 
    currentQuestion, 
    selectedOption, 
    timeLeft, 
    setQuizResult, 
    navigate, 
    totalQuestions, 
    attemptSettings.timeLimit,
    currentUser
  ]);


  const handleNextQuestionAttempt = () => {
    if (!localActiveQuiz) return;
    storeCurrentAnswer();
    
    if (!goToNextQuestion()) { 
      setShowConfirmationModal(true);
    }
  };

  const handlePreviousQuestionAttempt = () => {
    storeCurrentAnswer();
    goToPreviousQuestion();
  };
  
  const handleCloseConfirmationModal = useCallback(() => setShowConfirmationModal(false), []);
  const handleCloseTimesUpModalAndSubmit = useCallback(() => {
    handleFinalSubmit();
  }, [handleFinalSubmit]);


  if (loading || !localActiveQuiz) {
    return <LoadingSpinner text={t('quizTakingLoading')} className="mt-24" size="xl"/>;
  }
  
  if (!currentQuestion) {
     return (
        <Card 
          className="max-w-3xl mx-auto p-5 sm:p-6 md:p-8 animate-fadeInUp rounded-lg bg-[var(--color-bg-surface-2)]/50 border border-[var(--color-border-default)] shadow-md"
        >
            <LoadingSpinner text={t('quizTakingLoading')} />
            <p className="text-center text-[var(--color-text-secondary)] mt-4">{t('quizTakingErrorQuestionNotFound')}</p>
        </Card>
     );
  }


  const progressPercent = totalQuestions > 0 ? (currentQuestionIndex + 1) / totalQuestions * 100 : 0;
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

  return (
    <Card 
      className="max-w-3xl mx-auto p-5 sm:p-6 md:p-8 animate-fadeInUp rounded-lg bg-[var(--color-bg-surface-2)]/50 border border-[var(--color-border-default)] shadow-md"
    >
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] mb-3 sm:mb-4 leading-tight tracking-tight line-clamp-2" title={localActiveQuiz.title}>
          <MathText text={localActiveQuiz.title} markdownFormatting={true} />
        </h1>
        <div className="flex justify-between items-center text-sm text-[var(--color-text-secondary)] mb-4 sm:mb-5">
          <span>{t('quizTakingQuestionProgress', {current: currentQuestionIndex + 1, total: totalQuestions})}</span>
          {timeLeft !== null && <span className={`font-semibold ${timeLeft <= 60 ? 'text-red-400 animate-pulse' : 'text-[var(--color-primary-accent)]'}`}>{t('quizTakingTimeLeft', { time: formatTime(timeLeft) })}</span>}
        </div>
        <ProgressBar progress={progressPercent} size="md" />
      </div>

    <div className="mt-6 md:mt-8">
      <div className="quiz-question-text text-base sm:text-lg text-[var(--color-text-body)] leading-relaxed mb-4">
        <MathText text={currentQuestion.questionText} markdownFormatting={true} />
      </div>
      
      <div className="quiz-options space-y-3">
        {currentQuestion.options.map((option, index) => {
          const isSelectedForDisplay = selectedOption === option;
          
          const baseButtonClasses = "w-full flex items-center text-left p-3.5 sm:p-4 rounded-xl border-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-primary-accent)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-default)] shadow-lg transition-all var(--duration-fast) var(--ease-ios) will-change-transform, border, background-color";
          const selectedButtonClasses = "bg-[var(--color-primary-accent)]/50 border-[var(--color-primary-accent)] text-[var(--color-primary-accent-text)] font-semibold scale-[1.01]";
          const unselectedButtonClasses = "bg-[var(--color-bg-surface-3)]/70 hover:bg-[var(--color-bg-surface-3)]/40 border-[var(--color-border-interactive)] hover:border-[var(--color-primary-accent)] text-[var(--color-text-primary)]";

          const indicatorBaseClasses = "option-indicator mr-3.5 flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors var(--duration-fast) var(--ease-ios)";
          const selectedIndicatorClasses = "border-[var(--color-primary-accent-text)] bg-[var(--color-primary-accent)]";
          const unselectedIndicatorClasses = "border-[var(--color-text-muted)] bg-[var(--color-bg-surface-2)] group-hover:border-[var(--color-primary-accent)]";
          
          return (
            <button
              key={index}
              onClick={() => handleSelectOption(option)}
              className={`${baseButtonClasses} ${isSelectedForDisplay ? selectedButtonClasses : unselectedButtonClasses}`}
              aria-pressed={isSelectedForDisplay}
            >
              <span className={`${indicatorBaseClasses} ${isSelectedForDisplay ? selectedIndicatorClasses : unselectedIndicatorClasses}`}>
              </span>
              <div className="text-sm sm:text-base flex-grow markdown-content">
                <MathText text={option} markdownFormatting={true} />
              </div>
            </button>
          );
        })}
      </div>
    </div>

      <div className="flex flex-col space-y-3 pt-6 sm:pt-8 border-t border-[var(--color-border-default)] mt-6 sm:mt-8">
        <Button 
            onClick={handleNextQuestionAttempt} 
            disabled={!selectedOption && !(currentQuestion && userAnswers[currentQuestion.id])}
            variant="primary" 
            size="lg" 
            rightIcon={<ChevronRightIcon className="w-5 h-5"/>} 
            className={`w-full py-3 rounded-xl`}
        >
            {isLastQuestion ? t('submit') : t('nextQuestion')}
        </Button>
        
        <div className="flex justify-between items-center pt-3">
            <Button onClick={handlePreviousQuestionAttempt} disabled={currentQuestionIndex === 0} variant="outline" size="md" leftIcon={<ChevronLeftIcon className="w-4 h-4"/>} className="py-2.5 px-5 rounded-lg">
                {t('previous')}
            </Button>
            <Button onClick={() => setShowConfirmationModal(true)} variant="outline" size="md" className="py-2.5 px-5 rounded-lg">
                {t('quizTakingSubmitQuiz')} 
            </Button>
        </div>
      </div>

      {showConfirmationModal && (
        <Modal
          isOpen={showConfirmationModal}
          onClose={handleCloseConfirmationModal}
          title={t('quizTakingSubmitQuiz')}
          size="md"
          footerContent={
            <div className="flex justify-end gap-3.5">
              <Button variant="secondary" onClick={handleCloseConfirmationModal} size="md">{t('cancel')}</Button>
              <Button variant="primary" onClick={handleFinalSubmit} size="md">{t('submit')}</Button>
            </div>
          }
        >
          <p className="text-[var(--color-text-body)] text-base leading-relaxed">{t('submitConfirmationMessage')}</p>
        </Modal>
      )}

      {showTimesUpModalState && (
        <Modal
          isOpen={showTimesUpModalState}
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
QuizTakingPage.displayName = "QuizTakingPage";

export default QuizTakingPage;
