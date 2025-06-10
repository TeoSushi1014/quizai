import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext, useTranslation } from '../../App';
import { Quiz, Question } from '../../types';
import { Button, Card, LoadingSpinner, Tooltip } from '../../components/ui';
import { UserCircleIcon, CopyIcon, CheckCircleIcon, PlayIcon, ChartBarIcon, PlusCircleIcon, XCircleIcon } from '../../constants'; // Updated UserIcon to UserCircleIcon
import MathText from '../../components/MathText';
import { getSharedQuiz, parseQuizFromSharedJson } from '../../services/quizSharingService'; // Adjusted import path
import { logger } from '../../services/logService';

const SharedQuizPage: React.FC = () => {
  const { quizId } = useParams<{ quizId?: string }>(); // quizId can be undefined initially
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const { quizzes: localUserQuizzes, setActiveQuiz, setQuizResult, currentUser } = useAppContext(); // Added currentUser
  
  const [sharedQuiz, setSharedQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  
  useEffect(() => {
    const loadSharedQuiz = async () => {
      setLoading(true);
      setError(null);

      if (!quizId) {
        logger.warn('SharedQuizPage: No quizId in params.', 'SharedQuizPage');
        setError(t('sharedQuizNotFound'));
        setLoading(false);
        return;
      }
      
      try {
        // Priority 1: Check if it's one of the current user's quizzes (if logged in)
        if (currentUser) {
            const userOwnedQuiz = localUserQuizzes.find(q => q.id === quizId);
            if (userOwnedQuiz) {
                logger.info('SharedQuizPage: Displaying quiz owned by current user.', 'SharedQuizPage', { quizId });
                setSharedQuiz(userOwnedQuiz);
                setLoading(false);
                return;
            }
        }

        // Priority 2: Try to fetch from shared mechanism (localStorage sim or API)
        const fetchedQuizData = await getSharedQuiz(quizId);
        if (fetchedQuizData) {
          logger.info('SharedQuizPage: Quiz data fetched successfully.', 'SharedQuizPage', { quizId });
          // The fetchedQuizData should already be in QuizForSharing format, which is compatible with Quiz
          setSharedQuiz(fetchedQuizData as Quiz);
        } else {
          logger.warn('SharedQuizPage: Quiz not found via getSharedQuiz.', 'SharedQuizPage', { quizId });
          setError(t('sharedQuizNotFound'));
        }
      } catch (err) {
        logger.error('Error loading shared quiz:', 'SharedQuizPage', { quizId }, err as Error);
        setError(t('sharedQuizLoadError'));
      } finally {
        setLoading(false);
      }
    };
    
    loadSharedQuiz();
  }, [quizId, localUserQuizzes, t, currentUser]); // Added currentUser
  
  const handleCopyLink = async () => {
    const shareUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      logger.error('Failed to copy share link from SharedQuizPage:', 'SharedQuizPage', undefined, err as Error);
    }
  };
  
  const handleStartQuiz = () => {
    if (!sharedQuiz) return;
    setActiveQuiz(sharedQuiz);
    setQuizResult(null); // Clear previous result before starting new quiz
    navigate(`/quiz/${sharedQuiz.id}`);
  };
  
  if (loading) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <LoadingSpinner text={t('loading') + "..."} size="xl" />
      </div>
    );
  }
  
  if (error || !sharedQuiz) {
    return (
      <Card className="max-w-lg mx-auto mt-10 sm:mt-16 p-8 text-center animate-fadeInUp shadow-2xl" useGlassEffect>
          <XCircleIcon className="w-16 h-16 text-[var(--color-danger-accent)] mx-auto mb-6" />
          <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-3">{t('sharedQuizError')}</h2>
          <p className="text-[var(--color-text-secondary)] mb-8">{error || t('sharedQuizNotFound')}</p>
          <Button variant="primary" onClick={() => navigate('/')} size="lg" className="py-3 px-8 rounded-xl">
            {t('home')}
          </Button>
      </Card>
    );
  }
  
  const difficultyText = sharedQuiz.config?.difficulty && sharedQuiz.config.difficulty !== 'AI-Determined' 
    ? t(`step2Difficulty${sharedQuiz.config.difficulty}` as any) 
    : (sharedQuiz.config?.difficulty === 'AI-Determined' ? t('dashboardQuizCardDifficulty') : t('notSpecified'));

  const languageText = sharedQuiz.config?.language 
    ? (sharedQuiz.config.language.toLowerCase() === 'english' ? t('step2LanguageEnglish') : t('step2LanguageVietnamese')) 
    : t('notSpecified');

  return (
    <div className="container mx-auto px-4 py-8 sm:py-12">
    <Card className="max-w-3xl mx-auto shadow-2xl !rounded-2xl animate-fadeInUp" useGlassEffect>
      <div className="border-b border-[var(--color-border-default)] pb-6 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] leading-tight tracking-tight line-clamp-3" title={sharedQuiz.title}>
            <MathText text={sharedQuiz.title} markdownFormatting={true} />
          </h1>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleCopyLink} 
            leftIcon={copySuccess ? <CheckCircleIcon className="w-4 h-4 text-[var(--color-success-accent)]" /> : <CopyIcon className="w-4 h-4" />}
            className={`!py-2 px-4 rounded-lg shadow-sm flex-shrink-0 ${copySuccess ? "!border-[var(--color-success-accent)] !text-[var(--color-success-accent)]" : "!border-[var(--color-border-interactive)] hover:!border-[var(--color-primary-accent)]"}`}
          >
            {copySuccess ? t('copied') : t('copyShareLink')}
          </Button>
        </div>
        
        {(sharedQuiz as any).creator?.name && (
            <div className="flex items-center text-sm text-[var(--color-text-secondary)] mt-3">
            <UserCircleIcon className="w-4 h-4 mr-2 text-[var(--color-text-muted)]" />
            <span>{t('dashboardQuizCardCreated', { date: '' })} </span>
            </div>
        )}
      </div>
      
      <div className="mb-8">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">{t('quizDetails')}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center sm:text-left">
          <div className="bg-[var(--color-bg-surface-2)]/60 p-4 rounded-xl border border-[var(--color-border-default)] shadow-md">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">{t('numberOfQuestions')}</p>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{sharedQuiz.questions.length}</p>
          </div>
          <div className="bg-[var(--color-bg-surface-2)]/60 p-4 rounded-xl border border-[var(--color-border-default)] shadow-md">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">{t('difficulty')}</p>
            <p className="text-lg font-semibold text-[var(--color-text-primary)]">{difficultyText}</p>
          </div>
           <div className="bg-[var(--color-bg-surface-2)]/60 p-4 rounded-xl border border-[var(--color-border-default)] shadow-md">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">{t('step2LanguageLabel')}</p>
            <p className="text-lg font-semibold text-[var(--color-text-primary)]">{languageText}</p>
          </div>
        </div>
      </div>
      
      {sharedQuiz.questions && sharedQuiz.questions.length > 0 && (
        <div className="mb-10">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-5">{t('previewQuestions')}</h2>
          <div className="space-y-4">
            {sharedQuiz.questions.slice(0, 3).map((question, index) => ( // Show up to 3 questions
              <div key={question.id} className="bg-[var(--color-bg-surface-2)]/60 p-4 sm:p-5 rounded-xl border border-[var(--color-border-default)] shadow-md">
                <p className="font-medium text-[var(--color-text-primary)] mb-2 text-sm sm:text-base">
                  <span className="text-[var(--color-primary-accent)] mr-2 font-semibold">{index + 1}.</span>
                  <MathText text={question.questionText} markdownFormatting={true} />
                </p>
                {index === 2 && sharedQuiz.questions.length > 3 && (
                   <p className="text-xs text-[var(--color-text-muted)] italic text-center mt-3">{t('andMoreQuestions', {count: sharedQuiz.questions.length - 3})}</p>
                )}
                 {index < 2 && sharedQuiz.questions.length > 1 && (
                   <p className="text-xs text-[var(--color-text-muted)] italic mt-2">{t('moreQuestionsInQuiz')}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-6 border-t border-[var(--color-border-default)]">
        <Button
          variant="primary"
          size="lg"
          onClick={handleStartQuiz}
          leftIcon={<PlayIcon className="w-5 h-5" />}
          className="w-full sm:w-auto py-3.5 px-10 rounded-xl bg-gradient-to-r from-[var(--color-primary-accent)] to-indigo-500 hover:from-[var(--color-primary-accent-hover)] hover:to-indigo-600 shadow-xl"
        >
          {t('takeQuizNow')}
        </Button>
         <Button 
            variant="outline" 
            size="lg" 
            onClick={() => navigate('/create')} 
            leftIcon={<PlusCircleIcon className="w-5 h-5" />} 
            className="w-full sm:w-auto py-3.5 px-8 rounded-xl"
        >
            {t('createQuiz')}
        </Button>
      </div>
    </Card>
    </div>
  );
};
SharedQuizPage.displayName = "SharedQuizPage";
export default SharedQuizPage;
