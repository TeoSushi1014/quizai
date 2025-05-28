
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext, useTranslation } from '../../App';
import { Quiz } from '../../types';
import { Button, Card, Tooltip } from '../../components/ui';
import { PlusCircleIcon } from '../../constants'; 
import QuizCard from './components/QuizCard'; 
import useIntersectionObserver from '../../hooks/useIntersectionObserver';

const DashboardPage: React.FC = () => {
  const { quizzes, deleteQuiz, setActiveQuiz, setCurrentView, currentUser, isLoading } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const headerRef = useRef<HTMLDivElement>(null);
  const isHeaderVisible = useIntersectionObserver(headerRef, { threshold: 0.5, freezeOnceVisible: true });

  const noQuizzesRef = useRef<HTMLDivElement>(null);
  const isNoQuizzesVisible = useIntersectionObserver(noQuizzesRef, { threshold: 0.1, freezeOnceVisible: true });


  const handleEditQuiz = (quiz: Quiz) => {
    navigate(`/review/${quiz.id}`, { state: { existingQuiz: quiz } });
  };

  const sortedQuizzes = React.useMemo(() => 
    [...quizzes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  [quizzes]);

  return (
    <div className="space-y-10 md:space-y-12">
      <div ref={headerRef} className={`flex flex-col sm:flex-row justify-between items-center gap-5 border-b border-slate-700/50 pb-8 sm:pb-10 ${isHeaderVisible ? 'animate-page-slide-fade-in' : 'opacity-0'}`}>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-50 tracking-tight">{t('dashboardTitle')}</h1>
        <div className="flex flex-wrap gap-3 sm:gap-4">
          <Button 
            variant="primary" 
            size="md"
            leftIcon={<PlusCircleIcon className="w-5 h-5" strokeWidth={2.5}/>}
            onClick={() => navigate('/create')}
            className="shadow-xl hover:shadow-sky-400/50 py-3 px-6 rounded-xl"
          >
            {t('dashboardCreateNew')}
          </Button>
        </div>
      </div>

      {isLoading ? (
         <div className="text-center py-24 sm:py-28">
            <p className="text-slate-300">{t('loading')}</p>
         </div>
      ) : sortedQuizzes.length === 0 ? (
        <div 
            ref={noQuizzesRef}
            className={`text-center py-24 sm:py-28 bg-slate-800 rounded-3xl shadow-2xl border border-slate-700/70 glass-effect ${isNoQuizzesVisible ? 'animate-page-slide-fade-in' : 'opacity-0'}`}
        >
          <h3 className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-100 mb-4 pt-10">{t('dashboardNoQuizzes')}</h3>
          <p className="mt-1 text-base text-slate-400 max-w-lg mx-auto mb-12">{t('dashboardNoQuizzesDesc')}</p>
          <Button 
            variant="secondary"
            size="lg" 
            leftIcon={<PlusCircleIcon className="w-5 h-5" strokeWidth={2}/>}
            onClick={() => navigate('/create')}
            className={`shadow-lg hover:shadow-black/30 py-3.5 px-8 text-base rounded-xl`}
          >
            {t('createQuiz')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 xl:gap-8">
          {sortedQuizzes.map((quiz, index) => (
            <QuizCard 
              key={quiz.id}
              quiz={quiz} 
              onDelete={deleteQuiz} 
              onEditQuiz={handleEditQuiz}
              animationDelay={`${index * 100}ms`} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default DashboardPage;