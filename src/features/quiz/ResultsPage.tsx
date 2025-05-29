
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAppContext, useTranslation } from '../../App';
import { Quiz, Question } from '../../types';
import { Button, Card, Accordion, ProgressBar, LoadingSpinner, Tooltip } from '../../components/ui';
import MathText from '../../components/MathText';
import { CheckCircleIcon, XCircleIcon, DocumentTextIcon, ArrowUturnLeftIcon, PlusCircleIcon, HomeIcon } from '../../constants';
// Removed useIntersectionObserver import as framer-motion will handle animations

interface QuestionResultItemProps {
  question: Question;
  userAnswerText: string;
  isCorrect: boolean;
  index: number;
  sourceContentSnippet?: string;
  explanationIconUrl: string;
  initiallyOpen: boolean;
}

const questionItemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

const QuestionResultItem: React.FC<QuestionResultItemProps> = ({
  question,
  userAnswerText,
  isCorrect,
  index,
  sourceContentSnippet,
  explanationIconUrl,
  initiallyOpen,
}) => {
  const { t } = useTranslation();
  // Removed accordionRef and isAccordionVisible as framer-motion handles animation

  return (
    <motion.div
      variants={questionItemVariants}
      // Removed style={{ animationDelay ... }} as staggerChildren will handle it
    >
      <Accordion
        initiallyOpen={initiallyOpen}
        containerClassName={`!rounded-xl shadow-lg ${isCorrect ? `!border-green-500/60` : `!border-red-500/60`}`}
        title={
          <div className="flex items-center w-full gap-3">
            <span className="text-xs text-slate-400 font-semibold">Q{index + 1}.</span>
            <span className={`flex-grow text-sm sm:text-base ${isCorrect ? 'text-slate-200' : 'text-slate-100 font-semibold'} min-w-0 break-words`} title={question.questionText}>
              <MathText text={question.questionText} />
            </span>
          </div>
        }
        titleClassName={`py-3.5 px-4 sm:px-5 rounded-t-xl ${isCorrect ? `hover:!bg-green-400/15` : `hover:!bg-red-400/15`}`}
        contentClassName={`!bg-slate-700/30`}
      >
        <div className="space-y-4 text-sm sm:text-base">
          <p className="text-slate-300">
            <strong className="font-semibold text-slate-100">{t('resultsYourAnswer')} </strong>
            <span className={`${isCorrect ? 'text-green-400 font-medium' : 'text-red-400 font-medium'} break-words`}>
              <MathText text={userAnswerText || t('resultsNotAnswered')} />
            </span>
          </p>
          {!isCorrect && (
            <p className="text-slate-300">
              <strong className="font-semibold text-slate-100">{t('resultsCorrectAnswerMC')} </strong>
              <span className="text-green-400 font-medium break-words">
                <MathText text={question.correctAnswer} />
              </span>
            </p>
          )}
          <div className="mt-5 pt-5 border-t border-slate-600/70">
            <p className="flex items-start text-base font-semibold text-sky-300 mb-2.5">
              <img src={explanationIconUrl} alt={t('resultsExplanationTitle')} className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
              {t('resultsExplanationTitle')}
            </p>
            <div className="text-slate-300/90 leading-relaxed whitespace-pre-wrap break-words">
              <MathText text={question.explanation || t('resultsNoExplanation')} />
            </div>
          </div>
          {sourceContentSnippet && (
            <details className="mt-5 pt-5 border-t border-slate-600/70">
              <summary className="text-xs text-slate-400 cursor-pointer hover:text-sky-300 flex items-center font-semibold group transition-colors var(--duration-fast) var(--ease-ios)"> <DocumentTextIcon className="w-4 h-4 mr-2.5 text-slate-500 group-hover:text-sky-400 transition-colors var(--duration-fast) var(--ease-ios)" strokeWidth={2} /> {t('resultsViewSourceSnippet')} </summary>
              <blockquote className={`mt-3 text-xs text-slate-400/80 max-h-36 overflow-y-auto p-3.5 bg-slate-700/60 border border-slate-600/60 rounded-lg shadow-inner italic`}>
                <MathText text={sourceContentSnippet} />
              </blockquote>
            </details>
          )}
        </div>
      </Accordion>
    </motion.div>
  );
};
QuestionResultItem.displayName = "QuestionResultItem";

const pageContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

const listContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.075, // Stagger for individual question items
    },
  },
};


const ResultsPage: React.FC = () => {
  const {
    quizResult,
    isLoading: appContextIsLoading,
    getQuizByIdFromAll,
    setActiveQuiz,
  } = useAppContext();
  const { t } = useTranslation();
  const { quizId: paramQuizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();

  // Removed refs and visibility states for framer-motion
  // pageCardRef, isPageCardVisible
  // summaryCardRef, isSummaryCardVisible
  // breakdownTitleRef, isBreakdownTitleVisible
  // actionsRef, areActionsVisible

  const [currentDisplayQuiz, setCurrentDisplayQuiz] = useState<Quiz | null>(null);
  const [isLoadingQuizData, setIsLoadingQuizData] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);

  useEffect(() => {
    setIsLoadingQuizData(true);
    setErrorState(null);

    if (appContextIsLoading) {
      return;
    }

    if (!quizResult) {
      console.warn(`ResultsPage: App context loaded, but quizResult is null. Param quizId from URL: ${paramQuizId}.`);
      setErrorState(t('resultsErrorNotFound', { quizId: paramQuizId || "unknown" }));
      setCurrentDisplayQuiz(null);
      setIsLoadingQuizData(false);
      return;
    }

    if (!quizResult.quizId) {
      console.error("ResultsPage: quizResult object exists but quizResult.quizId is missing. Invalid state.");
      setErrorState(t('resultsErrorNotFound', { quizId: "unknown" }));
      setCurrentDisplayQuiz(null);
      setIsLoadingQuizData(false);
      return;
    }

    const quizToDisplay = getQuizByIdFromAll(quizResult.quizId);

    if (quizToDisplay) {
      setCurrentDisplayQuiz(quizToDisplay);
      setActiveQuiz(quizToDisplay);
      setIsLoadingQuizData(false);
    } else {
      console.error(`ResultsPage: Quiz ${quizResult.quizId} not found in fully loaded quizzes list.`);
      setErrorState(t('resultsErrorNotFound', { quizId: quizResult.quizId }));
      setCurrentDisplayQuiz(null);
      setIsLoadingQuizData(false);
    }
  }, [quizResult, getQuizByIdFromAll, setActiveQuiz, paramQuizId, appContextIsLoading, t]);


  if (isLoadingQuizData) {
    return (
     <div className="flex flex-col items-center justify-center min-h-[calc(100vh-380px)] text-center p-5">
        <LoadingSpinner text={t('resultsLoading')} className="mb-10" size="xl"/>
     </div>
   );
 }

  if (errorState) {
    return (
     <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex flex-col items-center justify-center min-h-[calc(100vh-380px)] text-center p-5"
      >
        <XCircleIcon className="w-16 h-16 text-red-400/80 mb-6" />
        <p className="text-xl font-semibold text-slate-200 mb-3">{t('error')}</p>
        <p className="text-base text-slate-400 mb-10 max-w-md">{errorState}</p>
        <Button onClick={() => navigate('/dashboard')} variant="secondary" size="lg" className="py-3 px-7 rounded-xl"> {t('resultsGoToDashboard')} </Button>
     </motion.div>
   );
  }

  if (!quizResult || !currentDisplayQuiz) {
    console.error("ResultsPage: Reached render stage where quizResult or currentDisplayQuiz is unexpectedly null despite no explicit error state and not loading.");
    return (
     <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex flex-col items-center justify-center min-h-[calc(100vh-380px)] text-center p-5"
      >
        <XCircleIcon className="w-16 h-16 text-red-400/80 mb-6" />
        <p className="text-xl font-semibold text-slate-200 mb-3">{t('error')}</p>
        <p className="text-base text-slate-400 mb-10 max-w-md">{t('resultsErrorNotFound', { quizId: paramQuizId || "unknown" })} (Unexpected)</p>
        <Button onClick={() => navigate('/dashboard')} variant="secondary" size="lg" className="py-3.5 px-8 rounded-xl"> {t('resultsGoToDashboard')} </Button>
     </motion.div>
   );
  }

  if (currentDisplayQuiz.id !== quizResult.quizId) {
   console.error("ResultsPage: Mismatch between currentDisplayQuiz.id and quizResult.quizId. This indicates a critical state inconsistency.");
    return (
     <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex flex-col items-center justify-center min-h-[calc(100vh-380px)] text-center p-5"
      >
        <XCircleIcon className="w-16 h-16 text-red-400/80 mb-6" />
        <p className="text-xl font-semibold text-red-400 mb-4">Critical Error: Data Mismatch</p>
        <p className="text-sm text-slate-500">Displayed Quiz ID: {currentDisplayQuiz.id}, Result Quiz ID: {quizResult.quizId}</p>
        <Button onClick={() => navigate('/dashboard')} variant="secondary" size="lg" className="py-3.5 px-8 rounded-xl mt-6"> {t('resultsGoToDashboard')} </Button>
     </motion.div>
   );
  }

  const { score, answers, totalCorrect, totalQuestions, sourceMode } = quizResult;
  const isAnswerCorrect = (question: Question, userAnswerText: string): boolean => {
    if (!userAnswerText) return false;
    return userAnswerText.trim() === question.correctAnswer.trim();
  };

  const scoreColor = score >= 70 ? 'text-green-400' : score >= 40 ? 'text-amber-400' : 'text-red-400';
  const scoreProgressGradient = score >= 70 ? 'bg-gradient-to-r from-green-400 to-emerald-400'
                                : score >= 40 ? 'bg-gradient-to-r from-amber-400 to-yellow-400'
                                : 'bg-gradient-to-r from-red-400 to-rose-400';

  const explanationIconUrl = "https://img.icons8.com/?size=256&id=eoxMN35Z6JKg&format=png";

  const pageTitle = sourceMode === 'practice'
    ? t('practiceSummaryTitle', { quizTitle: currentDisplayQuiz.title })
    : t('resultsTitle', { quizTitle: currentDisplayQuiz.title });

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={pageContainerVariants}
    >
      <Card className="max-w-4xl mx-auto shadow-2xl !border-slate-700/40 !rounded-2xl" useGlassEffect>
        <motion.h1 variants={itemVariants} className="text-3xl sm:text-4xl font-bold text-slate-50 mb-4 text-center leading-tight tracking-tight line-clamp-2" title={currentDisplayQuiz.title}>
          <MathText text={pageTitle} />
        </motion.h1>
        <motion.p variants={itemVariants} className="text-base text-slate-300/80 mb-12 text-center">
            {sourceMode === 'practice' ? t('practiceSummarySubtitle') : t('resultsSubtitle')}
        </motion.p>

        <motion.div variants={itemVariants}>
          <Card className={`mb-12 !bg-slate-700/70 shadow-xl !border-slate-600/60 p-0 overflow-hidden !rounded-2xl`} useGlassEffect={false}>
            <div className={`flex flex-col md:flex-row justify-around items-center text-center gap-8 p-6 sm:p-10 !bg-slate-800/60`}>
              <div className="flex flex-col items-center">
                <p className="text-sm text-slate-400 uppercase tracking-wider font-medium mb-1.5">{t('resultsYourScore')}</p>
                <p className={`text-6xl sm:text-7xl font-extrabold ${scoreColor} tracking-tight`}>{score.toFixed(0)}<span className="text-4xl">%</span></p>
              </div>
              <div className={`w-full md:w-px h-px md:h-24 bg-slate-600/70 my-3 md:my-0`}></div>
              <div className="flex flex-col items-center">
                <p className="text-sm text-slate-400 uppercase tracking-wider font-medium mb-1.5">{t('resultsCorrectAnswers')}</p>
                <p className="text-5xl sm:text-6xl font-bold text-slate-100">{totalCorrect} <span className="text-3xl text-slate-400/80">/ {totalQuestions}</span></p>
              </div>
            </div>
            <ProgressBar progress={score} className="w-full rounded-b-2xl overflow-hidden" size="lg" barClassName={`${scoreProgressGradient} !h-3.5`} showPercentage={false} />
          </Card>
        </motion.div>

        <motion.h2 variants={itemVariants} className={`text-2xl sm:text-3xl font-semibold text-slate-100 mb-8 sm:mb-10`}>{t('resultsBreakdownTitle')}</motion.h2>
        
        <motion.div 
            variants={listContainerVariants} // This will stagger its children (QuestionResultItem)
            initial="hidden"
            animate="visible"
            className="space-y-5"
        >
          {Array.isArray(currentDisplayQuiz.questions) && currentDisplayQuiz.questions.map((question, index) => {
            const userAnswerObj = answers.find(a => a.questionId === question.id);
            const userAnswerText = userAnswerObj ? userAnswerObj.answer : "";
            const correct = isAnswerCorrect(question, userAnswerText);

            return (
              <QuestionResultItem
                key={question.id} 
                question={question}
                userAnswerText={userAnswerText}
                isCorrect={correct}
                index={index}
                sourceContentSnippet={currentDisplayQuiz.sourceContentSnippet}
                explanationIconUrl={explanationIconUrl}
                initiallyOpen={!correct}
              />
            );
          })}
        </motion.div>

        <motion.div variants={itemVariants} className={`mt-14 flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-5`}>
          {sourceMode === 'practice' ? (
            <Button onClick={() => navigate(`/practice/${currentDisplayQuiz.id}`)} variant="outline" size="lg" leftIcon={<ArrowUturnLeftIcon className="w-5 h-5"/>} className="w-full sm:w-auto py-3 px-8 rounded-xl">
              {t('practiceAgain')}
            </Button>
          ) : (
            <Button onClick={() => navigate(`/quiz/${currentDisplayQuiz.id}`)} variant="outline" size="lg" leftIcon={<ArrowUturnLeftIcon className="w-5 h-5"/>} className="w-full sm:w-auto py-3 px-8 rounded-xl">
              {t('resultsTryAgain')}
            </Button>
          )}
          <Button onClick={() => navigate('/dashboard')} variant="secondary" size="lg" leftIcon={<HomeIcon className="w-5 h-5"/>} className="w-full sm:w-auto py-3 px-8 rounded-xl">
             {t('resultsBackToDashboard')}
          </Button>
          <Button onClick={() => navigate('/create')} variant="primary" size="lg" leftIcon={<PlusCircleIcon className="w-5 h-5" />} className="w-full sm:w-auto bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-white shadow-xl py-3 px-8 rounded-xl">
            {t('resultsCreateNewQuiz')}
          </Button>
        </motion.div>
      </Card>
    </motion.div>
  );
};
ResultsPage.displayName = "ResultsPage";
export default ResultsPage;
