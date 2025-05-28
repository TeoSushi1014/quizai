
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext, useTranslation } from '../../App';
import { Question, QuizResult, UserAnswer } from '../../types';
import { Button, Card, ProgressBar, LoadingSpinner, Tooltip, Modal } from '../../components/ui';
import MathText from '../../components/MathText';
import { CheckCircleIcon, CircleIcon, ChevronLeftIcon, ChevronRightIcon, XCircleIcon, LightbulbIcon } from '../../constants';
import { useQuizFlow } from './hooks/useQuizFlow';

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
  const [isFinishingPractice, setIsFinishingPractice] = useState(false);
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

  const explanationIconUrl = "https://img.icons8.com/?size=256&id=eoxMN35Z6JKg&format=png";

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
        if (attempt.isCorrect !== null) { // This means it was checked
          nextIsChecked = true;
          nextCorrectFeedback = attempt.isCorrect;
        }
      }
    }
    // Apply new state
    setCurrentTentativeSelection(nextTentativeSelection);
    setIsCurrentSelectionChecked(nextIsChecked);
    setIsCurrentSelectionCorrectFeedback(nextCorrectFeedback);

  }, [currentQuestionIndex, currentQuestion, practiceAttempts]);


  const prepareAndCommitFinalAnswer = useCallback(() => {
    if (!localActiveQuiz) return false;

    if (!isFinishingPracticeRef.current && currentQuestion && currentTentativeSelection && !isCurrentSelectionChecked) {
        setPracticeAttempts(prev =>
            prev.map(pa =>
                pa.questionId === currentQuestion.id
                ? {
                    ...pa,
                    selectedOption: currentTentativeSelection,
                    isCorrect: null, 
                    attempts: (pa.attempts || 0) + 1,
                    ...( (pa.attempts || 0) === 0 && pa.firstTryCorrect === null && { firstTryCorrect: null }),
                    }
                : pa
            )
        );
    }
    return true;
  }, [localActiveQuiz, currentQuestion, currentTentativeSelection, isCurrentSelectionChecked]);

  const triggerFinishPractice = useCallback(() => {
    if (isFinishingPracticeRef.current || !localActiveQuiz) return;

    prepareAndCommitFinalAnswer();

    const correctAnswersCount = practiceAttempts.filter(pa => pa.isCorrect === true).length;
    const finalUserAnswersArray: UserAnswer[] = practiceAttempts.map(pa => ({
      questionId: pa.questionId,
      answer: pa.selectedOption || "", // Ensure answer is always a string
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
    isFinishingPracticeRef.current = true;
    setIsFinishingPractice(true);
  }, [prepareAndCommitFinalAnswer, localActiveQuiz, practiceAttempts, setGlobalQuizResult, attemptSettings.timeLimit, timeLeft]);

  useEffect(() => {
    if (isFinishingPractice && isFinishingPracticeRef.current && localActiveQuiz) {
      navigate(`/results/${localActiveQuiz.id}`);
    }
  }, [isFinishingPractice, localActiveQuiz, navigate]);

  const handleSelectOption = (optionText: string) => {
    if (isCurrentSelectionChecked || isFinishingPracticeRef.current) return;
    setCurrentTentativeSelection(optionText);
  };

  const handleCheckAnswer = () => {
    if (!currentTentativeSelection || !currentQuestion || isFinishingPracticeRef.current) return;

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
  };

  const handleNextQuestionLogic = useCallback(() => {
    if (!localActiveQuiz || !currentQuestion || isFinishingPracticeRef.current) return;

    if (currentTentativeSelection && !isCurrentSelectionChecked) {
      setPracticeAttempts(prev =>
        prev.map(pa =>
          pa.questionId === currentQuestion.id && (pa.selectedOption !== currentTentativeSelection || pa.isCorrect === null)
            ? { ...pa, selectedOption: currentTentativeSelection, isCorrect: null, attempts: pa.attempts || 0 }
            : pa
        )
      );
    }

    if (!goToNextQuestion()) { 
      triggerFinishPractice();
    }
  }, [localActiveQuiz, currentQuestion, goToNextQuestion, triggerFinishPractice, currentTentativeSelection, isCurrentSelectionChecked]);

  const handlePreviousQuestionLogic = useCallback(() => {
    if (!currentQuestion || isFinishingPracticeRef.current) return;
    if (currentTentativeSelection && !isCurrentSelectionChecked) {
      setPracticeAttempts(prev =>
        prev.map(pa =>
          pa.questionId === currentQuestion.id && (pa.selectedOption !== currentTentativeSelection || pa.isCorrect === null)
            ? { ...pa, selectedOption: currentTentativeSelection, isCorrect: null, attempts: pa.attempts || 0 }
            : pa
        )
      );
    }
    goToPreviousQuestion();
  }, [goToPreviousQuestion, currentTentativeSelection, isCurrentSelectionChecked, currentQuestion]);

  const handleCloseTimesUpModalAndSubmit = useCallback(() => {
    setShowTimesUpModalState(false);
    triggerFinishPractice();
  }, [triggerFinishPractice]);


  if (isFinishingPractice) {
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
            console.warn("QuizPracticePage: currentQuestion is undefined because index is out of bounds. Initiating finish.");
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

  const progressPercent = totalQuestions > 0 ? ((currentQuestionIndex + 1) / totalQuestions) * 100 : 0;
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

  return (
    <Card className="max-w-3xl mx-auto shadow-2xl !border-slate-700/40 !rounded-2xl animate-page-slide-fade-in" useGlassEffect>
      <div className="mb-6 sm:mb-8">
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
          className={`p-6 sm:p-8 bg-slate-700/60 rounded-xl shadow-inner border border-slate-600/70 min-h-[200px] flex flex-col`}
        >
          <div key={currentQuestion.id} className="animate-fadeInUp">
            <h2 className="text-lg sm:text-xl font-semibold text-slate-100 mb-8 leading-relaxed">
              <MathText text={currentQuestion.questionText} />
            </h2>

            <div className="flex-grow">
              <div className="space-y-4">
                {currentQuestion.options.map((option, index) => {
                  const isSelectedForDisplay = currentTentativeSelection === option;
                  let optionStyle = `bg-slate-600 hover:bg-slate-500/80 border-slate-500 hover:border-sky-500 text-slate-100`;
                  let icon = <CircleIcon className="w-6 h-6 text-slate-400 group-hover:text-sky-400 transition-colors var(--duration-fast) var(--ease-ios)" strokeWidth={2.5}/>;

                  if (isCurrentSelectionChecked) {
                    if (isSelectedForDisplay && isCurrentSelectionCorrectFeedback) {
                      optionStyle = 'bg-green-500/40 border-green-500 text-green-50 font-semibold scale-[1.01]';
                      icon = <CheckCircleIcon className="w-6 h-6 text-green-50" isFilled={true}/>;
                    } else if (isSelectedForDisplay && !isCurrentSelectionCorrectFeedback) {
                      optionStyle = 'bg-red-500/40 border-red-500 text-red-50 font-semibold scale-[1.01]';
                      icon = <XCircleIcon className="w-6 h-6 text-red-50" />;
                    } else if (option === currentQuestion.correctAnswer) {
                       optionStyle = 'bg-green-500/30 border-green-600 text-green-100 opacity-90';
                       icon = <CheckCircleIcon className="w-6 h-6 text-green-100" isFilled={false}/>;
                    } else {
                      optionStyle = 'bg-slate-600/50 border-slate-700 text-slate-400 opacity-70 cursor-not-allowed';
                      icon = <CircleIcon className="w-6 h-6 text-slate-500" strokeWidth={2.5}/>;
                    }
                  } else if (isSelectedForDisplay) {
                     optionStyle = 'bg-sky-500/50 border-sky-400 text-sky-50 font-semibold hover:bg-sky-500/60 scale-[1.01]';
                     icon = <CircleIcon className="w-6 h-6 text-sky-50" isFilled={true} strokeWidth={1}/>;
                  }

                  return (
                    <button
                      key={`${option}-${index}`} onClick={() => handleSelectOption(option)}
                      disabled={isCurrentSelectionChecked || isFinishingPracticeRef.current}
                      className={`w-full flex items-center text-left p-4 sm:p-4 rounded-xl border-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-400/50 focus-visible:ring-offset-2 ${isSelectedForDisplay ? 'focus-visible:ring-offset-white' : 'focus-visible:ring-offset-slate-700'} shadow-lg
                                 transition-all var(--duration-fast) var(--ease-ios) will-change-transform, border, background-color
                                 ${optionStyle}`}
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
        </div>

        {isCurrentSelectionChecked && (
          <div className={`my-6 p-5 bg-slate-700/40 rounded-xl border border-slate-600/50 animate-fadeInUp`}>
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

      <div className="flex flex-col space-y-3 pt-6 border-t border-slate-700/60 mt-6 sm:mt-8"> {/* Added margin-top here */}
        {!isCurrentSelectionChecked ? (
          <Button onClick={handleCheckAnswer} disabled={!currentTentativeSelection || isFinishingPracticeRef.current} variant="primary" size="lg" leftIcon={<CheckCircleIcon className="w-5 h-5"/>} className="w-full py-3 rounded-xl">
            {t('checkAnswer')}
          </Button>
        ) : (
          <>
            {isCurrentSelectionCorrectFeedback === true && <p className={`text-center text-green-400 font-semibold text-lg animate-fadeIn`}>{t('answerCorrect')}</p>}
            {isCurrentSelectionCorrectFeedback === false && <p className={`text-center text-red-400 font-semibold text-lg animate-fadeIn`}>{t('answerIncorrect')}</p>}
            <Button
                onClick={handleNextQuestionLogic}
                variant="primary"
                size="lg"
                rightIcon={<ChevronRightIcon className="w-5 h-5"/>}
                disabled={isFinishingPracticeRef.current}
                className={`w-full py-3 rounded-xl ${isCurrentSelectionCorrectFeedback ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
            >
              {isLastQuestion ? t('finishPractice') : t('nextQuestion')}
            </Button>
          </>
        )}

        <div className="flex justify-between items-center pt-3">
            <Button onClick={handlePreviousQuestionLogic} disabled={currentQuestionIndex === 0 || isFinishingPracticeRef.current} variant="outline" size="md" leftIcon={<ChevronLeftIcon className="w-4 h-4"/>} className="py-2.5 px-5 rounded-lg">
                {t('previous')}
            </Button>
            {!isCurrentSelectionChecked && ( 
              isLastQuestion ? (
                <Button onClick={triggerFinishPractice} disabled={isFinishingPracticeRef.current} variant="outline" size="md" rightIcon={<ChevronRightIcon className="w-4 h-4"/>} className="py-2.5 px-5 rounded-lg">
                    {t('finishPractice')}
                </Button>
              ) : (
                <Button onClick={handleNextQuestionLogic} disabled={isFinishingPracticeRef.current} variant="outline" size="md" rightIcon={<ChevronRightIcon className="w-4 h-4"/>} className="py-2.5 px-5 rounded-lg">
                    {t('skipQuestion')}
                </Button>
              )
            )}
            {isCurrentSelectionChecked && ( 
                 <Button onClick={triggerFinishPractice} disabled={isFinishingPracticeRef.current} variant="outline" size="md" className="py-2.5 px-5 rounded-lg">
                    {t('finishPractice')}
                </Button>
            )}
        </div>
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
          <p className="text-slate-200 text-base leading-relaxed text-center">
            {t('timesUpMessage')}
          </p>
        </Modal>
      )}
    </Card>
  );
};

export default QuizPracticePage;
