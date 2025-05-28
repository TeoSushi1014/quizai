



import React, { useState, useRef, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button, Card, Textarea, Tooltip } from '../../components/ui';
import { useAppContext, useTranslation } from '../../App';
import { Quiz } from '../../types';
import { PlusIcon, UserCircleIcon, ChevronRightIcon } from '../../constants'; 
import QuizCard from './components/QuizCard'; 
import useIntersectionObserver from '../../hooks/useIntersectionObserver';
import { translations } from '../../i18n';
import MathText from '../../components/MathText';


const MAX_RECENT_QUIZZES_HOME = 3;

// Framer Motion Variants
const easeIOS = [0.25, 0.1, 0.25, 1];
const durationNormal = 0.35; // Corresponds to --duration-normal (350ms)
const durationSlow = 0.4; // Corresponds to --duration-slow (400ms)

const heroContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15, // Stagger delay between title, subtitle, button
      duration: durationNormal, // Duration for parent opacity, if applicable
      ease: easeIOS,
    },
  },
};

const heroItemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: durationSlow, 
      ease: easeIOS,
    },
  },
};


const FeedbackSection: React.FC = () => {
  const { currentUser, setCurrentView } = useAppContext(); 
  const { t } = useTranslation();
  const [feedbackText, setFeedbackText] = useState('');
  
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
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: durationNormal, ease: easeIOS }}
    >
      <Card 
        className={`max-w-2xl mx-auto shadow-2xl !rounded-2xl glass-effect !border-slate-700/40`} 
        useGlassEffect
      > 
        <div className="text-center mb-6 sm:mb-8">
          <motion.h2 
            className={`text-2xl sm:text-3xl font-bold text-slate-50 mb-2.5 sm:mb-3`}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: durationNormal, ease: easeIOS, delay: 0.1 }}
          > 
            {t('feedbackSectionTitle')}
          </motion.h2>
          <motion.p 
            className={`text-slate-300/80 text-sm sm:text-base max-w-xl mx-auto`}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: durationNormal, ease: easeIOS, delay: 0.2 }}
          > 
            {t('feedbackSectionSubtitle')}
          </motion.p>
        </div>

        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: durationNormal, ease: easeIOS, delay: 0.3 }}
        > 
            {currentUser ? (
            <div className="space-y-5">
                <Textarea
                label={<span className="text-sm font-medium text-slate-200">{t('feedbackTextareaLabel')}</span>}
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
            <div className="text-center bg-slate-700/50 p-5 sm:p-6 rounded-xl border border-slate-600/70 shadow-inner">
                <UserCircleIcon className="w-12 h-12 sm:w-16 sm:h-16 text-slate-500 mx-auto mb-4 sm:mb-6" />
                <p className="text-base sm:text-lg font-semibold text-slate-200 mb-2 sm:mb-3">{t('feedbackLoginPromptTitle')}</p>
                <p className="text-slate-400 text-xs sm:text-sm mb-6 sm:mb-8 max-w-md mx-auto">{t('feedbackLoginPromptSubtitle')}</p>
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
      </Card>
    </motion.section>
  );
};
FeedbackSection.displayName = "FeedbackSection";

const HomePage: React.FC = () => {
  const { quizzes, currentUser, setCurrentView, deleteQuiz } = useAppContext(); 
  const { t } = useTranslation();
  const navigate = useNavigate();

  const heroRef = useRef<HTMLElement>(null);
  const isHeroVisible = useIntersectionObserver(heroRef, { threshold: 0.1, freezeOnceVisible: true });
  
  const dashboardInfoCardRef = useRef<HTMLDivElement>(null);
  const isDashboardInfoCardVisible = useIntersectionObserver(dashboardInfoCardRef, { threshold: 0.2, freezeOnceVisible: true });

  const recentQuizzesSectionRef = useRef<HTMLElement>(null);
  const isRecentQuizzesSectionVisible = useIntersectionObserver(recentQuizzesSectionRef, { threshold: 0.05, freezeOnceVisible: true });
  
  const heroButtonTextKey = quizzes.length > 0 ? 'heroCTACreateAnother' : 'heroCTA';
  const heroButtonText = t(heroButtonTextKey);

  const handleDeleteQuiz = (quizId: string) => { deleteQuiz(quizId); };
  const handleEditQuiz = (quiz: Quiz) => { navigate(`/review/${quiz.id}`, { state: { existingQuiz: quiz } }); };


  if (quizzes.length === 0) {
    return (
      <div className="space-y-12 md:space-y-16">
        <section 
          ref={heroRef}
          className={`relative text-center py-20 md:py-28 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl
          bg-gradient-to-br from-sky-600/20 via-slate-800/50 to-purple-600/20
          border border-slate-700/40`}
        >
          <motion.div 
            className="relative z-10 container mx-auto px-4"
            initial="hidden"
            animate={isHeroVisible ? "visible" : "hidden"}
            variants={heroContainerVariants}
          >
            <motion.h1 
              variants={heroItemVariants}
              className={`text-3xl sm:text-4xl md:text-5xl xl:text-6xl font-extrabold text-slate-50 leading-tight mb-6 sm:mb-8`}
            >
              {t('heroTitle').split(': ')[0]}: <br className="sm:hidden" /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400">{t('heroTitle').split(': ')[1]}</span>
            </motion.h1>
            <motion.p 
              variants={heroItemVariants}
              className={`text-sm sm:text-base md:text-lg text-slate-300/80 max-w-xl md:max-w-2xl xl:max-w-3xl mx-auto mb-10 sm:mb-12`}
            >
              {t('heroSubtitle')}
            </motion.p>
            <motion.div 
              variants={heroItemVariants}
            >
              <Button
                size="md"
                variant="primary"
                onClick={() => setCurrentView('/create')}
                leftIcon={<PlusIcon className="w-5 h-5" strokeWidth={2.5}/>}
                className="shadow-2xl hover:shadow-sky-400/50 focus:ring-offset-transparent py-3 px-8 sm:py-3.5 sm:px-10 text-sm sm:text-base rounded-xl"
              >
                {heroButtonText}
              </Button>
            </motion.div>
          </motion.div>
        </section>
        <FeedbackSection />
      </div>
    );
  }

  const recentQuizzesToShow = quizzes.slice(0, MAX_RECENT_QUIZZES_HOME);

  return (
    <div className="space-y-12 md:space-y-16">
      <section ref={dashboardInfoCardRef} className={`${isDashboardInfoCardVisible ? 'animate-fadeInUp' : 'opacity-0'}`}>
        <Card 
            useGlassEffect 
            className={`!p-6 sm:!p-8 text-center sm:text-left !rounded-2xl shadow-2xl !border-slate-700/40`}
        >
          <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
            <div> 
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-50 mb-2">
                {currentUser ? t('homeDashboardUserTitle', { name: currentUser.name || t('user') }) : t('homeDashboardTitle')}
              </h1>
              <p className="text-slate-300 text-sm sm:text-base">
                {t('homeStatsQuizzes', { count: quizzes.length })}
              </p>
            </div>
            <div>
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate('/create')}
                leftIcon={<PlusIcon className="w-5 h-5" strokeWidth={2.5} />}
                className="shadow-xl hover:shadow-sky-400/50 py-3 px-7 rounded-xl w-full sm:w-auto flex-shrink-0"
              >
                {t('dashboardCreateNew')}
              </Button>
            </div>
          </div>
        </Card>
      </section>

      {recentQuizzesToShow.length > 0 && (
        <section ref={recentQuizzesSectionRef} className={`${isRecentQuizzesSectionVisible ? 'animate-fadeInUp' : 'opacity-0'}`}>
          <div 
            className={`flex flex-wrap justify-between items-center mb-6 sm:mb-8 gap-4`}
          >
            <h2 className="text-2xl sm:text-3xl font-semibold text-slate-100">
              {t('homeRecentQuizzesTitle')}
            </h2>
            {quizzes.length > MAX_RECENT_QUIZZES_HOME && (
              <Button 
                variant="link" 
                onClick={() => navigate('/dashboard')} 
                className="text-sm text-sky-300 hover:text-sky-200"
                rightIcon={<ChevronRightIcon className="w-4 h-4" />}
              >
                {t('homeViewAllQuizzes')}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 xl:gap-8">
            {recentQuizzesToShow.map((quiz, index) => (
              <QuizCard
                key={quiz.id}
                quiz={quiz}
                onDelete={handleDeleteQuiz}
                onEditQuiz={handleEditQuiz}
                animationDelay={`${index * 100}ms`} 
              />
            ))}
          </div>
           {quizzes.length > 0 && quizzes.length <= MAX_RECENT_QUIZZES_HOME && (
              <div 
                className={`mt-8 sm:mt-10 text-center`}
              >
                  <Button 
                    variant="secondary" 
                    onClick={() => navigate('/dashboard')} 
                    size="md" 
                    className="py-2.5 px-6 rounded-lg shadow-lg hover:shadow-slate-900/50"
                    rightIcon={<ChevronRightIcon className="w-4 h-4" />}
                  >
                      {t('homeViewAllQuizzes')}
                  </Button>
              </div>
          )}
        </section>
      )}
      <FeedbackSection />
    </div>
  );
};
HomePage.displayName = "HomePage";

export default HomePage;