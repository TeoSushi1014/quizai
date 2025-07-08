import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Quiz } from '../../../types';
import { Button, Card, Tooltip, Modal, Toggle, Input, LoadingSpinner } from '../../../components/ui';
import MathText from '../../../components/MathText';
import { EditIcon, DeleteIcon, ShareIcon, XCircleIcon, CheckCircleIcon, HistoryIcon } from '../../../constants';
import { useTranslation, useAppContext } from '../../../App';
import { translations } from '../../../i18n';
import ShareModal from './ShareModal';
import { logger } from '../../../services/logService';


export interface AttemptSettings {
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  timeLimit: number | '';
}

const DEFAULT_ATTEMPT_SETTINGS: AttemptSettings = {
  shuffleQuestions: false,
  shuffleAnswers: false,
  timeLimit: '',
};


const easeIOS = [0.25, 0.1, 0.25, 1];
const durationNormal = 0.35; 

interface QuizCardProps {
  quiz: Quiz;
  onDelete: (id: string) => void;
  onEdit: (quiz: Quiz) => void;
  animationDelay?: number; 
}

export const QuizCard: React.FC<QuizCardProps> = ({ quiz, onDelete, onEdit, animationDelay = 0 }) => {
  const { t, language } = useTranslation();
  const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] = useState(false);
  const [isAttemptSettingsModalOpen, setIsAttemptSettingsModalOpen] = useState(false);
  const [currentAttemptSettings, setCurrentAttemptSettings] = useState<AttemptSettings>(DEFAULT_ATTEMPT_SETTINGS);
  
  const [shareFeedback, setShareFeedback] = useState<{ type: 'idle' | 'sharing' | 'copied' | 'failed'; message: string }>({ type: 'idle', message: t('share') });
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const { setActiveQuiz, setQuizResult } = useAppContext();
  const navigate = useNavigate();

  

  const difficulty = quiz.config?.difficulty;
  let difficultyTextKey: keyof typeof translations.en;

  if (difficulty === 'Easy' || difficulty === 'Medium' || difficulty === 'Hard') {
    difficultyTextKey = `step2Difficulty${difficulty}`;
  } else if (difficulty === 'AI-Determined') {
    difficultyTextKey = 'dashboardQuizCardDifficulty';
  } else {
    difficultyTextKey = 'dashboardQuizCardDifficulty';
  }
  const difficultyText = t(difficultyTextKey);
  const dateToFormat = new Date(quiz.lastModified || quiz.createdAt);
  const dateFormatted = dateToFormat.toLocaleDateString(language, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const dateLabel = quiz.lastModified ? t('dashboardQuizCardLastModified', { date: dateFormatted }) : t('dashboardQuizCardCreated', { date: dateFormatted });


  const getStoredAttemptSettings = (quizId: string): AttemptSettings => {
    const storedSettings = localStorage.getItem(`attemptSettings_${quizId}`);
    if (storedSettings) {
      try {
        const parsed = JSON.parse(storedSettings) as AttemptSettings;
        // Convert legacy 0 to '' for infinite
        return {
          ...parsed,
          timeLimit: parsed.timeLimit === 0 ? '' : parsed.timeLimit
        };
      } catch (e) {
        logger.error("Failed to parse stored attempt settings:", 'QuizCard', { quizId }, e as Error);
        return DEFAULT_ATTEMPT_SETTINGS;
      }
    }
    return DEFAULT_ATTEMPT_SETTINGS;
  };

  const handleDeleteRequest = () => {
    setIsConfirmDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    onDelete(quiz.id);
    setIsConfirmDeleteModalOpen(false);
  };

  const handleCancelDelete = useCallback(() => {
    setIsConfirmDeleteModalOpen(false);
  }, []);

  const openAttemptSettingsModal = () => {
    setCurrentAttemptSettings(getStoredAttemptSettings(quiz.id));
    setIsAttemptSettingsModalOpen(true);
  };

  const handleCloseAttemptSettingsModal = useCallback(() => {
    setIsAttemptSettingsModalOpen(false);
  }, []);


  const handleAttemptSettingsChange = (setting: keyof AttemptSettings, value: boolean | number | string) => {
    if (setting === 'timeLimit') {
      if (value === '' || value === 0 || value === '0') {
        setCurrentAttemptSettings(prev => ({ ...prev, timeLimit: '' }));
        return;
      }
      const num = Number(value);
      setCurrentAttemptSettings(prev => ({ ...prev, timeLimit: isNaN(num) ? '' : Math.max(1, num) }));
      return;
    }
    setCurrentAttemptSettings(prev => ({ ...prev, [setting]: value }));
  };

  const handleSaveAttemptSettings = () => {
    try {
      const toSave = {
        ...currentAttemptSettings,
        timeLimit: currentAttemptSettings.timeLimit === '' ? '' : Math.max(0, Number(currentAttemptSettings.timeLimit) || 0)
      };
      localStorage.setItem(`attemptSettings_${quiz.id}`, JSON.stringify(toSave));
    } catch (e) {
      logger.error("Failed to save attempt settings to localStorage:", 'QuizCard', { quizId: quiz.id }, e as Error);
    }
    setIsAttemptSettingsModalOpen(false);
  };

  const handleStartQuiz = (type: 'take' | 'practice') => {
    const settingsToUse = getStoredAttemptSettings(quiz.id);
    setActiveQuiz(quiz);
    if (type === 'take') {
      setQuizResult(null);
      navigate(`/quiz/${quiz.id}`, { state: { attemptSettings: settingsToUse } });
    } else {
      navigate(`/practice/${quiz.id}`, { state: { attemptSettings: settingsToUse } });
    }
  };
  const handleShareQuiz = () => {
    setIsShareModalOpen(true);
    setShareFeedback({ type: 'idle', message: t('share') }); 
  };


  const settingsIconUrl = "https://img.icons8.com/?size=256&id=s5NUIabJrb4C&format=png";
  
  let shareButtonIcon;
  let shareButtonCustomClass = "text-[var(--color-text-secondary)] opacity-80 hover:text-[var(--color-success-accent)] hover:bg-[var(--color-success-accent)]/10 hover:!border-[var(--color-success-accent)]/70";

  switch (shareFeedback.type) { 
    case 'sharing': 
      shareButtonIcon = <LoadingSpinner size="sm" className="w-4 h-4 !p-0" textClassName="!hidden" />; 
      shareButtonCustomClass = "text-[var(--color-primary-accent)] bg-[var(--color-primary-accent)]/10 !border-[var(--color-primary-accent)]/70 cursor-default";
      break;
    case 'copied': 
      shareButtonIcon = <CheckCircleIcon className="w-4 h-4 text-[var(--color-success-accent)]" />;
      shareButtonCustomClass = "text-[var(--color-success-accent)] bg-[var(--color-success-accent)]/10 !border-[var(--color-success-accent)]/70 hover:!border-[var(--color-success-accent)]";
      break;
    case 'failed': 
      shareButtonIcon = <XCircleIcon className="w-4 h-4 text-[var(--color-danger-accent)]" />;
      shareButtonCustomClass = "text-[var(--color-danger-accent)] bg-[var(--color-danger-accent)]/10 !border-[var(--color-danger-accent)]/70 hover:!border-[var(--color-danger-accent)]";
      break;
    default: // idle
      shareButtonIcon = <ShareIcon className="w-4 h-4"/>;
      break;
  }


  return (
    <>
      <motion.div
        className="h-full" 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: durationNormal,
          ease: easeIOS,
          delay: animationDelay, 
        }}
      >
        <Card
            className={`flex flex-col justify-between group relative overflow-hidden !p-0 !rounded-2xl h-full card-float-hover`}
            useGlassEffect={true}
        >
          <div className="p-4 sm:p-6 flex-grow pb-4">
            <h3
                className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)] mb-3 group-hover:text-[var(--color-primary-accent)] line-clamp-2 transition-colors var(--duration-fast) var(--ease-ios)"
                title={quiz.title}
            >
                <MathText text={quiz.title} markdownFormatting={true} />
            </h3>
            <div className="mb-3 space-y-2">
                <div className="text-sm sm:text-xs text-[var(--color-text-secondary)] opacity-90 flex items-center flex-wrap gap-x-3.5 gap-y-2">
                    <span className="font-medium text-[var(--color-text-primary)]">{t('dashboardQuizCardQuestions', { count: quiz.questions.length })}</span>
                    <span className="text-[var(--color-text-muted)] text-lg">•</span>
                    <span className={`px-2.5 py-1 rounded-full font-semibold shadow-sm bg-[var(--color-primary-accent)]/20 text-[var(--color-primary-accent)]`}>{difficultyText}</span>
                     {quiz.config?.language && <>
                        <span className="text-[var(--color-text-muted)] text-lg">•</span>
                        <span className={`uppercase text-[0.7rem] sm:text-xs font-bold tracking-wider px-2.5 py-1 rounded-full shadow-sm bg-purple-500/20 text-purple-400`}>{quiz.config.language.substring(0,2)}</span>
                     </>}
                </div>
                {quiz.sourceContentSnippet && (
                    <div className="text-sm sm:text-xs text-[var(--color-text-secondary)] opacity-90 italic line-clamp-1" title={quiz.sourceContentSnippet}>
                       {t('dashboardQuizCardSource', { snippet: '' })}<span>{quiz.sourceContentSnippet}</span>
                    </div>
                )}
                 <p className="text-sm sm:text-xs text-[var(--color-text-secondary)] opacity-90 pt-1">{dateLabel}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between mt-auto border-t border-[var(--color-border-default)] p-3 sm:p-4 bg-[var(--color-bg-surface-1)]/30 rounded-b-2xl">
            <div className="flex gap-2.5 w-full sm:w-auto">
              <Button
                size="sm" 
                variant="primary"
                onClick={() => handleStartQuiz('take')}
                className="flex-grow sm:flex-grow-0 shadow-lg hover:shadow-[var(--color-primary-accent)]/40 py-2.5 px-4 sm:py-2 sm:px-4 rounded-lg min-h-[44px]"
              >
                {t('dashboardQuizCardTakeQuiz')}
              </Button>
              <Button
                size="sm" 
                variant="secondary" 
                onClick={() => handleStartQuiz('practice')}
                className="flex-grow sm:flex-grow-0 py-2.5 px-4 sm:py-2 sm:px-4 rounded-lg bg-purple-500/80 hover:bg-purple-500 text-white hover:shadow-purple-400/40 min-h-[44px]"
              >
                {t('practiceModeCardButton')}
              </Button>
            </div>

            <div className="flex flex-wrap gap-x-2 gap-y-2 w-full sm:w-auto justify-between sm:justify-end items-center">
              <div className="flex items-center gap-x-2">
                <Tooltip content="Analytics" wrapperClassName="inline-flex">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/quiz-analytics/${quiz.id}`)}
                    className="!p-2.5 rounded-lg !border-[var(--color-border-interactive)] hover:!border-[var(--color-primary-accent)] min-w-[40px] min-h-[40px]"
                    aria-label="Analytics"
                  >
                    <HistoryIcon className="w-4 h-4" />
                  </Button>
                </Tooltip>
                <Tooltip content={t('edit')} wrapperClassName="inline-flex">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEdit(quiz)} // Changed to onEdit
                    className="!p-2.5 rounded-lg !border-[var(--color-border-interactive)] hover:!border-[var(--color-primary-accent)] min-w-[40px] min-h-[40px]"
                    aria-label={t('edit')}
                  >
                    <EditIcon className="w-4 h-4" strokeWidth={2}/>
                  </Button>
                </Tooltip>
                <Tooltip content={t('delete')} wrapperClassName="inline-flex">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDeleteRequest}
                    className="!p-2.5 rounded-lg text-[var(--color-text-secondary)] opacity-80 hover:text-[var(--color-danger-accent)] hover:bg-[var(--color-danger-accent)]/10 hover:!border-[var(--color-danger-accent)]/70 !border-[var(--color-border-interactive)] min-w-[40px] min-h-[40px]"
                    aria-label={t('delete')}
                  >
                    <DeleteIcon className="w-4 h-4" />
                  </Button>
                </Tooltip>
              </div>
              <div className="flex items-center gap-x-2">
                <Tooltip content={shareFeedback.type === 'idle' ? t('share') : shareFeedback.message} placement="top" wrapperClassName="inline-flex">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleShareQuiz} // Changed to open modal
                        className={`!p-2.5 rounded-lg !border-[var(--color-border-interactive)] transition-all var(--duration-fast) var(--ease-ios) min-w-[40px] min-h-[40px] ${shareButtonCustomClass}`}
                        aria-label={t('share')}
                        disabled={shareFeedback.type === 'sharing'}
                    >
                        {shareButtonIcon}
                    </Button>
                </Tooltip>
                 <Tooltip content={t('attemptSettingsModalTitle')} wrapperClassName="inline-flex">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={openAttemptSettingsModal}
                        className="!p-2.5 rounded-lg text-[var(--color-text-secondary)] opacity-80 hover:text-[var(--color-primary-accent)] hover:!bg-[var(--color-primary-accent)]/10 hover:!border-[var(--color-primary-accent)]/70 !border-[var(--color-border-interactive)] min-w-[40px] min-h-[40px]"
                        aria-label={t('attemptSettingsModalTitle')}
                    >
                        <img src={settingsIconUrl} alt={t('settings')} className="w-4 h-4 opacity-80 group-hover:opacity-100"/>
                    </Button>
                </Tooltip>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {isConfirmDeleteModalOpen && (
        <Modal
          isOpen={isConfirmDeleteModalOpen}
          onClose={handleCancelDelete}
          title={t('confirmDeletionTitle')}
          size="md"
          useSolidBackground
          footerContent={
            <div className="flex justify-end gap-4">
              <Button variant="secondary" onClick={handleCancelDelete} size="md">{t('cancel')}</Button>
              <Button variant="danger" onClick={handleConfirmDelete} size="md">{t('confirmDeleteButton')}</Button>
            </div>
          }
        >
          <div className="text-[var(--color-text-body)] text-base">
            <MathText text={t('confirmDeletionMessage', { quizName: quiz.title })} markdownFormatting={true}/>
          </div>
        </Modal>
      )}
      
      {isAttemptSettingsModalOpen && (
        <Modal
          isOpen={isAttemptSettingsModalOpen}
          onClose={handleCloseAttemptSettingsModal}
          title={t('attemptSettingsModalTitle')}
          size="lg"
          useSolidBackground
          footerContent={
            <div className="flex justify-end gap-4">
              <Button variant="secondary" onClick={handleCloseAttemptSettingsModal} size="md">{t('cancel')}</Button>
              <Button variant="primary" onClick={handleSaveAttemptSettings} size="md">{t('saveSettingsButtonText')}</Button>
            </div>
          }
        >
          <div className="space-y-6">
             <Toggle
              label={t('attemptShuffleQuestionsLabel')}
              checked={currentAttemptSettings.shuffleQuestions}
              onChange={(checked) => handleAttemptSettingsChange('shuffleQuestions', checked)}
            />
            <Toggle
              label={t('attemptShuffleAnswersLabel')}
              checked={currentAttemptSettings.shuffleAnswers}
              onChange={(checked) => handleAttemptSettingsChange('shuffleAnswers', checked)}
            />
            <Input
              label={t('attemptTimeLimitLabel')}
              type="number"
              name="timeLimit"
              value={currentAttemptSettings.timeLimit === '' ? '' : currentAttemptSettings.timeLimit}
              onChange={(e) => {
                const val = e.target.value;
                handleAttemptSettingsChange('timeLimit', val === '' ? '' : Math.max(0, parseInt(val, 10) || 0));
              }}
              min="0"
              containerClassName="mt-4"
              inputClassName="w-32"
              placeholder={t('attemptTimeLimitInfo') + ' (leave empty for infinite)'}
            />
          </div>
        </Modal>
      )}
      {isShareModalOpen && (
        <ShareModal 
            isOpen={isShareModalOpen} 
            onClose={() => setIsShareModalOpen(false)} 
            quiz={quiz} 
        />
      )}
    </>
  );
};
