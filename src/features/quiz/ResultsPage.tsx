
import React, { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext, useTranslation } from '../../App';
import { Question } from '../../types'; 
import { Button, Card, Accordion, ProgressBar, LoadingSpinner } from '../../components/ui';
import MathText from '../../components/MathText';
import { CheckCircleIcon, XCircleIcon, DocumentTextIcon, ArrowUturnLeftIcon, PlusCircleIcon, HomeIcon } from '../../constants';
import useIntersectionObserver from '../../hooks/useIntersectionObserver';

const ResultsPage: React.FC = () => {
  const { activeQuiz: contextActiveQuiz, quizResult, quizzes, setActiveQuiz, currentUser } = useAppContext();
  const { t } = useTranslation();
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();

  const pageCardRef = useRef<HTMLDivElement>(null);
  const isPageCardVisible = useIntersectionObserver(pageCardRef, { threshold: 0.1, freezeOnceVisible: true });

  const summaryCardRef = useRef<HTMLDivElement>(null);
  const isSummaryCardVisible = useIntersectionObserver(summaryCardRef, { threshold: 0.2, freezeOnceVisible: true });

  const breakdownTitleRef = useRef<HTMLHeadingElement>(null);
  const isBreakdownTitleVisible = useIntersectionObserver(breakdownTitleRef, { threshold: 0.5, freezeOnceVisible: true });
  
  const actionsRef = useRef<HTMLDivElement>(null);
  const areActionsVisible = useIntersectionObserver(actionsRef, { threshold: 0.5, freezeOnceVisible: true });

  // Use local activeQuiz state to ensure we're working with the correct quiz for the results
  const [currentDisplayQuiz, setCurrentDisplayQuiz] = React.useState(contextActiveQuiz);

  useEffect(() => {
    if (quizId) {
      const quizFromContextOrList = contextActiveQuiz?.id === quizId ? contextActiveQuiz : quizzes.find(q => q.id === quizId);
      if (quizFromContextOrList) {
        if (contextActiveQuiz?.id !== quizId) { // only set global if it's not already set
            setActiveQuiz(quizFromContextOrList); 
        }
        setCurrentDisplayQuiz(quizFromContextOrList);
      } else {
        console.warn(`ResultsPage: Quiz with ID ${quizId} not found in context or quizzes list. Navigating to dashboard.`);
        navigate('/dashboard');
      }
    } else if (contextActiveQuiz && quizResult && contextActiveQuiz.id === quizResult.quizId) {
        setCurrentDisplayQuiz(contextActiveQuiz);
    }
     // If no quizId and contextActiveQuiz doesn't match quizResult, it's an issue
     else if (quizResult && contextActiveQuiz && contextActiveQuiz.id !== quizResult.quizId) {
        const matchingQuiz = quizzes.find(q => q.id === quizResult.quizId);
        if(matchingQuiz) {
            setActiveQuiz(matchingQuiz);
            setCurrentDisplayQuiz(matchingQuiz);
        } else {
            console.warn("ResultsPage: quizResult.quizId does not match any known quiz. Navigating to dashboard.");
            navigate('/dashboard');
        }
    }

  }, [quizId, contextActiveQuiz, quizzes, setActiveQuiz, navigate, quizResult]);


  if (!quizResult || !currentDisplayQuiz || currentDisplayQuiz.id !== quizResult.quizId) {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-380px)] text-center p-5 animate-fadeInUp">
         <LoadingSpinner text={t('resultsLoading')} className="mb-10" size="xl"/>
         <p className="text-xl font-semibold text-slate-300 mb-4">{t('resultsErrorNotFound')}</p>
         <p className="text-base text-slate-400 mb-12">{t('resultsErrorNotFound')}</p> 
         <Button onClick={() => navigate('/dashboard')} variant="secondary" size="lg" className="py-3.5 px-8 rounded-xl"> {t('resultsGoToDashboard')} </Button>
      </div>
    );
  }

  const { score, answers, totalCorrect, totalQuestions, sourceMode } = quizResult;
  const isAnswerCorrect = (question: Question, userAnswerText: string): boolean => {
    if (!userAnswerText) return false; 
    return userAnswerText.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
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
    <div ref={pageCardRef} className={`${isPageCardVisible ? 'animate-page-slide-fade-in' : 'opacity-0'}`}>
      <Card className="max-w-4xl mx-auto shadow-2xl !border-slate-700/40 !rounded-2xl" useGlassEffect>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-50 mb-4 text-center leading-tight tracking-tight line-clamp-2" title={currentDisplayQuiz.title}>
          <MathText text={pageTitle} />
        </h1>
        <p className="text-base text-slate-300/80 mb-12 text-center">
            {sourceMode === 'practice' ? t('practiceSummarySubtitle') : t('resultsSubtitle')}
        </p>

        <div ref={summaryCardRef} className={`${isSummaryCardVisible ? 'animate-fadeInUp' : 'opacity-0'}`}>
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
        </div>

        <h2 ref={breakdownTitleRef} className={`text-2xl sm:text-3xl font-semibold text-slate-100 mb-8 sm:mb-10 ${isBreakdownTitleVisible ? 'animate-fadeInUp' : 'opacity-0'}`}>{t('resultsBreakdownTitle')}</h2>
        <div className="space-y-5">
          {currentDisplayQuiz.questions.map((question, index) => {
            const userAnswerObj = answers.find(a => a.questionId === question.id);
            const userAnswerText = userAnswerObj ? userAnswerObj.answer : ""; 
            const correct = isAnswerCorrect(question, userAnswerText);

            const accordionRef = React.useRef<HTMLDivElement>(null);
            const isAccordionVisible = useIntersectionObserver(accordionRef, { threshold: 0.05 });

            return (
              <div 
                key={question.id} 
                ref={accordionRef} 
                className={`${isAccordionVisible ? 'animate-fadeInUp' : 'opacity-0'}`}
                style={{ animationDelay: isAccordionVisible ? `${index * 75}ms` : undefined }}
              >
                <Accordion 
                  initiallyOpen={!correct} 
                  containerClassName={`!rounded-xl shadow-lg ${correct ? `!border-green-500/60` : `!border-red-500/60`}`}
                  title={
                    <div className="flex items-center w-full gap-3">
                      <span className="text-xs text-slate-400 font-semibold">Q{index + 1}.</span>
                      <span className={`flex-grow text-sm sm:text-base ${correct ? 'text-slate-200' : 'text-slate-100 font-semibold'} min-w-0 break-words`} title={question.questionText}>
                        <MathText text={question.questionText} />
                      </span>
                    </div>
                  }
                  titleClassName={`py-3.5 px-4 sm:px-5 rounded-t-xl ${correct ? `hover:!bg-green-400/15` : `hover:!bg-red-400/15`}`}
                  contentClassName={`!bg-slate-700/30`}
                >
                  <div className="space-y-4 text-sm sm:text-base">
                    <p className="text-slate-300">
                      <strong className="font-semibold text-slate-100">{t('resultsYourAnswer')} </strong>
                      <span className={`${correct ? 'text-green-400 font-medium' : 'text-red-400 font-medium'} break-words`}>
                        <MathText text={userAnswerText || t('resultsNotAnswered')} />
                      </span>
                    </p>
                    {!correct && (
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
                    {currentDisplayQuiz.sourceContentSnippet && (
                        <details className="mt-5 pt-5 border-t border-slate-600/70">
                            <summary className="text-xs text-slate-400 cursor-pointer hover:text-sky-300 flex items-center font-semibold group transition-colors var(--duration-fast) var(--ease-ios)"> <DocumentTextIcon className="w-4 h-4 mr-2.5 text-slate-500 group-hover:text-sky-400 transition-colors var(--duration-fast) var(--ease-ios)" strokeWidth={2}/> {t('resultsViewSourceSnippet')} </summary>
                            <blockquote className={`mt-3 text-xs text-slate-400/80 max-h-36 overflow-y-auto p-3.5 bg-slate-700/60 border border-slate-600/60 rounded-lg shadow-inner italic`}> 
                              <MathText text={currentDisplayQuiz.sourceContentSnippet} />
                            </blockquote>
                        </details>
                    )}
                  </div>
                </Accordion>
              </div>
            );
          })}
        </div>

        <div ref={actionsRef} className={`mt-14 flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-5 ${areActionsVisible ? 'animate-fadeInUp' : 'opacity-0'}`}>
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
        </div>
      </Card>
    </div>
  );
};

export default ResultsPage;
