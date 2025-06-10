import React, { useState, useRef, ReactNode, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button, Card, Textarea, Tooltip, LoadingSpinner } from '../../components/ui';
import { useAppContext, useTranslation } from '../../App';
import { Quiz } from '../../types';
import { PlusIcon, UserCircleIcon, ChevronRightIcon } from '../../constants';
import { QuizCard } from './components/QuizCard'; 
import useShouldReduceMotion from '../../hooks/useShouldReduceMotion';

import { translations } from '../../i18n';
import MathText from '../../components/MathText';


const MAX_RECENT_QUIZZES_HOME = 3;


const easeIOS = [0.25, 0.1, 0.25, 1];
const durationNormal = 0.35;
const durationSlow = 0.4;

const heroContainerVariantsFactory = (shouldReduceMotion: boolean) => ({
  hidden: { opacity: shouldReduceMotion ? 1: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: shouldReduceMotion ? 0 : 0.15,
      duration: shouldReduceMotion ? 0.001 : durationNormal,
      ease: easeIOS,
    },
  },
});

const heroItemVariantsFactory = (shouldReduceMotion: boolean) => ({
  hidden: { opacity: shouldReduceMotion ? 1 : 0, y: shouldReduceMotion ? 0 : 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: shouldReduceMotion ? 0.001 : durationSlow,
      ease: easeIOS,
    },
  },
});


const FeedbackSection: React.FC = () => {
  const { currentUser, setCurrentView } = useAppContext();
  const { t } = useTranslation();
  const [feedbackText, setFeedbackText] = useState('');
  const shouldReduceMotion = useShouldReduceMotion();

  const handleSendFeedback = () => {
    if (!currentUser || !feedbackText.trim()) return;

    const mailToEmail = 'teosushi1014@gmail.com';
    const subject = encodeURIComponent(t('feedbackMailSubject', { appName: t('appName') }));
    const body = encodeURIComponent(
      `${t('feedbackMailBodyUser', { userName: currentUser.name || 'N/A', userEmail: currentUser.email || 'N/A' })}\n\n` +
      `${t('feedbackMailBodyContentLabel')}\n${feedbackText}`
    );
    window.location.href = `mailto:${mailToEmail}?subject=${subject}&body=${body}`;
    setFeedbackText('');
  };

  return (
    <motion.section
      className="py-12 md:py-16"
      initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: shouldReduceMotion ? 0.001 : durationSlow, ease: easeIOS, delay: 0.2 }} 
    >
      <Card
        useGlassEffect
        className={`max-w-2xl mx-auto shadow-2xl !rounded-2xl`} // Removed hardcoded border
      >
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
          <div className="flex-1 text-center sm:text-left">
            <motion.h2
              className={`text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] mb-2 sm:mb-3`}
              initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: shouldReduceMotion ? 0.001 : durationNormal, ease: easeIOS, delay: 0.1 }}
            >
              {t('feedbackSectionTitle')}
            </motion.h2>
            <motion.p
              className={`text-[var(--color-text-secondary)] text-sm sm:text-base mb-4 sm:mb-0`}
              initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: shouldReduceMotion ? 0.001 : durationNormal, ease: easeIOS, delay: 0.2 }}
            >
              {t('feedbackSectionSubtitle')}
            </motion.p>
          </div>
          
          <motion.div 
            initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: shouldReduceMotion ? 0.001 : durationNormal, ease: easeIOS, delay: 0.3 }}
            className="flex-1 w-full"
          >
            {currentUser ? (
              <div className="space-y-4">
                <Textarea 
                  label={<span className="text-sm font-medium text-[var(--color-text-secondary)]">{t('feedbackTextareaLabel')}</span>}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder={t('feedbackTextareaPlaceholder')}
                  rows={4}
                  className="min-h-[100px] sm:min-h-[120px]"
                />
                <Button
                  onClick={handleSendFeedback}
                  disabled={!feedbackText.trim()}
                  fullWidth
                  size="md"
                  variant="secondary"
                  className="py-2.5 sm:py-3 shadow-lg"
                >
                  {t('feedbackSendButton')}
                </Button>
              </div>
            ) : (
              <div className="text-center bg-[var(--color-bg-surface-2)]/70 p-5 sm:p-6 rounded-xl border border-[var(--color-border-default)] shadow-inner">
                <UserCircleIcon className="w-12 h-12 sm:w-16 sm:h-16 text-[var(--color-text-muted)] mx-auto mb-4 sm:mb-6" />
                <p className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)] mb-2 sm:mb-3">{t('feedbackLoginPromptTitle')}</p>
                <p className="text-[var(--color-text-secondary)] text-xs sm:text-sm mb-6 sm:mb-8 max-w-md mx-auto">{t('feedbackLoginPromptSubtitle')}</p>
                <Button
                  onClick={() => setCurrentView('/signin')}
                  variant="primary"
                  size="sm"
                  className="py-2.5 px-5 sm:px-6 rounded-lg"
                >
                  {t('signIn')}
                </Button>
              </div>
            )}
          </motion.div>
        </div>
      </Card>
    </motion.section>
  );
};
FeedbackSection.displayName = "FeedbackSection";

const containerVariantsFactory = (shouldReduceMotion: boolean) => ({
  hidden: { opacity: shouldReduceMotion ? 1 : 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: shouldReduceMotion ? 0 : 0.1, 
      duration: shouldReduceMotion ? 0.001 : 0.3,
      ease: easeIOS,
    },
  },
});


const HomePage: React.FC = () => {
  const { quizzes: contextQuizzes, currentUser, setCurrentView, deleteQuiz, isLoading: contextIsLoading } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const shouldReduceMotion = useShouldReduceMotion();

  const [currentStableQuizzes, setCurrentStableQuizzes] = useState<Quiz[]>([]);

  useEffect(() => {
    if (!contextIsLoading) {
      setCurrentStableQuizzes([...contextQuizzes]);
    }
  }, [contextQuizzes, contextIsLoading]);

  const recentQuizzesForDisplay = useMemo(() => {
    return [...currentStableQuizzes]
        .sort((a, b) => new Date(b.lastModified || b.createdAt).getTime() - new Date(a.lastModified || a.createdAt).getTime())
        .slice(0, MAX_RECENT_QUIZZES_HOME);
  }, [currentStableQuizzes]);

  const quizCountForDisplay = useMemo(() => currentStableQuizzes.length, [currentStableQuizzes]);

  const heroButtonTextKey = quizCountForDisplay > 0 ? 'heroCTACreateAnother' : 'heroCTA';
  const heroButtonText = t(heroButtonTextKey);

  const handleDeleteQuiz = (quizId: string) => { deleteQuiz(quizId); };
  const handleEditQuiz = (quiz: Quiz) => { navigate(`/review/${quiz.id}`, { state: { existingQuiz: quiz } }); };

  const currentHeroContainerVariants = useMemo(() => heroContainerVariantsFactory(shouldReduceMotion), [shouldReduceMotion]);
  const currentHeroItemVariants = useMemo(() => heroItemVariantsFactory(shouldReduceMotion), [shouldReduceMotion]);
  const currentContainerVariants = useMemo(() => containerVariantsFactory(shouldReduceMotion), [shouldReduceMotion]);


  const renderPageContent = () => {
    return (
      <div className="relative">
        {contextIsLoading && quizCountForDisplay > 0 && (
        )}
      </div>
    );
  };
  
  return (
    <div className="container mx-auto px-4 sm:px-6 pb-16">
      <motion.div 
        initial="hidden"
        animate="visible"
        variants={currentContainerVariants}
        className="space-y-12 sm:space-y-16"
      >
        {renderPageContent()}
        <FeedbackSection /> {/* FeedbackSection is now always rendered here */}
      </motion.div>
    </div>
  );
};
HomePage.displayName = "HomePage";

export default HomePage;
