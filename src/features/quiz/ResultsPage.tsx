import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAppContext, useTranslation } from '../../App';
import { Quiz, Question } from '../../types';
import { Button, Card, Accordion, ProgressBar, LoadingSpinner } from '../../components/ui';
import MathText from '../../components/MathText';
import AccordionQuestionTitle from './components/AccordionQuestionTitle';
import { XCircleIcon, DocumentTextIcon, ArrowUturnLeftIcon, PlusCircleIcon, HomeIcon } from '../../constants';
import useShouldReduceMotion from '../../hooks/useShouldReduceMotion';


interface QuestionResultItemProps {
  question: Question;
  userAnswerText: string;
  isCorrect: boolean;
  index: number;
  sourceContentSnippet?: string;
  initiallyOpen: boolean;
}

const questionItemVariantsFactory = (shouldReduceMotion: boolean) => ({ // Renamed
  hidden: { opacity: shouldReduceMotion ? 1 : 0, y: shouldReduceMotion ? 0 : 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: shouldReduceMotion ? 0.001 : 0.4,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
});


const QuestionResultItem: React.FC<QuestionResultItemProps> = ({
  question,
  userAnswerText,
  isCorrect,
  index,
  sourceContentSnippet,
  initiallyOpen = false, 
}) => {
  const { t } = useTranslation();
  const shouldReduceMotion = useShouldReduceMotion();
  const currentQuestionItemVariants = useMemo(() => questionItemVariantsFactory(shouldReduceMotion), [shouldReduceMotion]);

  return (
    <motion.div
      variants={currentQuestionItemVariants}
    >
      <Accordion
        initiallyOpen={initiallyOpen}
        containerClassName={`!rounded-xl shadow-lg ${isCorrect ? `!border-green-500/60` : `!border-red-500/60`}`}
        title={
          <AccordionQuestionTitle
            question={question}
            index={index}
            isCorrect={isCorrect}
          />
        }
        titleClassName={`py-3.5 px-4 sm:py-4 sm:px-5 rounded-t-xl ${isCorrect ? `hover:!bg-green-400/15` : `hover:!bg-red-400/15`}`}
        contentClassName={`!bg-[var(--color-bg-surface-2)]/30`}
      >
        <div className="space-y-5 text-sm sm:text-base p-4 sm:p-5"> {/* Added padding */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {question.options.map((option, i) => {
              const isUserAnswer = option === userAnswerText;
              const isCorrectAnswer = option === question.correctAnswer;
              let optionStyle = "py-2.5 px-3.5 rounded-lg border text-sm transition-all var(--duration-fast) var(--ease-ios)";

              if (isUserAnswer) {
                optionStyle += isCorrectAnswer
                  ? " bg-green-500/20 border-green-500/70 text-green-200 font-semibold ring-2 ring-green-500/50"
                  : " bg-red-500/20 border-red-500/70 text-red-200 font-semibold ring-2 ring-red-500/50";
              } else if (isCorrectAnswer) {
                optionStyle += " bg-green-500/10 border-green-500/40 text-green-300";
              } else {
                optionStyle += " bg-[var(--color-bg-surface-2)]/70 border-[var(--color-border-default)] text-[var(--color-text-secondary)] opacity-80";
              }

              return (
                <div key={i} className={optionStyle}>
                  <div className="flex items-center">
                    <span className="font-medium mr-2.5 flex-shrink-0">{String.fromCharCode(65 + i)}.</span>
                    <div className="flex-grow markdown-content option-content flex items-center">
                      <MathText text={option} markdownFormatting={true} stripPrefix={true} compact={true} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Updated Explanation Section - Modeled after PracticeQuizExplanation */}
          <div className="mt-5 border-t border-[var(--color-border-default)] pt-5"> {/* Consistent margin and padding */}
            <div className="flex items-center gap-2 mb-3"> 
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--color-primary-accent)]" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="font-semibold text-[var(--color-primary-accent)] text-base">{t('resultsExplanationTitle')}</span>
            </div>
            
            <div className="explanation-content"> 
              <div className="pl-1.5 border-l-2 border-[var(--color-primary-accent)]/20">
                <div className="explanation-text text-sm leading-relaxed text-[var(--color-text-body)] markdown-content"> {/* Added markdown-content */}
                  <MathText text={question.explanation || t('resultsNoExplanation')} markdownFormatting={true} />
                </div>
              </div>
            </div>
          </div>
          {sourceContentSnippet && (
            <details className="mt-5 pt-5 border-t border-[var(--color-border-default)]">
              <summary className="text-xs text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-primary-accent)] flex items-center font-semibold group transition-colors var(--duration-fast) var(--ease-ios)">
                <DocumentTextIcon className="w-4 h-4 mr-2.5 text-[var(--color-text-muted)] group-hover:text-[var(--color-primary-accent)] transition-colors var(--duration-fast) var(--ease-ios)" strokeWidth={2} />
                {t('resultsViewSourceSnippet')}
              </summary>
              <blockquote className={`mt-3 text-xs text-[var(--color-text-muted)]/80 max-h-36 overflow-y-auto p-3.5 bg-[var(--color-bg-surface-2)]/60 border border-[var(--color-border-default)] rounded-lg shadow-inner italic markdown-content`}>
                <MathText text={sourceContentSnippet} markdownFormatting={true}/>
              </blockquote>
            </details>
          )}
        </div>
      </Accordion>
    </motion.div>
  );
};
QuestionResultItem.displayName = "QuestionResultItem";

const pageContainerVariantsFactory = (shouldReduceMotion: boolean) => ({
  hidden: { opacity: shouldReduceMotion ? 1 : 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: shouldReduceMotion ? 0 : 0.1,
      duration: shouldReduceMotion ? 0.001 : 0.3,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
});

const itemVariantsFactory = (shouldReduceMotion: boolean) => ({
  hidden: { opacity: shouldReduceMotion ? 1 : 0, y: shouldReduceMotion ? 0 : 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: shouldReduceMotion ? 0.001 : 0.4,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
});

const listContainerVariantsFactory = (shouldReduceMotion: boolean) => ({
  hidden: { opacity: shouldReduceMotion ? 1 : 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: shouldReduceMotion ? 0 : 0.075, 
    },
  },
});


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
  const shouldReduceMotion = useShouldReduceMotion();

  const [currentDisplayQuiz, setCurrentDisplayQuiz] = useState<Quiz | null>(null);
  const [isLoadingQuizData, setIsLoadingQuizData] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);

  const pageVariants = useMemo(() => pageContainerVariantsFactory(shouldReduceMotion), [shouldReduceMotion]);
  const generalItemVariants = useMemo(() => itemVariantsFactory(shouldReduceMotion), [shouldReduceMotion]);
  const listVariants = useMemo(() => listContainerVariantsFactory(shouldReduceMotion), [shouldReduceMotion]);


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
      setActiveQuiz(quizToDisplay); // Set the active quiz in context if needed elsewhere
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
        initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0.001 : 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex flex-col items-center justify-center min-h-[calc(100vh-380px)] text-center p-5"
      >
        <XCircleIcon className="w-16 h-16 mb-6 text-[var(--color-danger-accent)]" />
        <p className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">{t('error')}</p>
        <p className="text-base text-[var(--color-text-secondary)] mb-10 max-w-md">{errorState}</p>
        <Button onClick={() => navigate('/dashboard')} variant="secondary" size="lg" className="py-3 px-7 rounded-xl"> {t('resultsGoToDashboard')} </Button>
     </motion.div>
   );
  }

  if (!quizResult || !currentDisplayQuiz) {
    console.error("ResultsPage: Reached render stage where quizResult or currentDisplayQuiz is unexpectedly null despite no explicit error state and not loading.");
    return (
     <motion.div 
        initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0.001 : 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex flex-col items-center justify-center min-h-[calc(100vh-380px)] text-center p-5"
      >
        <XCircleIcon className="w-16 h-16 mb-6 text-[var(--color-danger-accent)]" />
        <p className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">{t('error')}</p>
        <p className="text-base text-[var(--color-text-secondary)] mb-10 max-w-md">{t('resultsErrorNotFound', { quizId: paramQuizId || "unknown" })} (Unexpected)</p>
        <Button onClick={() => navigate('/dashboard')} variant="secondary" size="lg" className="py-3.5 px-8 rounded-xl"> {t('resultsGoToDashboard')} </Button>
     </motion.div>
   );
  }

  if (currentDisplayQuiz.id !== quizResult.quizId) {
   console.error("ResultsPage: Mismatch between currentDisplayQuiz.id and quizResult.quizId. This indicates a critical state inconsistency.");
    return (
     <motion.div 
        initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0.001 : 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex flex-col items-center justify-center min-h-[calc(100vh-380px)] text-center p-5"
      >
        <XCircleIcon className="w-16 h-16 mb-6 text-[var(--color-danger-accent)]" />
        <p className="text-xl font-semibold mb-4 text-[var(--color-danger-accent)]">Critical Error: Data Mismatch</p>
        <p className="text-sm text-[var(--color-text-muted)]">Displayed Quiz ID: {currentDisplayQuiz.id}, Result Quiz ID: {quizResult.quizId}</p>
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

  const pageTitle = sourceMode === 'practice'
    ? t('practiceSummaryTitle', { quizTitle: currentDisplayQuiz.title })
    : t('resultsTitle', { quizTitle: currentDisplayQuiz.title });

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={pageVariants}
    >
      <Card className="max-w-4xl mx-auto shadow-2xl !rounded-2xl" useGlassEffect>
        <motion.h1 variants={generalItemVariants} className="text-3xl sm:text-4xl font-bold text-[var(--color-text-primary)] mb-4 text-center leading-tight tracking-tight line-clamp-2" title={currentDisplayQuiz.title}>
          <MathText text={pageTitle} markdownFormatting={true} />
        </motion.h1>
        <motion.p variants={generalItemVariants} className="text-base text-[var(--color-text-secondary)] mb-12 text-center">
            <MathText text={sourceMode === 'practice' ? t('practiceSummarySubtitle') : t('resultsSubtitle')} markdownFormatting={true} />
        </motion.p>

        <motion.div variants={generalItemVariants}>
          <Card className={`mb-12 !bg-[var(--color-bg-surface-2)]/70 shadow-xl !border-[var(--color-border-default)] p-0 overflow-hidden !rounded-2xl`} useGlassEffect={false}>
            <div className={`flex flex-col md:flex-row justify-around items-center text-center gap-8 p-6 sm:p-10 !bg-[var(--color-bg-surface-1)]/60`}>
              <div className="flex flex-col items-center">
                <p className="text-sm text-[var(--color-text-muted)] uppercase tracking-wider font-medium mb-1.5">{t('resultsYourScore')}</p>
                <p className={`text-6xl sm:text-7xl font-extrabold ${scoreColor} tracking-tight`}>{score.toFixed(0)}<span className="text-4xl">%</span></p>
              </div>
              <div className={`w-full md:w-px h-px md:h-24 bg-[var(--color-border-default)] my-3 md:my-0`}></div>
              <div className="flex flex-col items-center">
                <p className="text-sm text-[var(--color-text-muted)] uppercase tracking-wider font-medium mb-1.5">{t('resultsCorrectAnswers')}</p>
                <p className="text-5xl sm:text-6xl font-bold text-[var(--color-text-primary)]">{totalCorrect} <span className="text-3xl text-[var(--color-text-muted)]/80">/ {totalQuestions}</span></p>
              </div>
            </div>
            <ProgressBar progress={score} className="w-full rounded-b-2xl overflow-hidden" size="lg" barClassName={`${scoreProgressGradient} !h-3.5`} showPercentage={false} />
          </Card>
        </motion.div>

        <motion.h2 variants={generalItemVariants} className={`text-2xl sm:text-3xl font-semibold text-[var(--color-text-primary)] mb-8 sm:mb-10`}>{t('resultsBreakdownTitle')}</motion.h2>
        
        <motion.div 
            variants={listVariants} 
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
                initiallyOpen={!correct}
              />
            );
          })}
        </motion.div>

        <motion.div variants={generalItemVariants} className={`mt-14 flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-5`}>
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
          <Button onClick={() => navigate('/create')} variant="primary" size="lg" leftIcon={<PlusCircleIcon className="w-5 h-5" />} className="w-full sm:w-auto bg-gradient-to-r from-[var(--color-primary-accent)] to-indigo-500 hover:from-[var(--color-primary-accent-hover)] hover:to-indigo-600 text-white shadow-xl py-3 px-8 rounded-xl">
            {t('resultsCreateNewQuiz')}
          </Button>
        </motion.div>
      </Card>
    </motion.div>
  );
};
ResultsPage.displayName = "ResultsPage";
export default ResultsPage;
