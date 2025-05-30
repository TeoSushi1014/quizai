

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FixedSizeList } from 'react-window';
import { useAppContext, useTranslation } from '../../App';
import { Quiz } from '../../types.ts';
import { Button, LoadingSpinner } from '../../components/ui';
import { PlusCircleIcon } from '../../constants';
import { QuizCard } from './components/QuizCard'; // Changed default to named import
import QuizCardSkeleton from './components/QuizCardSkeleton'; // Import skeleton
import useIntersectionObserver from '../../hooks/useIntersectionObserver';

const ITEM_HEIGHT = 360; 
const LIST_PADDING_VERTICAL = 8; 

const DashboardPage: React.FC = () => {
  const { quizzes, deleteQuiz, currentUser, isLoading } = useAppContext(); // isLoading from AppContext
  const { t } = useTranslation();
  const navigate = useNavigate();

  const headerRef = useRef<HTMLDivElement>(null);
  const isHeaderVisible = useIntersectionObserver(headerRef, { threshold: 0.5, freezeOnceVisible: true });

  const noQuizzesRef = useRef<HTMLDivElement>(null);
  const isNoQuizzesVisible = useIntersectionObserver(noQuizzesRef, { threshold: 0.1, freezeOnceVisible: true });
  
  const recentQuizzesTitleRef = useRef<HTMLHeadingElement>(null);
  const isRecentQuizzesTitleVisible = useIntersectionObserver(recentQuizzesTitleRef, { threshold: 0.5, freezeOnceVisible: true });


  const [showList, setShowList] = useState(false);
  const [listHeight, setListHeight] = useState(300); 
  const listContainerRef = useRef<HTMLDivElement>(null);

  const handleEditQuiz = (quiz: Quiz) => {
    navigate(`/review/${quiz.id}`, { state: { existingQuiz: quiz } });
  };

  const sortedQuizzes = React.useMemo(() =>
    [...quizzes].sort((a, b) => {
      const dateA = new Date(a.lastModified || a.createdAt).getTime();
      const dateB = new Date(b.lastModified || b.createdAt).getTime();
      return dateB - dateA;
    }),
  [quizzes]);

  useEffect(() => {
    let animationFrameId: number | null = null;
    let visibilityTimerId: ReturnType<typeof setTimeout> | null = null;
    let resizeListenerAdded = false;

    const updateAndAttemptShowList = () => {
      if (listContainerRef.current) {
        const containerRect = listContainerRef.current.getBoundingClientRect();
        
        if (containerRect.top > 0 && containerRect.height > 0 && window.innerHeight > containerRect.top) {
            const calculatedHeight = window.innerHeight - containerRect.top - 20; 
            const newHeight = Math.max(300, calculatedHeight);

            if (newHeight !== listHeight) { 
              setListHeight(newHeight);
            }
            if (visibilityTimerId) clearTimeout(visibilityTimerId);
            visibilityTimerId = setTimeout(() => {
                setShowList(true);
            }, 50); 
        } else {
            setShowList(false); 
        }
      } else {
         setShowList(false);
      }
    };
    
    const handleResize = () => {
        // Check AppContext's isLoading here as well.
        if (!isLoading && sortedQuizzes.length > 0) {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(() => {
                updateAndAttemptShowList();
            });
        } else {
            setShowList(false);
        }
    };
    
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (visibilityTimerId) clearTimeout(visibilityTimerId);

    // useEffect dependency on `isLoading` will re-trigger this logic.
    if (!isLoading && sortedQuizzes.length > 0) {
        animationFrameId = requestAnimationFrame(() => {
            updateAndAttemptShowList();
        });
        window.addEventListener('resize', handleResize);
        resizeListenerAdded = true;
    } else {
        setShowList(false); // Ensure list is hidden if loading or no quizzes
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (visibilityTimerId) clearTimeout(visibilityTimerId);
      if (resizeListenerAdded) {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, [isLoading, sortedQuizzes.length, listHeight]); 

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const quiz = sortedQuizzes[index];
    if (!quiz) return null;

    const itemStyle: React.CSSProperties = {
      ...style,
      top: `${parseFloat(style.top as string) + LIST_PADDING_VERTICAL}px`,
      height: `${parseFloat(style.height as string) - (2 * LIST_PADDING_VERTICAL)}px`,
      paddingLeft: '4px', 
      paddingRight: '4px',
      width: 'calc(100% - 8px)', 
      boxSizing: 'border-box',
    };

    return (
      <div style={itemStyle}>
        <QuizCard
          quiz={quiz}
          onDelete={deleteQuiz}
          onEditQuiz={handleEditQuiz}
          animationDelay={0} 
        />
      </div>
    );
  };
  Row.displayName = "QuizListRow";
  
  const getItemKey = (index: number) => sortedQuizzes[index].id;

  const renderContent = () => {
    // If AppContext.isLoading is true and it's an initial load (no quizzes yet), show skeletons.
    if (isLoading && sortedQuizzes.length === 0) {
      return (
        <div className="space-y-4"> {/* Consistent spacing for skeletons */}
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-[344px] px-1"> {/* Height of card, horizontal padding */}
              <QuizCardSkeleton />
            </div>
          ))}
        </div>
      );
    }

    // If loading is finished, and there are still no quizzes.
    if (!isLoading && sortedQuizzes.length === 0) {
      return (
        <div ref={noQuizzesRef} className={`text-center py-24 sm:py-28 bg-[var(--color-bg-surface-1)] rounded-3xl shadow-2xl border border-[var(--color-border-default)] glass-effect ${isNoQuizzesVisible ? 'animate-page-slide-fade-in' : 'opacity-0'}`}>
          <h3 className="mt-2 text-2xl sm:text-3xl font-semibold text-[var(--color-text-primary)] mb-4 pt-10">
            {t('dashboardNoQuizzes')}
          </h3>
          <p className="mt-1 text-base text-[var(--color-text-secondary)] max-w-lg mx-auto mb-12">
            {t('dashboardNoQuizzesDesc')}
          </p>
          <Button
            variant="secondary"
            size="lg"
            leftIcon={<PlusCircleIcon className="w-5 h-5" strokeWidth={2} />}
            onClick={() => navigate('/create')}
            className="shadow-lg py-3.5 px-8 text-base rounded-xl"
          >
            {t('createQuiz')}
          </Button>
        </div>
      );
    }

    // If we have quizzes (sortedQuizzes.length > 0).
    return (
      <div ref={listContainerRef} className="quiz-list-container" style={{ height: listHeight > 0 ? `${listHeight}px` : 'auto', minHeight: '300px' }}>
        {showList && listHeight > 0 && sortedQuizzes.length > 0 ? (
          <FixedSizeList
            height={listHeight}
            itemCount={sortedQuizzes.length}
            itemSize={ITEM_HEIGHT}
            width="100%"
            className="thin-scrollbar-horizontal"
            itemKey={getItemKey}
          >
            {Row}
          </FixedSizeList>
        ) : (
           (sortedQuizzes.length > 0 && !showList && !isLoading) &&
            <div className="space-y-4">
              {[...Array(Math.min(3, sortedQuizzes.length))].map((_, i) => (
                <div key={i} className="h-[344px] px-1">
                  <QuizCardSkeleton />
                </div>
              ))}
            </div>
        )}
         {isLoading && sortedQuizzes.length > 0 && !showList && (
             <div className="space-y-4">
                {[...Array(Math.min(3, sortedQuizzes.length))].map((_, i) => (
                    <div key={`loading-${i}`} className="h-[344px] px-1">
                        <QuizCardSkeleton />
                    </div>
                ))}
            </div>
         )}
      </div>
    );
  };

  return (
    <div className="space-y-10 md:space-y-12">
      <div ref={headerRef} className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 border-b border-[var(--color-border-default)] pb-8 sm:pb-10 ${isHeaderVisible ? 'animate-page-slide-fade-in' : 'opacity-0'}`}>
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-[var(--color-text-primary)] tracking-tight">
            {t('myQuizzesTitle')}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--color-text-secondary)] max-w-xl">
            {t('manageBrowseQuizzes')}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 sm:gap-4 mt-4 sm:mt-0">
          <Button
            variant="primary"
            size="md"
            leftIcon={<PlusCircleIcon className="w-5 h-5" strokeWidth={2.5} />}
            onClick={() => navigate('/create')}
            className="shadow-xl hover:shadow-[var(--color-primary-accent)]/50 py-3 px-6 rounded-xl"
          >
            {t('dashboardCreateNew')}
          </Button>
        </div>
      </div>
      
      {!isLoading && sortedQuizzes.length > 0 && (
         <h2 ref={recentQuizzesTitleRef} className={`text-2xl sm:text-3xl font-semibold text-[var(--color-text-primary)] ${isRecentQuizzesTitleVisible ? 'animate-fadeInUp' : 'opacity-0'}`}>
            {t('recentQuizzesSectionTitle')}
          </h2>
      )}
      {isLoading && sortedQuizzes.length > 0 && !showList && (
        <div className="flex justify-center items-center" style={{ height: listHeight > 0 ? `${listHeight}px` : '300px' }}>
            <LoadingSpinner text={t('loading')} size="lg" />
        </div>
      )}
      {renderContent()}
    </div>
  );
};
DashboardPage.displayName = "DashboardPage";
export default DashboardPage;