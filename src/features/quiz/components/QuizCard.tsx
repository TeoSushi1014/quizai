

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Quiz } from '../../../types';
import { Button, Card, Tooltip, Modal, Toggle, Input } from '../../../components/ui';
import MathText from '../../../components/MathText';
import { EditIcon, DeleteIcon, ShareIcon, XCircleIcon } from '../../../constants';
import { useTranslation, useAppContext } from '../../../App';
import { translations } from '../../../i18n'; 
import useIntersectionObserver from '../../../hooks/useIntersectionObserver';

interface QuizCardProps {
  quiz: Quiz;
  onDelete: (id: string) => void;
  onEditQuiz: (quiz: Quiz) => void;
  animationDelay?: string;
}

export interface AttemptSettings {
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  timeLimit: number; 
}

const DEFAULT_ATTEMPT_SETTINGS: AttemptSettings = {
  shuffleQuestions: false,
  shuffleAnswers: false,
  timeLimit: 0,
};

const QuizCard: React.FC<QuizCardProps> = ({ quiz, onDelete, onEditQuiz, animationDelay }) => {
  const { t, language } = useTranslation();
  const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] = useState(false);
  const [isAttemptSettingsModalOpen, setIsAttemptSettingsModalOpen] = useState(false);
  const [currentAttemptSettings, setCurrentAttemptSettings] = useState<AttemptSettings>(DEFAULT_ATTEMPT_SETTINGS);
  
  const { setActiveQuiz, setQuizResult } = useAppContext();
  const navigate = useNavigate();

  const cardRef = useRef<HTMLDivElement>(null);
  const isVisible = useIntersectionObserver(cardRef, { threshold: 0.1 });

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
  const dateFormatted = new Date(quiz.createdAt).toLocaleDateString(language, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const getStoredAttemptSettings = (quizId: string): AttemptSettings => {
    const storedSettings = localStorage.getItem(`attemptSettings_${quizId}`);
    if (storedSettings) {
      try {
        return JSON.parse(storedSettings) as AttemptSettings;
      } catch (e) {
        console.error("Failed to parse stored attempt settings:", e);
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


  const handleAttemptSettingsChange = (setting: keyof AttemptSettings, value: boolean | number) => {
    setCurrentAttemptSettings(prev => ({ ...prev, [setting]: value }));
  };
  
  const handleSaveAttemptSettings = () => {
    try {
      localStorage.setItem(`attemptSettings_${quiz.id}`, JSON.stringify(currentAttemptSettings));
    } catch (e) {
      console.error("Failed to save attempt settings to localStorage:", e);
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
  
  const settingsIconUrl = "https://img.icons8.com/?size=256&id=s5NUIabJrb4C&format=png";

  return (
    <>
      <div 
        ref={cardRef} 
        className={`h-full ${isVisible ? 'animate-fadeInUp' : 'opacity-0'}`}
        style={{ animationDelay: isVisible ? animationDelay : undefined }}
      >
        <Card 
            className={`flex flex-col justify-between group relative overflow-hidden !p-0 !rounded-2xl h-full card-float-hover`}
            useGlassEffect={true}
        >
          <div className="p-5 sm:p-6 flex-grow pb-4">
            <h3 
                className="text-lg sm:text-xl font-semibold text-slate-50 mb-3 group-hover:text-sky-300 line-clamp-2 transition-colors var(--duration-fast) var(--ease-ios)"
                title={quiz.title}
            >
                <MathText text={quiz.title} />
            </h3>
            <div className="mb-4 space-y-2.5">
                <div className="text-xs text-slate-400 flex items-center flex-wrap gap-x-3.5 gap-y-1.5">
                    <span className="font-medium text-slate-300">{t('dashboardQuizCardQuestions', { count: quiz.questions.length })}</span>
                    <span className="text-slate-600 text-lg">•</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm bg-sky-400/20 text-sky-300`}>{difficultyText}</span>
                     {quiz.config?.language && <>
                        <span className="text-slate-600 text-lg">•</span> 
                        <span className={`uppercase text-[0.7rem] font-bold tracking-wider px-2.5 py-1 rounded-full shadow-sm bg-indigo-400/20 text-indigo-300`}>{quiz.config.language.substring(0,2)}</span>
                     </>}
                </div>
                {quiz.sourceContentSnippet && (
                    <p className="text-xs text-slate-500 italic line-clamp-1" title={quiz.sourceContentSnippet}>
                       {t('dashboardQuizCardSource', { snippet: '' })}<MathText text={quiz.sourceContentSnippet} />
                    </p>
                )}
                <p className="text-xs text-slate-500 pt-1.5">{t('dashboardQuizCardCreated', { date: dateFormatted })}</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between mt-auto border-t border-slate-700/50 p-4 sm:p-5 bg-slate-800/30 rounded-b-2xl">
            <div className="flex flex-wrap gap-x-3 gap-y-2 w-full sm:w-auto justify-center sm:justify-start">
              <Button 
                  size="sm" 
                  variant="primary" 
                  onClick={() => handleStartQuiz('take')} 
                  className="flex-grow xs:flex-grow-0 shadow-lg hover:shadow-sky-400/40 py-2 px-4 rounded-lg"
              >
                {t('dashboardQuizCardTakeQuiz')}
              </Button>
              <Button 
                  size="sm" 
                  variant="secondary" 
                  onClick={() => handleStartQuiz('practice')} 
                  className="flex-grow xs:flex-grow-0 py-2 px-4 rounded-lg bg-purple-500/80 hover:bg-purple-500/100 text-white hover:shadow-purple-400/40"
              >
                {t('practiceModeCardButton')}
              </Button>
               <Tooltip content={t('edit')} wrapperClassName="inline-flex flex-grow xs:flex-grow-0">
                <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => onEditQuiz(quiz)} 
                    className="w-full py-2 px-4 rounded-lg border-slate-500/70 hover:border-sky-400"
                    aria-label={t('edit')}
                >
                  <EditIcon className="w-4 h-4"/>
                </Button>
              </Tooltip>
              <Tooltip content={t('settings')} wrapperClassName="inline-flex flex-grow xs:flex-grow-0">
                  <Button
                      size="sm"
                      variant="outline"
                      onClick={openAttemptSettingsModal}
                      className="w-full py-2 px-4 rounded-lg border-slate-500/70 hover:border-sky-400"
                      aria-label={t('settings')}
                  >
                      <img src={settingsIconUrl} alt={t('settings')} className="w-4 h-4" />
                  </Button>
              </Tooltip>
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto justify-center sm:justify-end"> 
                <Tooltip content={t('share')} wrapperClassName="inline-flex">
                <Button size="sm" variant="ghost" onClick={() => alert(t('dashboardShareAlert', {quizId: quiz.id}))} className="text-slate-400 hover:text-green-400 !p-2.5 rounded-lg">
                    <ShareIcon className="w-4 h-4"/>
                </Button>
                </Tooltip>
                <Tooltip content={t('delete')} wrapperClassName="inline-flex">
                <Button size="sm" variant="ghost" onClick={handleDeleteRequest} className="text-slate-400 hover:text-red-500 !p-2.5 rounded-lg">
                    <DeleteIcon className="w-4 h-4"/>
                </Button>
                </Tooltip>
            </div>
          </div>
        </Card>
      </div>

      {isConfirmDeleteModalOpen && (
        <Modal
          isOpen={isConfirmDeleteModalOpen}
          onClose={handleCancelDelete}
          title={t('confirmDeletionTitle')}
          size="md"
          footerContent={
            <div className="flex justify-end gap-3.5">
              <Button variant="secondary" onClick={handleCancelDelete} size="md">
                {t('cancel')}
              </Button>
              <Button variant="danger" onClick={handleConfirmDelete} size="md">
                {t('confirmDeleteButton')}
              </Button>
            </div>
          }
        >
          <div className="flex items-start">
            <XCircleIcon className="w-10 h-10 text-red-400/80 mr-4 flex-shrink-0 mt-1" />
            <p className="text-slate-200 text-base leading-relaxed">
              <MathText text={t('confirmDeletionMessage', { quizName: quiz.title })} />
            </p>
          </div>
        </Modal>
      )}

      {isAttemptSettingsModalOpen && (
        <Modal
          isOpen={isAttemptSettingsModalOpen}
          onClose={handleCloseAttemptSettingsModal}
          title={
            <div className="flex items-center">
                <img src={settingsIconUrl} alt={t('settings')} className="w-6 h-6 mr-3" />
                {t('attemptSettingsModalTitle')}
            </div>
          }
          size="lg"
          footerContent={
            <div className="flex flex-col sm:flex-row justify-end gap-3.5">
              <Button variant="secondary" onClick={handleCloseAttemptSettingsModal} size="md" className="w-full sm:w-auto">
                {t('cancel')}
              </Button>
              <Button variant="primary" onClick={handleSaveAttemptSettings} size="md" className="w-full sm:w-auto">
                {t('saveSettingsButtonText')}
              </Button>
            </div>
          }
        >
          <div className="space-y-6 p-2">
            <Toggle
              label={t('attemptShuffleQuestionsLabel')}
              checked={currentAttemptSettings.shuffleQuestions}
              onChange={(checked) => handleAttemptSettingsChange('shuffleQuestions', checked)}
              labelClassName="font-medium text-slate-100"
            />
            <Toggle
              label={t('attemptShuffleAnswersLabel')}
              checked={currentAttemptSettings.shuffleAnswers}
              onChange={(checked) => handleAttemptSettingsChange('shuffleAnswers', checked)}
              labelClassName="font-medium text-slate-100"
            />
            <Input
              label={<span className="font-medium text-slate-100">{t('attemptTimeLimitLabel')}</span>}
              type="number"
              value={currentAttemptSettings.timeLimit}
              onChange={(e) => handleAttemptSettingsChange('timeLimit', parseInt(e.target.value, 10) >= 0 ? parseInt(e.target.value, 10) : 0)}
              min="0"
              inputClassName="text-sm"
              containerClassName="mt-1"
            />
            <p className="text-xs text-slate-400 -mt-4 pl-1">{t('attemptTimeLimitInfo')}</p>
          </div>
        </Modal>
      )}
    </>
  );
};

export default QuizCard;
