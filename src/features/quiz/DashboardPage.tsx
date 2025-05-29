
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FixedSizeList } from 'react-window';
import { useAppContext, useTranslation } from '../../App';
import { Quiz } from '../../types';
import { Button, LoadingSpinner } from '../../components/ui';
import { PlusCircleIcon } from '../../constants';
import QuizCard from './components/QuizCard';
import useIntersectionObserver from '../../hooks/useIntersectionObserver';

const ITEM_HEIGHT = 360; // Estimated height for a QuizCard + vertical padding for the list item
const LIST_PADDING_VERTICAL = 8; // 4px top, 4px bottom for each item for spacing

const DashboardPage: React.FC = () => {
  const { quizzes, deleteQuiz, currentUser, isLoading } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const headerRef = useRef<HTMLDivElement>(null);
  const isHeaderVisible = useIntersectionObserver(headerRef, { threshold: 0.5, freezeOnceVisible: true });

  const noQuizzesRef = useRef<HTMLDivElement>(null);
  const isNoQuizzesVisible = useIntersectionObserver(noQuizzesRef, { threshold: 0.1, freezeOnceVisible: true });

  const [showList, setShowList] = useState(false);
  const [listHeight, setListHeight] = useState(300); // Start with a minimum sensible default
  const listContainerRef = useRef<HTMLDivElement>(null);

  const handleEditQuiz = (quiz: Quiz) => {
    navigate(`/review/${quiz.id}`, { state: { existingQuiz: quiz } });
  };

  const sortedQuizzes = React.useMemo(() =>
    [...quizzes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  [quizzes]);

  useEffect(() => {
    let animationFrameId: number | null = null;
    let visibilityTimerId: ReturnType<typeof setTimeout> | null = null;
    let resizeListenerAdded = false;

    const updateAndAttemptShowList = () => {
      if (listContainerRef.current) {
        const containerRect = listContainerRef.current.getBoundingClientRect();
        
        // Ensure the container is actually in the viewport and has dimensions
        if (containerRect.top > 0 && containerRect.height > 0 && window.innerHeight > containerRect.top) {
            const calculatedHeight = window.innerHeight - containerRect.top - 20; // 20px bottom buffer
            const newHeight = Math.max(300, calculatedHeight);

            if (newHeight !== listHeight) { // Only update if height actually changes or needs init
              setListHeight(newHeight);
            }

            // Defer showing the list slightly
            if (visibilityTimerId) clearTimeout(visibilityTimerId);
            visibilityTimerId = setTimeout(() => {
                setShowList(true);
            }, 50); 
        } else {
            setShowList(false); 
            // setListHeight(prev => Math.max(300, prev)); // Keep previous or default height
        }
      } else {
         setShowList(false);
      }
    };
    
    const handleResize = () => {
        if (!isLoading && sortedQuizzes.length > 0) {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(() => {
                updateAndAttemptShowList();
            });
        } else {
            setShowList(false);
        }
    };
    
    // Clear previous timers on re-run
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (visibilityTimerId) clearTimeout(visibilityTimerId);

    if (!isLoading && sortedQuizzes.length > 0) {
        animationFrameId = requestAnimationFrame(() => {
            updateAndAttemptShowList();
        });
        window.addEventListener('resize', handleResize);
        resizeListenerAdded = true;
    } else {
        setShowList(false);
        if (sortedQuizzes.length === 0 && !isLoading) {
            // If "No quizzes" message is shown, no need for a dynamic list height for the list itself
            // setListHeight(300); // Or some other appropriate default when list isn't there
        }
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (visibilityTimerId) clearTimeout(visibilityTimerId);
      if (resizeListenerAdded) {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, [isLoading, sortedQuizzes.length, listHeight]); // Added listHeight to deps carefully

  // Row component for FixedSizeList
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const quiz = sortedQuizzes[index];
    if (!quiz) return null;

    const itemStyle: React.CSSProperties = {
      ...style,
      top: `${parseFloat(style.top as string) + LIST_PADDING_VERTICAL}px`,
      height: `${parseFloat(style.height as string) - (2 * LIST_PADDING_VERTICAL)}px`,
      paddingLeft: '4px', 
      paddingRight: '4px',
      width: 'calc(100% - 8px)', // Account for padding if width="100%"
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


  return (
    <div className="space-y-10 md:space-y-12">
      <div ref={headerRef} className={`flex flex-col sm:flex-row justify-between items-center gap-5 border-b border-slate-700/50 pb-8 sm:pb-10 ${isHeaderVisible ? 'animate-page-slide-fade-in' : 'opacity-0'}`}>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-50 tracking-tight">
          {t('dashboardTitle')}
        </h1>
        <div className="flex flex-wrap gap-3 sm:gap-4">
          <Button
            variant="primary"
            size="md"
            leftIcon={<PlusCircleIcon className="w-5 h-5" strokeWidth={2.5} />}
            onClick={() => navigate('/create')}
            className="shadow-xl hover:shadow-sky-400/50 py-3 px-6 rounded-xl"
          >
            {t('dashboardCreateNew')}
          </Button>
        </div>
      </div>

      {isLoading && sortedQuizzes.length === 0 ? (
        <div className="text-center py-24 sm:py-28">
          <LoadingSpinner text={t('loading')} size="lg" />
        </div>
      ) : !isLoading && sortedQuizzes.length === 0 ? (
        <div ref={noQuizzesRef} className={`text-center py-24 sm:py-28 bg-slate-800 rounded-3xl shadow-2xl border border-slate-700/70 glass-effect ${isNoQuizzesVisible ? 'animate-page-slide-fade-in' : 'opacity-0'}`}>
          <h3 className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-100 mb-4 pt-10">
            {t('dashboardNoQuizzes')}
          </h3>
          <p className="mt-1 text-base text-slate-400 max-w-lg mx-auto mb-12">
            {t('dashboardNoQuizzesDesc')}
          </p>
          <Button
            variant="secondary"
            size="lg"
            leftIcon={<PlusCircleIcon className="w-5 h-5" strokeWidth={2} />}
            onClick={() => navigate('/create')}
            className="shadow-lg hover:shadow-black/30 py-3.5 px-8 text-base rounded-xl"
          >
            {t('createQuiz')}
          </Button>
        </div>
      ) : (
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
            // Placeholder: Show loader if app is loading, or if list is hidden but content is expected
             (isLoading || (sortedQuizzes.length > 0 && !showList)) && (
                <div className="flex justify-center items-center" style={{ height: listHeight > 0 ? `${listHeight}px` : '300px' }}>
                    <LoadingSpinner text={t('loading')} size="lg" />
                </div>
             )
          )}
        </div>
      )}
    </div>
  );
};
DashboardPage.displayName = "DashboardPage";
export default DashboardPage;
