import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext, useTranslation } from '../../App';
import { Quiz } from '../../types';
import { Button, Card, LoadingSpinner } from '../../components/ui';
import { UserCircleIcon, CopyIcon, CheckCircleIcon, PlayIcon, PlusCircleIcon, XCircleIcon, SaveIcon } from '../../constants';
import MathText from '../../components/MathText';
import { getSharedQuiz } from '../../services/quizSharingService';
import { logger } from '../../services/logService';
import { validateQuizId } from '../../utils/quizValidationUtils';
import { generateUUID } from '../../utils/uuidUtils';

const SharedQuizPage: React.FC = () => {
  const { quizId } = useParams<{ quizId?: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { quizzes: localUserQuizzes, addQuiz, setActiveQuiz, setQuizResult, currentUser, showSuccessNotification, showErrorNotification } = useAppContext();
  
  const [sharedQuiz, setSharedQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  
  useEffect(() => {
    const loadSharedQuiz = async () => {
      setLoading(true);
      setError(null);
      setDebugInfo('');

      if (!quizId) {
        logger.warn('SharedQuizPage: No quizId in params.', 'SharedQuizPage');
        setError(t('sharedQuizNotFound'));
        setDebugInfo('No quiz ID provided in URL');
        setLoading(false);
        return;
      }
      
      // Validate quiz ID format
      if (!validateQuizId(quizId)) {
        logger.warn('SharedQuizPage: Invalid quiz ID format.', 'SharedQuizPage', { quizId });
        setError(t('sharedQuizNotFound'));
        setDebugInfo(`Invalid quiz ID format: ${quizId}`);
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
                setDebugInfo('Quiz found in user\'s collection');
                setLoading(false);
                return;
            }
        }

        // Priority 2: Try to fetch from shared mechanism (localStorage sim or API)
        const fetchedQuizData = await getSharedQuiz(quizId, currentUser);
        if (fetchedQuizData) {
          logger.info('SharedQuizPage: Quiz data fetched successfully.', 'SharedQuizPage', { quizId });
          setSharedQuiz(fetchedQuizData as Quiz);
          setDebugInfo('Quiz found via sharing mechanism');
        } else {
          logger.warn('SharedQuizPage: Quiz not found via getSharedQuiz.', 'SharedQuizPage', { quizId });
          
          const debugMessage = `Quiz ${quizId} not found in Supabase. User logged in: ${currentUser ? 'Yes' : 'No'}`;
          setDebugInfo(debugMessage);
          
          setError(t('sharedQuizNotFound'));
        }
      } catch (err) {
        logger.error('Error loading shared quiz:', 'SharedQuizPage', { quizId }, err as Error);
        setError(t('sharedQuizLoadError'));
        setDebugInfo(`Error: ${(err as Error).message}`);
      } finally {
        setLoading(false);
      }
    };
    
    loadSharedQuiz();
  }, [quizId, localUserQuizzes, t, currentUser]);
  
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
    setQuizResult(null);
    navigate(`/quiz/${sharedQuiz.id}`);
  };

  // Check if quiz is already saved by user
  const isQuizAlreadySaved = () => {
    if (!sharedQuiz || !currentUser) return false;
    return localUserQuizzes.some(quiz => 
      quiz.title === sharedQuiz.title && 
      quiz.questions.length === sharedQuiz.questions.length
    );
  };

  const handleSaveQuiz = async () => {
    if (!sharedQuiz || !currentUser) {
      showErrorNotification('Please log in to save quizzes');
      return;
    }

    if (isQuizAlreadySaved()) {
      showErrorNotification('This quiz is already saved to your collection');
      return;
    }

    setIsSaving(true);
    
    try {
      // Create a copy of the quiz with new ID and user ownership
      const savedQuiz: Quiz = {
        ...sharedQuiz,
        id: generateUUID(), // Generate new ID for the user's copy
        userId: currentUser.id,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        isShared: false, // User's copy is not automatically shared
        sharedTimestamp: undefined
      };

      // Add to user's quiz collection
      addQuiz(savedQuiz);
      
      showSuccessNotification('Quiz saved to your collection!');
      logger.info('Shared quiz saved to user collection', 'SharedQuizPage', { 
        originalQuizId: sharedQuiz.id,
        newQuizId: savedQuiz.id,
        userId: currentUser.id
      });
    } catch (error) {
      logger.error('Failed to save shared quiz', 'SharedQuizPage', { quizId: sharedQuiz.id }, error as Error);
      showErrorNotification('Failed to save quiz. Please try again.');
    } finally {
      setIsSaving(false);
    }
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
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <Card className="max-w-lg mx-auto mt-10 sm:mt-16 p-8 text-center animate-fadeInUp shadow-2xl" useGlassEffect>
          <XCircleIcon className="w-16 h-16 text-[var(--color-danger-accent)] mx-auto mb-6" />
          <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-3">{t('sharedQuizError')}</h2>
          <p className="text-[var(--color-text-secondary)] mb-4">{error || t('sharedQuizNotFound')}</p>
          
          {/* Debug Information */}
          {debugInfo && (
            <div className="bg-[var(--color-bg-surface-2)] p-4 rounded-lg mb-6 text-left">
              <div className="flex items-center mb-2">
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">Debug Information</span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] font-mono break-all">{debugInfo}</p>
              {quizId && (
                <p className="text-xs text-[var(--color-text-muted)] font-mono mt-2">
                  Quiz ID: {quizId}<br/>
                  Valid Format: {validateQuizId(quizId) ? 'Yes' : 'No'}
                </p>
              )}
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="primary" onClick={() => navigate('/')} size="lg" className="py-3 px-8 rounded-xl">
              {t('home')}
            </Button>
            <Button variant="outline" onClick={() => navigate('/create')} size="lg" className="py-3 px-8 rounded-xl">
              {t('createQuiz')}
            </Button>
          </div>
        </Card>
      </div>
    );
  }
  
  const difficultyText = sharedQuiz.config?.difficulty && sharedQuiz.config.difficulty !== 'AI-Determined' 
    ? t(`step2Difficulty${sharedQuiz.config.difficulty}` as any) 
    : (sharedQuiz.config?.difficulty === 'AI-Determined' ? t('dashboardQuizCardDifficulty') : t('notSpecified'));

  const languageText = sharedQuiz.config?.language 
    ? (sharedQuiz.config.language.toLowerCase() === 'english' ? t('step2LanguageEnglish') : t('step2LanguageVietnamese')) 
    : t('notSpecified');

  // Format creation date for display
  const createdDate = sharedQuiz.createdAt ? new Date(sharedQuiz.createdAt).toLocaleDateString() : t('notSpecified');
  const lastModified = sharedQuiz.lastModified ? new Date(sharedQuiz.lastModified).toLocaleDateString() : t('notSpecified');

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
            <span>{t('dashboardQuizCardCreated', { date: '' })} {(sharedQuiz as any).creator.name}</span>
            </div>
        )}
      </div>
      
      <div className="mb-8">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">{t('quizDetails')}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center sm:text-left mb-4">
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
        {/* Additional information row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-center sm:text-left">
          <div className="bg-[var(--color-bg-surface-2)]/30 p-3 rounded-lg border border-[var(--color-border-default)]/50">
            <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Created</p>
            <p className="text-sm text-[var(--color-text-primary)]">{createdDate}</p>
          </div>
          <div className="bg-[var(--color-bg-surface-2)]/30 p-3 rounded-lg border border-[var(--color-border-default)]/50">
            <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Last Modified</p>
            <p className="text-sm text-[var(--color-text-primary)]">{lastModified}</p>
          </div>
        </div>
        {/* Source content information if available */}
        {sharedQuiz.sourceContentSnippet && (
          <div className="mt-4 bg-[var(--color-bg-surface-2)]/30 p-4 rounded-lg border border-[var(--color-border-default)]/50">
            <p className="text-xs font-medium text-[var(--color-text-muted)] mb-2">Source Content</p>
            <p className="text-sm text-[var(--color-text-secondary)] line-clamp-3">{sharedQuiz.sourceContentSnippet}</p>
          </div>
        )}
      </div>
      
      {sharedQuiz.questions && sharedQuiz.questions.length > 0 && (
        <div className="mb-10">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-5">{t('previewQuestions')}</h2>
          <div className="space-y-4">
            {sharedQuiz.questions.slice(0, 3).map((question, index) => (
              <div key={question.id} className="bg-[var(--color-bg-surface-2)]/60 p-4 sm:p-5 rounded-xl border border-[var(--color-border-default)] shadow-md">
                <div className="font-medium text-[var(--color-text-primary)] mb-2 text-sm sm:text-base">
                  <span className="text-[var(--color-primary-accent)] mr-2 font-semibold">{index + 1}.</span>
                  <MathText text={question.questionText} markdownFormatting={true} />
                </div>
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
        
        {/* Save Quiz Button - only show if user is logged in and quiz is not already saved */}
        {currentUser && !isQuizAlreadySaved() && (
          <Button 
            variant="outline" 
            size="lg" 
            onClick={handleSaveQuiz}
            disabled={isSaving}
            leftIcon={<SaveIcon className="w-5 h-5" />} 
            className="w-full sm:w-auto py-3.5 px-8 rounded-xl border-green-500/50 text-green-600 hover:bg-green-50 hover:border-green-500 dark:border-green-400/50 dark:text-green-400 dark:hover:bg-green-900/20"
          >
            {isSaving ? 'Saving...' : 'Save Quiz'}
          </Button>
        )}
        
        {/* Show already saved indicator */}
        {currentUser && isQuizAlreadySaved() && (
          <Button 
            variant="outline" 
            size="lg" 
            disabled={true}
            leftIcon={<CheckCircleIcon className="w-5 h-5" />} 
            className="w-full sm:w-auto py-3.5 px-8 rounded-xl border-green-500/50 text-green-600 bg-green-50 dark:border-green-400/50 dark:text-green-400 dark:bg-green-900/20"
          >
            Already Saved
          </Button>
        )}
        
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
