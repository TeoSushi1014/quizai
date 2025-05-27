
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext, useTranslation } from '../../App';
import { Question } from '../../types';
import { Button, Card, ProgressBar, LoadingSpinner, Tooltip, Modal } from '../../components/ui';
import MathText from '../../components/MathText';
import { CheckCircleIcon, CircleIcon, ChevronLeftIcon, ChevronRightIcon, XCircleIcon, LightbulbIcon } from '../../constants';
import { useQuizFlow } from './hooks/useQuizFlow'; // Import the custom hook

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
  
  const [currentTentativeSelection, setCurrentTentativeSelection] = useState<string | null>(null);
  const [isCurrentSelectionChecked, setIsCurrentSelectionChecked] = useState(false);
  const [isCurrentSelectionCorrectFeedback, setIsCurrentSelectionCorrectFeedback] = useState<boolean | null>(null);
  const [practiceAttempts, setPracticeAttempts] = useState<PracticeAttempt[]>([]);
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
    shuffledQuestions, // Need this to initialize practiceAttempts
    setCurrentQuestionIndex, // For loading previous state
  } = useQuizFlow(quizId, { onTimeUp: handleTimeUp });

  const explanationIconUrl = "https://img.icons8.com/?size=256&id=eoxMN35Z6JKg&format=png";

  useEffect(() => {
    if (shuffledQuestions.length > 0 && practiceAttempts.length === 0) {
        setPracticeAttempts(shuffledQuestions.map(q => ({ 
            questionId: q.id, selectedOption: null, isCorrect: null, firstTryCorrect: null, attempts: 0,
        })));
    }
  }, [shuffledQuestions, practiceAttempts.length]);


  const updatePracticeAttempt = useCallback((questionId: string, updates: Partial<PracticeAttempt>) => {
    setPracticeAttempts(prev => 
      prev.map(attempt => attempt.questionId === questionId ? { ...attempt, ...updates } : attempt)
    );
  }, []);

  const resetCurrentQuestionVisualState = useCallback(() => {
    setCurrentTentativeSelection(null);
    setIsCurrentSelectionChecked(false);
    setIsCurrentSelectionCorrectFeedback(null);
  }, []);

  // Effect to load state when question changes
  useEffect(() => {
    resetCurrentQuestionVisualState(); // Always reset first
    if (currentQuestion && practiceAttempts.length > 0) {
      const attempt = practiceAttempts.find(pa => pa.questionId === currentQuestion.id);
      if (attempt) {
        setCurrentTentativeSelection(attempt.selectedOption);
        if (attempt.isCorrect !== null) { // If it was checked
          setIsCurrentSelectionChecked(true);
          setIsCurrentSelectionCorrectFeedback(attempt.isCorrect);
        }
      }
    }
  }, [currentQuestionIndex, currentQuestion, practiceAttempts, resetCurrentQuestionVisualState]);


  const handleSelectOption = (optionText: string) => {
    if (isCurrentSelectionChecked) return; 
    setCurrentTentativeSelection(optionText);
  };

  const handleCheckAnswer = () => {
    if (!currentTentativeSelection || !currentQuestion) return;

    const isCorrect = currentTentativeSelection === currentQuestion.correctAnswer;
    setIsCurrentSelectionChecked(true);
    setIsCurrentSelectionCorrectFeedback(isCorrect);

    const currentAttempt = practiceAttempts.find(pa => pa.questionId === currentQuestion.id);
    const newAttemptsCount = (currentAttempt?.attempts || 0) + 1;

    updatePracticeAttempt(currentQuestion.id, {
      selectedOption: currentTentativeSelection, 
      isCorrect: isCorrect, 
      attempts: newAttemptsCount,
      ...(newAttemptsCount === 1 && { firstTryCorrect: isCorrect }), 
    });
  };

  const finishPracticeAndNavigate = useCallback(() => {
    if (!localActiveQuiz) return;
    
    // Ensure current (possibly unchecked) selection is recorded before navigating
    if (currentTentativeSelection && !isCurrentSelectionChecked && currentQuestion) {
        const attempt = practiceAttempts.find(pa => pa.questionId === currentQuestion.id);
        if (!attempt || attempt.selectedOption !== currentTentativeSelection || attempt.isCorrect === null) {
            updatePracticeAttempt(currentQuestion.id, {
               selectedOption: currentTentativeSelection, 
               isCorrect: null, // Mark as not checked if it wasn't
            });
        }
    }

    // Use a timeout to ensure state update completes before navigation
    setTimeout(() => {
        navigate(`/practice-summary/${localActiveQuiz.id}`, { 
          state: { 
            practiceAttempts, 
            quizTitle: localActiveQuiz.title, 
            questions: localActiveQuiz.questions // Send original questions for consistent display order in summary
          } 
        });
    }, 0);
  }, [localActiveQuiz, navigate, practiceAttempts, currentTentativeSelection, isCurrentSelectionChecked, currentQuestion, updatePracticeAttempt]);


  const handleNextQuestionLogic = useCallback((isSkipping = false) => {
    if (!localActiveQuiz || !currentQuestion) return;
    
    // If skipping or moving next from an unchecked state, record the tentative selection.
    if ((isSkipping || !isCurrentSelectionChecked) && currentTentativeSelection) {
        const attempt = practiceAttempts.find(pa => pa.questionId === currentQuestion.id);
        // Only update if it's a new selection or if it was previously not checked.
        if (!attempt || attempt.selectedOption !== currentTentativeSelection || attempt.isCorrect === null) {
            updatePracticeAttempt(currentQuestion.id, {
                selectedOption: currentTentativeSelection, 
                isCorrect: null, // If skipping or moving from unchecked, it's not formally checked.
                                // Don't increment attempts for mere selection/skip without check.
            });
        }
    }

    if (!goToNextQuestion()) { 
      finishPracticeAndNavigate();
    }
  }, [localActiveQuiz, goToNextQuestion, finishPracticeAndNavigate, currentTentativeSelection, isCurrentSelectionChecked, currentQuestion, practiceAttempts, updatePracticeAttempt]);
  
  const handlePreviousQuestionLogic = useCallback(() => {
    if (!currentQuestion) return;
    // Record current tentative selection if not checked
    if (currentTentativeSelection && !isCurrentSelectionChecked) {
        const attempt = practiceAttempts.find(pa => pa.questionId === currentQuestion.id);
        if (!attempt || attempt.selectedOption !== currentTentativeSelection || attempt.isCorrect === null) {
            updatePracticeAttempt(currentQuestion.id, {
                selectedOption: currentTentativeSelection,
                isCorrect: null,
            });
        }
    }
    goToPreviousQuestion();
  }, [goToPreviousQuestion, currentTentativeSelection, isCurrentSelectionChecked, currentQuestion, practiceAttempts, updatePracticeAttempt]);


  if (loading || !localActiveQuiz) return <LoadingSpinner text={t('quizTakingLoading')} className="mt-24" size="xl"/>;
  if (!currentQuestion) return <Card className="text-center mt-16 !rounded-2xl" useGlassEffect><p className="text-red-400 p-12 text-lg font-semibold">{t('quizTakingErrorQuestionNotFound')}</p></Card>;

  const progressPercent = totalQuestions > 0 ? ((currentQuestionIndex + 1) / totalQuestions) * 100 : 0;
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

  return (
    <Card className="max-w-3xl mx-auto shadow-2xl !border-slate-700/40 !rounded-2xl" useGlassEffect>
      <div className="mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-50 mb-4 leading-tight tracking-tight line-clamp-2" title={localActiveQuiz.title}>
          <MathText text={t('quizPracticeTitle', { quizTitle: localActiveQuiz.title })} />
        </h1>
        <div className="flex justify-between items-center text-sm text-slate-300 mb-5">
          <span>{t('quizTakingQuestionProgress', {current: currentQuestionIndex + 1, total: totalQuestions})}</span>
          {timeLeft !== null && <span className={`font-semibold ${timeLeft <= 60 ? 'text-red-400 animate-pulse' : 'text-sky-300'}`}>{t('quizTakingTimeLeft', { time: formatTime(timeLeft) })}</span>}
          {localActiveQuiz.config?.customUserPrompt && (
            <Tooltip content={<div className="max-w-xs text-left text-xs"><MathText text={localActiveQuiz.config.customUserPrompt}/></div>} placement="bottom-end">
                <LightbulbIcon className="w-5 h-5 text-yellow-300 cursor-help"/>
            </Tooltip>
          )}
        </div>
        <ProgressBar progress={progressPercent} size="lg" barClassName="bg-gradient-to-r from-purple-500 to-pink-500"/>
      </div>

      <div>
        <div 
          className={`mb-6 p-6 sm:p-8 bg-slate-700/60 rounded-xl shadow-inner border border-slate-600/70 min-h-[200px] flex flex-col`}
        >
          <h2 className="text-lg sm:text-xl font-semibold text-slate-100 mb-8 leading-relaxed">
            <MathText text={currentQuestion.questionText} />
          </h2>
          
          <div className="flex-grow">
            <div className="space-y-4">
              {currentQuestion.options.map((option, index) => {
                const isSelectedForDisplay = currentTentativeSelection === option;
                let optionStyle = `bg-slate-600 hover:bg-slate-500/80 border-slate-500 hover:border-sky-500 text-slate-100 hover:scale-[1.02]`;
                let icon = <CircleIcon className="w-6 h-6 text-slate-400 group-hover:text-sky-400" strokeWidth={2.5}/>;

                if (isCurrentSelectionChecked) { 
                  if (isSelectedForDisplay && isCurrentSelectionCorrectFeedback) {
                    optionStyle = 'bg-green-500/40 border-green-500 text-green-50 font-semibold scale-105';
                    icon = <CheckCircleIcon className="w-6 h-6 text-green-50" isFilled={true}/>;
                  } else if (isSelectedForDisplay && !isCurrentSelectionCorrectFeedback) {
                    optionStyle = 'bg-red-500/40 border-red-500 text-red-50 font-semibold scale-105';
                    icon = <XCircleIcon className="w-6 h-6 text-red-50" />;
                  } else if (option === currentQuestion.correctAnswer) { 
                     optionStyle = 'bg-green-500/30 border-green-600 text-green-100 opacity-90'; 
                     icon = <CheckCircleIcon className="w-6 h-6 text-green-100" isFilled={false}/>; 
                  } else { 
                    optionStyle = 'bg-slate-600/50 border-slate-700 text-slate-400 opacity-70 cursor-not-allowed'; 
                    icon = <CircleIcon className="w-6 h-6 text-slate-500" strokeWidth={2.5}/>;
                  }
                } else if (isSelectedForDisplay) { 
                   optionStyle = 'bg-sky-500/50 border-sky-400 text-sky-50 font-semibold hover:bg-sky-500/60 scale-105';
                   icon = <CircleIcon className="w-6 h-6 text-sky-50" isFilled={true} strokeWidth={1}/>; 
                }

                return (
                  <button
                    key={index} onClick={() => handleSelectOption(option)}
                    disabled={isCurrentSelectionChecked} 
                    className={`w-full flex items-center text-left p-4 sm:p-4 rounded-xl border-2 transition-all duration-200 ease-out transform focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-400/50 focus-visible:ring-offset-2 ${isSelectedForDisplay ? 'focus-visible:ring-offset-white' : 'focus-visible:ring-offset-slate-700'} shadow-lg ${optionStyle}`}
                    aria-pressed={isSelectedForDisplay}
                  >
                    <span className="mr-3.5 flex-shrink-0">{icon}</span>
                    <span className="text-sm sm:text-base flex-grow">
                      <MathText text={option} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        
        {isCurrentSelectionChecked && (
          <div className="my-6 p-5 bg-slate-700/40 rounded-xl border border-slate-600/50">
            <p className="flex items-start text-base font-semibold text-sky-300 mb-2.5">
              <img src={explanationIconUrl} alt={t('resultsExplanationTitle')} className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
              {t('resultsExplanationTitle')}
            </p>
            <div className="text-slate-300/90 text-sm leading-relaxed whitespace-pre-wrap break-words">
              <MathText text={currentQuestion.explanation || t('resultsNoExplanation')} />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col space-y-3 pt-6 border-t border-slate-700/60">
        {!isCurrentSelectionChecked ? (
          <Button onClick={handleCheckAnswer} disabled={!currentTentativeSelection} variant="primary" size="lg" leftIcon={<CheckCircleIcon className="w-5 h-5"/>} className="w-full py-3 rounded-xl">
            {t('checkAnswer')}
          </Button>
        ) : (
          <>
            {isCurrentSelectionCorrectFeedback === true && <p className="text-center text-green-400 font-semibold text-lg">{t('answerCorrect')}</p>}
            {isCurrentSelectionCorrectFeedback === false && <p className="text-center text-red-400 font-semibold text-lg">{t('answerIncorrect')}</p>}
            <Button 
                onClick={() => handleNextQuestionLogic(false)} 
                variant="primary" 
                size="lg" 
                rightIcon={<ChevronRightIcon className="w-5 h-5"/>} 
                className={`w-full py-3 rounded-xl ${isCurrentSelectionCorrectFeedback ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
            >
              {isLastQuestion ? t('finishPractice') : t('nextQuestion')}
            </Button>
          </>
        )}
        
        <div className="flex justify-between items-center pt-3">
            <Button onClick={handlePreviousQuestionLogic} disabled={currentQuestionIndex === 0} variant="outline" size="md" leftIcon={<ChevronLeftIcon className="w-4 h-4"/>} className="py-2.5 px-5 rounded-lg">
                {t('previous')}
            </Button>
            {!isCurrentSelectionChecked && (
              isLastQuestion ? (
                <Button onClick={finishPracticeAndNavigate} variant="outline" size="md" rightIcon={<ChevronRightIcon className="w-4 h-4"/>} className="py-2.5 px-5 rounded-lg">
                    {t('finishPractice')}
                </Button>
              ) : (
                <Button onClick={() => handleNextQuestionLogic(true)} variant="outline" size="md" rightIcon={<ChevronRightIcon className="w-4 h-4"/>} className="py-2.5 px-5 rounded-lg">
                    {t('skipQuestion')}
                </Button>
              )
            )}
            {isCurrentSelectionChecked && ( 
                 <Button onClick={finishPracticeAndNavigate} variant="outline" size="md" className="py-2.5 px-5 rounded-lg">
                    {t('finishPractice')}
                </Button>
            )}
        </div>
      </div>

      {showTimesUpModalState && (
        <Modal
          isOpen={showTimesUpModalState}
          onClose={() => {setShowTimesUpModalState(false); finishPracticeAndNavigate();}} 
          title={t('timesUp')}
          size="md"
          hideCloseButton={true}
          footerContent={
            <div className="flex justify-center">
              <Button variant="primary" onClick={() => { setShowTimesUpModalState(false); finishPracticeAndNavigate(); }} size="md">
                {t('timesUpSubmit')} 
              </Button>
            </div>
          }
        >
          <p className="text-slate-200 text-base leading-relaxed text-center">
            {t('timesUpMessage')}
          </p>
        </Modal>
      )}
    </Card>
  );
};

export default QuizPracticePage;