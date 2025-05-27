
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext, useTranslation } from '../../App';
import { Quiz, Question, UserAnswer, QuizResult } from '../../types';
import { Button, Card, LoadingSpinner, ProgressBar, Modal, Tooltip } from '../../components/ui';
import MathText from '../../components/MathText';
import { CircleIcon, ChevronLeftIcon, ChevronRightIcon, LightbulbIcon } from '../../constants';
import { useQuizFlow } from './hooks/useQuizFlow'; // Import the custom hook

export const QuizTakingPage: React.FC = () => {
  const { setQuizResult } = useAppContext();
  const { t } = useTranslation();
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();

  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({}); // questionId: selectedOptionText
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showTimesUpModalState, setShowTimesUpModalState] = useState(false); // Renamed to avoid conflict

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
  } = useQuizFlow(quizId, { onTimeUp: handleTimeUp });


  useEffect(() => {
    // When currentQuestion changes (due to navigation), load any existing answer for it
    if (currentQuestion && userAnswers[currentQuestion.id]) {
      setSelectedOption(userAnswers[currentQuestion.id]);
    } else {
      setSelectedOption(null); // Reset selection for new question
    }
  }, [currentQuestion, userAnswers]);


  const handleSelectOption = (option: string) => {
    setSelectedOption(option);
  };
  
  const storeCurrentAnswer = useCallback(() => {
    if (currentQuestion && selectedOption) {
      setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: selectedOption }));
    }
  }, [currentQuestion, selectedOption]);

  const handleFinalSubmit = useCallback(() => {
    if (!localActiveQuiz) return;
    
    storeCurrentAnswer(); // Ensure the very last selection is stored

    let correctCount = 0;
    const finalUserAnswersArray: UserAnswer[] = [];

    localActiveQuiz.questions.forEach(q => {
      const userAnswerText = userAnswers[q.id]; // Use the state that has accumulated all answers
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
    };
    setQuizResult(result);
    setShowConfirmationModal(false);
    setShowTimesUpModalState(false);
    navigate(`/results/${localActiveQuiz.id}`);
  }, [localActiveQuiz, userAnswers, timeLeft, setQuizResult, navigate, storeCurrentAnswer, totalQuestions, attemptSettings.timeLimit]);


  const handleNextQuestionAttempt = () => {
    if (!localActiveQuiz) return;
    storeCurrentAnswer();
    
    if (!goToNextQuestion()) { // If goToNextQuestion returns false, it's the last question
      setShowConfirmationModal(true);
    }
  };

  const handlePreviousQuestionAttempt = () => {
    storeCurrentAnswer();
    goToPreviousQuestion();
  };
  

  if (loading || !localActiveQuiz) {
    return <LoadingSpinner text={t('quizTakingLoading')} className="mt-24" size="xl"/>;
  }
  
  if (!currentQuestion) {
     return (
        <Card className="max-w-3xl mx-auto shadow-2xl !rounded-2xl" useGlassEffect>
            <LoadingSpinner text={t('quizTakingLoading')} />
            <p className="text-center text-slate-300 mt-4">{t('quizTakingErrorQuestionNotFound')}</p>
        </Card>
     );
  }


  const progressPercent = totalQuestions > 0 ? (currentQuestionIndex + 1) / totalQuestions * 100 : 0;
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

  return (
    <Card className="max-w-3xl mx-auto shadow-2xl !border-slate-700/40 !rounded-2xl" useGlassEffect>
      <div className="mb-8 sm:mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-50 mb-3 sm:mb-4 leading-tight tracking-tight line-clamp-2" title={localActiveQuiz.title}>
          <MathText text={localActiveQuiz.title} />
        </h1>
        <div className="flex justify-between items-center text-sm text-slate-300 mb-4 sm:mb-5">
          <span>{t('quizTakingQuestionProgress', {current: currentQuestionIndex + 1, total: totalQuestions})}</span>
          {localActiveQuiz.config?.customUserPrompt && (
            <Tooltip content={<div className="max-w-xs text-left text-xs"><MathText text={localActiveQuiz.config.customUserPrompt}/></div>} placement="bottom-end">
                <LightbulbIcon className="w-5 h-5 text-yellow-300 cursor-help"/>
            </Tooltip>
          )}
          {timeLeft !== null && <span className={`font-semibold ${timeLeft <= 60 ? 'text-red-400 animate-pulse' : 'text-sky-300'}`}>{t('quizTakingTimeLeft', { time: formatTime(timeLeft) })}</span>}
        </div>
        <ProgressBar progress={progressPercent} size="lg" barClassName="bg-gradient-to-r from-sky-500 to-indigo-500"/>
      </div>

    <div>
      <div className={`mb-8 sm:mb-10 p-5 sm:p-8 bg-slate-700/60 rounded-xl shadow-inner border border-slate-600/70 min-h-[280px] flex flex-col`}>
        <h2 className="text-lg sm:text-xl font-semibold text-slate-100 mb-6 sm:mb-8 leading-relaxed">
          <MathText text={currentQuestion.questionText} />
        </h2>
        
        <div className="flex-grow">
            <div className="space-y-3.5 sm:space-y-4">
            {currentQuestion.options.map((option, index) => {
                const isSelectedForDisplay = selectedOption === option;
                let optionStyle = `bg-slate-600 hover:bg-slate-500/80 border-slate-500 hover:border-sky-500 text-slate-100 hover:scale-[1.02]`;
                let icon = <CircleIcon className="w-6 h-6 text-slate-400 group-hover:text-sky-400" strokeWidth={2.5}/>;

                if (isSelectedForDisplay) {
                   optionStyle = 'bg-sky-500/50 border-sky-400 text-sky-50 font-semibold hover:bg-sky-500/60 scale-105';
                   icon = <CircleIcon className="w-6 h-6 text-sky-50" isFilled={true} strokeWidth={1}/>;
                }

                return (
                <button
                    key={index}
                    onClick={() => handleSelectOption(option)}
                    className={`w-full flex items-center text-left p-3.5 sm:p-4 rounded-xl border-2 transition-all duration-200 ease-out transform focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-400/50 focus-visible:ring-offset-2 ${isSelectedForDisplay ? 'focus-visible:ring-offset-white' : 'focus-visible:ring-offset-slate-700'} shadow-lg ${optionStyle}`}
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

      <div className="flex flex-col space-y-3 pt-6 sm:pt-8 border-t border-slate-700/60">
        <Button 
            onClick={handleNextQuestionAttempt} 
            disabled={!selectedOption} 
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
          onClose={() => setShowConfirmationModal(false)}
          title={t('quizTakingSubmitQuiz')}
          size="md"
          footerContent={
            <div className="flex justify-end gap-3.5">
              <Button variant="secondary" onClick={() => setShowConfirmationModal(false)} size="md">
                {t('cancel')}
              </Button>
              <Button variant="primary" onClick={handleFinalSubmit} size="md">
                {t('submit')}
              </Button>
            </div>
          }
        >
          <p className="text-slate-200 text-base leading-relaxed">
            {t('submitConfirmationMessage')}
          </p>
        </Modal>
      )}

      {showTimesUpModalState && (
        <Modal
          isOpen={showTimesUpModalState}
          onClose={() => { setShowTimesUpModalState(false); handleFinalSubmit();}} 
          title={t('timesUp')}
          size="md"
          hideCloseButton={true}
          footerContent={
            <div className="flex justify-center">
              <Button variant="primary" onClick={() => { setShowTimesUpModalState(false); handleFinalSubmit(); }} size="md">
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
