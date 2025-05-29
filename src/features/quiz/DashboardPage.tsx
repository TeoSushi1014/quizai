
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FixedSizeList } from 'react-window';
import { useAppContext, useTranslation } from '../../App';
import { Quiz } from '../../types';
import { Button, Card, Tooltip, LoadingSpinner } from '../../components/ui';
import { PlusCircleIcon } from '../../constants';
import QuizCard from './components/QuizCard';
import useIntersectionObserver from '../../hooks/useIntersectionObserver';

const ITEM_HEIGHT = 360; // Estimated height for a QuizCard + vertical padding for the list item
const LIST_PADDING_VERTICAL = 8; // 4px top, 4px bottom for each item for spacing

const DashboardPage: React.FC = () => {
  const { quizzes, deleteQuiz, setCurrentView, currentUser, isLoading } = useAppContext();
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

  // Row component for FixedSizeList
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const quiz = sortedQuizzes[index];
    if (!quiz) return null;

    // Adjust style to account for padding
    const itemStyle = {
      ...style,
      top: `${parseFloat(style.top as string) + LIST_PADDING_VERTICAL}px`,
      height: `${parseFloat(style.height as string) - (2 * LIST_PADDING_VERTICAL)}px`,
      paddingLeft: '4px', // Add some horizontal padding if needed
      paddingRight: '4px',
    };

    return (
      <div style={itemStyle}>
        <QuizCard
          quiz={quiz}
          onDelete={deleteQuiz}
          onEditQuiz={handleEditQuiz}
          // animationDelay is less impactful with virtualization but kept for consistency if card animates internally
          animationDelay={0} 
        />
      </div>
    );
  };
  Row.displayName = "QuizListRow";

  const [listHeight, setListHeight] = useState(600); // Default height
  const listContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateHeight = () => {
      if (listContainerRef.current) {
        // Attempt to set height based on available space below the header
        const containerTop = listContainerRef.current.getBoundingClientRect().top;
        const windowHeight = window.innerHeight;
        // Consider some padding at the bottom or footer height if applicable
        // Subtracting header height (approx 72px for md, 64px for sm) and footer (approx 150px for md)
        // and some margin (py-10 for main content, so 40px top)
        const mainContentPaddingAndHeaderFooter = 72 + 150 + 40 + 20; // Header + Footer + MainTopPadding + BottomBuffer
        const calculatedHeight = windowHeight - containerTop - 20; // A simpler approach based on list container's top pos
        
        // More robust: try to calculate from window height minus known elements
        // const headerHeight = document.querySelector('header')?.offsetHeight || 72;
        // const footerHeight = document.querySelector('footer')?.offsetHeight || 180; // Estimate footer and its margin
        // const mainPaddingY = 80; // py-10 from main means 40px top + 40px bottom roughly
        // const availableHeight = window.innerHeight - headerHeight - footerHeight - mainPaddingY - (headerRef.current?.offsetHeight || 72);
        
        setListHeight(Math.max(300, calculatedHeight)); // Min height of 300px
      }
    };
    updateHeight(); // Initial call
    window.addEventListener('resize', updateHeight);
    
    // Re-calculate if the number of quizzes changes significantly or loading state changes,
    // as this might affect layout (e.g., presence of "no quizzes" message).
    // Also, when isLoading becomes false, the layout stabilizes.
  }, [isLoading, sortedQuizzes.length]); 

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
            <LoadingSpinner text={t('loading')} size="lg" />
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
        <div ref={listContainerRef} className="quiz-list-container"> {/* Container for height calculation */}
          {listHeight > 0 && ( // Only render FixedSizeList if height is calculated
            <FixedSizeList
              height={listHeight}
              itemCount={sortedQuizzes.length}
              itemSize={ITEM_HEIGHT} // Total height for one item slot including desired padding
              width="100%"
              className="thin-scrollbar-horizontal" // If you have custom scrollbar styles
            >
              {Row}
            </FixedSizeList>
          )}
        </div>
      )}
    </div>
  );
};
DashboardPage.displayName = "DashboardPage";

export default DashboardPage;
