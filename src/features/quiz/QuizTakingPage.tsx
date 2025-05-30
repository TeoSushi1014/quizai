
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext, useTranslation } from '../../App';
import { Quiz, Question, UserAnswer, QuizResult } from '../../types';
import { Button, Card, LoadingSpinner, ProgressBar, Modal, Tooltip } from '../../components/ui';
import MathText from '../../components/MathText';
import { CircleIcon, ChevronLeftIcon, ChevronRightIcon, LightbulbIcon } from '../../constants';
import { useQuizFlow } from './hooks/useQuizFlow'; 

const QuizTakingPage: React.FC = () => {
  const { setQuizResult } = useAppContext();
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
      // If user de-selects (though UI doesn't directly support this, but good for robustness)
      // Or if selectedOption is cleared before storing
      setUserAnswers(prev => {
        const newAnswers = {...prev};
        delete newAnswers[currentQuestion.id];
        return newAnswers;
      });
    }
  }, [currentQuestion, selectedOption, userAnswers]);

  const handleFinalSubmit = useCallback(() => {
    if (!localActiveQuiz) return;
    
    // Construct the final userAnswers map for calculation, including the current selection
    let finalUserAnswersMap = { ...userAnswers };
    if (currentQuestion && selectedOption) {
      finalUserAnswersMap[currentQuestion.id] = selectedOption;
    } else if (currentQuestion && !selectedOption && finalUserAnswersMap[currentQuestion.id]) {
      // If current question had an answer but is now de-selected
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
    attemptSettings.timeLimit
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
    // setShowTimesUpModalState(false); // This will be handled by handleFinalSubmit
    handleFinalSubmit();
  }, [handleFinalSubmit]);


  if (loading || !localActiveQuiz) {
    return <LoadingSpinner text={t('quizTakingLoading')} className="mt-24" size="xl"/>;
  }
  
  if (!currentQuestion) {
     return (
        <Card className="max-w-3xl mx-auto shadow-2xl !rounded-2xl animate-fadeInUp" useGlassEffect>
            <LoadingSpinner text={t('quizTakingLoading')} />
            <p className="text-center text-[var(--color-text-secondary)] mt-4">{t('quizTakingErrorQuestionNotFound')}</p>
        </Card>
     );
  }


  const progressPercent = totalQuestions > 0 ? (currentQuestionIndex + 1) / totalQuestions * 100 : 0;
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

  return (
    <Card className="max-w-3xl mx-auto shadow-2xl !rounded-2xl animate-page-slide-fade-in" useGlassEffect>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] mb-3 sm:mb-4 leading-tight tracking-tight line-clamp-2" title={localActiveQuiz.title}>
          <MathText text={localActiveQuiz.title} />
        </h1>
        <div className="flex justify-between items-center text-sm text-[var(--color-text-secondary)] mb-4 sm:mb-5">
          <span>{t('quizTakingQuestionProgress', {current: currentQuestionIndex + 1, total: totalQuestions})}</span>
          {localActiveQuiz.config?.customUserPrompt && (
            <Tooltip content={<div className="max-w-xs text-left text-xs"><MathText text={localActiveQuiz.config.customUserPrompt}/></div>} placement="bottom-end">
                <LightbulbIcon className="w-5 h-5 text-yellow-300 cursor-help"/>
            </Tooltip>
          )}
          {timeLeft !== null && <span className={`font-semibold ${timeLeft <= 60 ? 'text-red-400 animate-pulse' : 'text-[var(--color-primary-accent)]'}`}>{t('quizTakingTimeLeft', { time: formatTime(timeLeft) })}</span>}
        </div>
        <ProgressBar progress={progressPercent} size="lg" barClassName="bg-gradient-to-r from-[var(--color-primary-accent)] to-indigo-500"/>
      </div>

    <div>
      <div className={`p-5 sm:p-8 bg-[var(--color-bg-surface-2)]/60 rounded-xl shadow-inner border border-[var(--color-border-default)] min-h-[280px] flex flex-col`}>
        <div key={currentQuestion.id} className="animate-fadeInUp">
          <h2 className="text-lg sm:text-xl font-semibold text-[var(--color-text-primary)] mb-6 sm:mb-8 leading-relaxed">
            <MathText text={currentQuestion.questionText} />
          </h2>
          
          <div className="flex-grow">
              <div className="space-y-3.5 sm:space-y-4">
              {currentQuestion.options.map((option, index) => {
                  const isSelectedForDisplay = selectedOption === option;
                  let optionStyle = `bg-[var(--color-bg-surface-3)] hover:bg-[var(--color-bg-surface-3)]/70 border-[var(--color-border-interactive)] hover:border-[var(--color-primary-accent)] text-[var(--color-text-primary)]`;
                  let icon = <CircleIcon className="w-6 h-6 text-[var(--color-text-muted)] group-hover:text-[var(--color-primary-accent)] transition-colors var(--duration-fast) var(--ease-ios)" strokeWidth={2.5}/>;

                  if (isSelectedForDisplay) {
                     optionStyle = 'bg-[var(--color-primary-accent)]/50 border-[var(--color-primary-accent)] text-[var(--color-primary-accent-text)] font-semibold hover:bg-[var(--color-primary-accent)]/60 scale-[1.01]';
                     icon = <CircleIcon className="w-6 h-6 text-[var(--color-primary-accent-text)]" isFilled={true} strokeWidth={1}/>;
                  }

                  return (
                  <button
                      key={index}
                      onClick={() => handleSelectOption(option)}
                      className={`w-full flex items-center text-left p-3.5 sm:p-4 rounded-xl border-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-primary-accent)]/50 focus-visible:ring-offset-2 ${isSelectedForDisplay ? 'focus-visible:ring-offset-[var(--color-bg-surface-1)]' : 'focus-visible:ring-offset-[var(--color-bg-surface-2)]'} shadow-lg 
                                 transition-all var(--duration-fast) var(--ease-ios) will-change-transform, border, background-color
                                 ${optionStyle}`}
                      aria-pressed={isSelectedForDisplay}
                  >
                      <span className="mr-3.5 flex-shrink-0">{icon}</span>
                      <span className="text-sm sm:text-base flex-grow"> <MathText text={option} /> </span>
                  </button>
                  );
              })}
              </div>
          </div>
        </div>
      </div>
    </div>

      <div className="flex flex-col space-y-3 pt-6 sm:pt-8 border-t border-[var(--color-border-default)] mt-6 sm:mt-8"> {/* Added margin-top here to space out from question box */}
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
          onClose={handleCloseTimesUpModalAndSubmit} // Submitting on close
          title={t('timesUp')}
          size="md"
          hideCloseButton={true} // Prevent closing without submitting
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
