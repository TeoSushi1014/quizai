
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAppContext, useTranslation } from '../../App';
import { Question, Quiz } from '../../types';
import { Button, Card, Accordion, LoadingSpinner, ProgressBar } from '../../components/ui';
import MathText from '../../components/MathText';
import { ArrowUturnLeftIcon, HomeIcon } from '../../constants'; // Removed LightbulbIcon, CheckCircleIcon, XCircleIcon

interface PracticeAttempt {
  questionId: string;
  selectedOption: string | null;
  isCorrect: boolean | null;
  firstTryCorrect: boolean | null;
  attempts: number;
}

interface LocationState {
  practiceAttempts: PracticeAttempt[];
  quizTitle: string;
  questions: Question[];
}

const PracticeSummaryPage: React.FC = () => {
  const { quizzes, setActiveQuiz } = useAppContext();
  const { t } = useTranslation();
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [summaryData, setSummaryData] = useState<LocationState | null>(null);
  const [activeQuizForPractice, setActiveQuizForPractice] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const state = location.state as LocationState | null;
    if (state && state.practiceAttempts && state.questions && state.quizTitle) {
      setSummaryData(state);
      const quizFromContext = quizzes.find(q => q.id === quizId);
      if(quizFromContext) setActiveQuizForPractice(quizFromContext);
      setLoading(false);
    } else if (quizId) {
      const quiz = quizzes.find(q => q.id === quizId);
      if (quiz) {
        setActiveQuizForPractice(quiz);
        setSummaryData({
            quizTitle: quiz.title,
            questions: quiz.questions,
            practiceAttempts: quiz.questions.map(q_1 => ({ questionId: q_1.id, selectedOption: null, isCorrect: null, firstTryCorrect: null, attempts: 0}))
        });
      } else {
        navigate('/dashboard'); 
      }
      setLoading(false);
    } else {
      navigate('/dashboard'); 
    }
  }, [location.state, quizId, quizzes, navigate]);

  const { totalCorrect, scorePercentage } = useMemo(() => {
    if (!summaryData || !summaryData.practiceAttempts || summaryData.questions.length === 0) {
      return { totalCorrect: 0, scorePercentage: 0 };
    }
    const correctCount = summaryData.practiceAttempts.filter(attempt => attempt.isCorrect === true).length;
    const percentage = (correctCount / summaryData.questions.length) * 100;
    return { totalCorrect: correctCount, scorePercentage: parseFloat(percentage.toFixed(2)) };
  }, [summaryData]);


  if (loading || !summaryData || !activeQuizForPractice) {
    return <LoadingSpinner text={t('loading')} className="mt-24" size="xl" />;
  }

  const { practiceAttempts, quizTitle, questions } = summaryData;
  
  const scoreColor = scorePercentage >= 70 ? 'text-green-400' : scorePercentage >= 40 ? 'text-amber-400' : 'text-red-400';
  const scoreProgressGradient = scorePercentage >= 70 ? 'bg-gradient-to-r from-green-400 to-emerald-400' 
                                : scorePercentage >= 40 ? 'bg-gradient-to-r from-amber-400 to-yellow-400' 
                                : 'bg-gradient-to-r from-red-400 to-rose-400';
  const explanationIconUrl = "https://img.icons8.com/?size=256&id=eoxMN35Z6JKg&format=png";


  return (
    <Card className="max-w-4xl mx-auto shadow-2xl !border-slate-700/40 !rounded-2xl" useGlassEffect>
      <h1 className="text-3xl sm:text-4xl font-bold text-slate-50 mb-4 text-center leading-tight tracking-tight line-clamp-2" title={quizTitle}>
        <MathText text={t('practiceSummaryTitle', { quizTitle })} />
      </h1>
      <p className="text-base text-slate-300/80 mb-12 text-center">{t('practiceSummarySubtitle')}</p>

      <Card className={`mb-12 !bg-slate-700/70 shadow-xl !border-slate-600/60 p-0 overflow-hidden !rounded-2xl`} useGlassEffect={false}>
        <div className={`flex flex-col md:flex-row justify-around items-center text-center gap-8 p-6 sm:p-10 !bg-slate-800/60`}>
          <div className="flex flex-col items-center">
            <p className="text-sm text-slate-400 uppercase tracking-wider font-medium mb-1.5">{t('resultsYourScore')}</p>
            <p className={`text-6xl sm:text-7xl font-extrabold ${scoreColor} tracking-tight`}>{scorePercentage.toFixed(0)}<span className="text-4xl">%</span></p>
          </div>
          <div className={`w-full md:w-px h-px md:h-24 bg-slate-600/70 my-3 md:my-0`}></div> 
          <div className="flex flex-col items-center">
            <p className="text-sm text-slate-400 uppercase tracking-wider font-medium mb-1.5">{t('resultsCorrectAnswers')}</p>
            <p className="text-5xl sm:text-6xl font-bold text-slate-100">{totalCorrect} <span className="text-3xl text-slate-400/80">/ {questions.length}</span></p>
          </div>
        </div>
        <ProgressBar progress={scorePercentage} className="w-full rounded-b-2xl overflow-hidden" size="lg" barClassName={`${scoreProgressGradient} !h-3.5`} showPercentage={false} />
      </Card>

      <h2 className="text-2xl sm:text-3xl font-semibold text-slate-100 mb-8 sm:mb-10">{t('resultsBreakdownTitle')}</h2>
      <div className="space-y-5">
        {questions.map((question, index) => {
          const attempt = practiceAttempts.find(a => a.questionId === question.id);
          const userSelectedOption = attempt?.selectedOption;
          const isCorrect = attempt?.isCorrect;
          
          let cardBorderClass = '!border-slate-600/60';
          if (isCorrect === true) cardBorderClass = '!border-green-500/60';
          else if (isCorrect === false) cardBorderClass = '!border-red-500/60';

          return (
            <Accordion 
              key={question.id} 
              initiallyOpen={isCorrect === false} 
              containerClassName={`!rounded-xl shadow-lg ${cardBorderClass}`}
              title={
                <div className="flex items-center w-full gap-3"> {/* Reduced gap */}
                  {/* Icon removed from here */}
                  <span className="text-xs text-slate-400 font-semibold">Q{index + 1}.</span>
                  <span className={`flex-grow text-sm sm:text-base ${isCorrect === true ? 'text-slate-200' : 'text-slate-100 font-semibold'} min-w-0 break-words`} title={question.questionText}>
                     <MathText text={question.questionText} />
                  </span>
                </div>
              }
              titleClassName={`py-3.5 px-4 sm:px-5 rounded-t-xl ${
                isCorrect === true ? `hover:!bg-green-400/15` : isCorrect === false ? `hover:!bg-red-400/15` : 'hover:!bg-slate-700/30'
              }`}
              contentClassName={`!bg-slate-700/30`}
            >
              <div className="space-y-4 text-sm sm:text-base">
                <p className="text-slate-300">
                  <strong className="font-semibold text-slate-100">{t('practiceSummaryYourSelection')} </strong>
                  <span className={`${isCorrect === true ? 'text-green-400 font-medium' : isCorrect === false ? 'text-red-400 font-medium' : 'text-slate-400'} break-words`}>
                    <MathText text={userSelectedOption || t('practiceSummaryNoSelection')} />
                  </span>
                </p>
                {isCorrect === false && (
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
              </div>
            </Accordion>
          );
        })}
      </div>

      <div className="mt-14 flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-5">
        <Button 
            onClick={() => { setActiveQuiz(activeQuizForPractice); navigate(`/practice/${quizId}`); }} 
            variant="outline" 
            size="lg" 
            leftIcon={<ArrowUturnLeftIcon className="w-5 h-5"/>} 
            className="w-full sm:w-auto py-3 px-8 rounded-xl"
        > 
            {t('practiceAgain')} 
        </Button>
        <Button 
            onClick={() => navigate('/dashboard')} 
            variant="primary" 
            size="lg" 
            leftIcon={<HomeIcon className="w-5 h-5" />} 
            className="w-full sm:w-auto bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-500 text-white shadow-xl py-3 px-8 rounded-xl"
        > 
            {t('resultsBackToDashboard')} 
        </Button>
      </div>
    </Card>
  );
};

export default PracticeSummaryPage;