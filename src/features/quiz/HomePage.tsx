import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button, Card, Textarea, LoadingSpinner } from '../../components/ui';
import { useAppContext, useTranslation } from '../../App';
import { Quiz } from '../../types';
import { UserCircleIcon, ChevronRightIcon } from '../../constants';
import { QuizCard } from './components/QuizCard'; 
import useShouldReduceMotion from '../../hooks/useShouldReduceMotion';

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
        className={`max-w-2xl mx-auto shadow-2xl !rounded-2xl`}
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

  const handleDeleteQuiz = (quizId: string) => { deleteQuiz(quizId); };
  const handleEditQuiz = (quiz: Quiz) => { navigate(`/review/${quiz.id}`, { state: { existingQuiz: quiz } }); };

  const currentHeroContainerVariants = useMemo(() => heroContainerVariantsFactory(shouldReduceMotion), [shouldReduceMotion]);
  const currentHeroItemVariants = useMemo(() => heroItemVariantsFactory(shouldReduceMotion), [shouldReduceMotion]);
  const currentContainerVariants = useMemo(() => containerVariantsFactory(shouldReduceMotion), [shouldReduceMotion]);


  const renderPageContent = () => {
    if (contextIsLoading && currentStableQuizzes.length === 0) {
      return (
        <motion.div
          key="loading-state"
          className="flex flex-col justify-center items-center py-20 md:py-24"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <LoadingSpinner size="xl" />
          <p className="mt-4 text-md md:text-lg text-[var(--color-text-secondary)]">
            {t('loadingQuizzesMessage', 'Loading your quizzes...')}
          </p>
        </motion.div>
      );
    }

    if (!contextIsLoading && quizCountForDisplay === 0) {
      return (
        <motion.section
          key="hero-empty-state"
          aria-labelledby="hero-title-empty"
          className="text-center py-12 md:py-16"
          variants={currentHeroContainerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.h1 variants={currentHeroItemVariants} id="hero-title-empty" className="text-4xl md:text-5xl font-bold text-[var(--color-text-primary)] mb-4 md:mb-6">
            {t('welcomeToQuizAI', 'Welcome to QuizAI!')} 
          </motion.h1>
          <motion.p variants={currentHeroItemVariants} className="text-lg md:text-xl text-[var(--color-text-secondary)] mb-8 md:mb-10 max-w-2xl mx-auto">
            {t('heroSubtitleUserNoQuizzes')}
          </motion.p>
          <motion.div variants={currentHeroItemVariants}>
            <Button
              size="lg"
              variant="primary"
              onClick={() => navigate('/create')}
              className="group shadow-lg"
              aria-label={t('heroCTA')}
            >
              <img src="https://stg-images.samsung.com/is/image/samsung/assets/in/unpacked/ai-icon.png" alt="AI Create Quiz Icon" className="w-5 h-5 mr-2" />
              <MathText text={t('heroCTA')} />
            </Button>
          </motion.div>
        </motion.section>
      );
    }

    if (quizCountForDisplay > 0) {
      return (
        <motion.div
            key="quizzes-exist-content"
            variants={currentContainerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-12 sm:space-y-16"
        >
            <motion.section
            key="hero-existing-quizzes"
            aria-labelledby="hero-title-existing"
            className="text-center py-12 md:py-16"
            variants={currentHeroContainerVariants}
            >
            <motion.h1 variants={currentHeroItemVariants} id="hero-title-existing" className="text-4xl md:text-5xl font-bold text-[var(--color-text-primary)] mb-4 md:mb-6">
                {currentUser ? t('heroTitleUser', { name: currentUser.name?.split(' ')[0] || t('guest') }) : t('heroTitleExistingQuizzes', 'Your Quizzes')}
            </motion.h1>
            <motion.p variants={currentHeroItemVariants} className="text-lg md:text-xl text-[var(--color-text-secondary)] mb-8 md:mb-10 max-w-2xl mx-auto">
                {t('heroSubtitleUserWithQuizzes')}
            </motion.p>
            <motion.div variants={currentHeroItemVariants}>
                <Button
                size="lg"
                variant="primary"
                onClick={() => navigate('/create')}
                className="group shadow-lg"
                aria-label={t('heroCTACreateAnother')}
                >
                <img src="https://stg-images.samsung.com/is/image/samsung/assets/in/unpacked/ai-icon.png" alt="AI Create Quiz Icon" className="w-5 h-5 mr-2" />
                <MathText text={t('heroCTACreateAnother')} />
                </Button>
            </motion.div>
            </motion.section>

            {recentQuizzesForDisplay.length > 0 && (
            <motion.section
                key="recent-quizzes-list"
                aria-labelledby="recent-quizzes-title"
                variants={currentContainerVariants}
            >
                <motion.div variants={currentHeroItemVariants} className="flex justify-between items-center mb-6 md:mb-8">
                <h2 id="recent-quizzes-title" className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)]">
                    {t('recentQuizzesTitle')}
                </h2>
                {quizCountForDisplay > MAX_RECENT_QUIZZES_HOME && (
                    <Button variant="ghost" onClick={() => setCurrentView('/dashboard')} className="group text-sm md:text-base">
                    {t('viewAllButton')}
                    <ChevronRightIcon className="w-4 h-4 ml-1 transition-transform duration-200 ease-in-out group-hover:translate-x-1" />
                    </Button>
                )}
                </motion.div>
                <motion.div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                {recentQuizzesForDisplay.map((quiz) => (
                    <motion.div key={quiz.id} variants={currentHeroItemVariants}>
                    <QuizCard
                        quiz={quiz}
                        onDelete={() => handleDeleteQuiz(quiz.id)}
                        onEdit={() => handleEditQuiz(quiz)}
                        onSelect={() => navigate(`/quiz/${quiz.id}`)}
                    />
                    </motion.div>
                ))}
                </motion.div>
            </motion.section>
            )}
        </motion.div>
      );
    }

    return null;
  };
  
  return (
    <div className="container mx-auto px-4 sm:px-6 pb-16">
      {renderPageContent()}
      <FeedbackSection />
    </div>
  );
};
HomePage.displayName = "HomePage";

export default HomePage;
