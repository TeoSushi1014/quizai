


import React, { useState, useEffect, useCallback, useRef, ReactNode, useReducer } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAppContext, useTranslation } from '../../App';
import { Quiz, Question, QuizConfig } from '../../types';
import { Button, Card, Input, Textarea, Select, Modal, LoadingSpinner, Tooltip, NotificationDisplay } from '../../components/ui'; // Added NotificationDisplay
import MathText from '../../components/MathText';
import { PlusIcon, DeleteIcon, SaveIcon, ArrowUturnLeftIcon, HomeIcon, PlusCircleIcon, EditIcon, ExportIcon, CopyIcon, DownloadIcon, InformationCircleIcon, GEMINI_MODEL_ID, DocumentTextIcon } from '../../constants';
import { formatQuizToAzotaStyle1, formatQuizToAzotaStyle2, formatQuizToAzotaStyle4 } from '../../services/azotaExportService';
import useIntersectionObserver from '../../hooks/useIntersectionObserver';
import { quizReducer, initialQuizReviewState, QuizReviewAction } from './quizReducer';
import { translations } from '../../i18n';
import { logger } from '../../services/logService'; // Import logger
import { useNotification } from '../../hooks/useNotification'; // Import useNotification


type AzotaFormat = 'style1' | 'style2' | 'style4';

const AzotaExportModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  quiz: Quiz;
}> = ({ isOpen, onClose, quiz }) => {
  const { t } = useTranslation();
  const [selectedFormat, setSelectedFormat] = useState<AzotaFormat>('style1');
  const [formattedText, setFormattedText] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [formattingError, setFormattingError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && quiz) {
      setFormattingError(null);
      try {
        let text = '';
        switch (selectedFormat) {
          case 'style1': text = formatQuizToAzotaStyle1(quiz, t); break;
          case 'style2': text = formatQuizToAzotaStyle2(quiz, t); break;
          case 'style4': text = formatQuizToAzotaStyle4(quiz, t); break;
          default: text = t('azotaExportErrorGenerating');
        }
        setFormattedText(text);
      } catch (error) {
        logger.error("Error formatting quiz for Azota:", 'AzotaExportModal', { quizId: quiz.id, format: selectedFormat }, error as Error);
        setFormattedText(t('azotaExportErrorGenerating'));
        setFormattingError(error instanceof Error ? error.message : String(error));
      }
    }
  }, [isOpen, quiz, selectedFormat, t]);

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(formattedText)
      .then(() => { setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); })
      .catch(err => { 
        logger.error('Failed to copy Azota text to clipboard', 'AzotaExportModal', undefined, err);
        alert(t('azotaExportErrorCopy')); 
      });
  };

  const handleDownload = () => {
    const blob = new Blob([formattedText], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const safeTitle = quiz.title.replace(/[^a-z0-9_.-]/gi, '_').substring(0, 50) || 'quiz';
    link.download = `${safeTitle}_Azota_${selectedFormat}.txt`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    logger.info('Azota quiz downloaded', 'AzotaExportModal', { quizId: quiz.id, format: selectedFormat, filename: link.download });
  };

  const formatOptions: { value: AzotaFormat; label: string }[] = [
    { value: 'style1', label: t('azotaExportFormatStyle1') }, { value: 'style2', label: t('azotaExportFormatStyle2') }, { value: 'style4', label: t('azotaExportFormatStyle4') },
  ];

  if (!quiz) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('azotaExportTitle')} size="3xl">
      <div className="space-y-6">
        <Select label={t('azotaExportSelectFormat')} options={formatOptions} value={selectedFormat} onChange={(e) => setSelectedFormat(e.target.value as AzotaFormat)} />
        {formattingError && (
          <div role="alert" className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-xs text-red-300">
            <p><strong>{t('error')}:</strong> {t('azotaExportErrorGenerating')}</p>
            <p className="mt-1 text-red-400/80">{formattingError}</p>
          </div>
        )}
        <Textarea value={formattedText} readOnly rows={18} className={`text-xs font-mono !bg-slate-700/70 !border-slate-600 p-4 min-h-[360px] shadow-inner`} aria-label={t('azotaExportPreviewArea')} />
        <div className="flex flex-col sm:flex-row justify-end gap-3.5 pt-2">
          <Button variant="secondary" onClick={onClose} size="md">{t('close')}</Button>
          <Button variant="outline" onClick={handleCopyToClipboard} leftIcon={<CopyIcon className="w-4 h-4"/>} size="md" className="w-full sm:w-auto" disabled={!!formattingError}> {copySuccess ? t('azotaExportCopied') : t('azotaExportCopy')} </Button>
          <Button variant="primary" onClick={handleDownload} leftIcon={<DownloadIcon className="w-4 h-4" />} size="md" className="w-full sm:w-auto" disabled={!!formattingError}> {t('azotaExportDownload')} </Button>
        </div>
      </div>
    </Modal>
  );
};
AzotaExportModal.displayName = "AzotaExportModal";

interface QuestionItemProps {
  question: Question;
  index: number;
  dispatch: React.Dispatch<QuizReviewAction>;
  animationDelayFactor: number;
}

const QuestionItem: React.FC<QuestionItemProps> = ({
  question,
  index: questionIndex,
  dispatch,
  animationDelayFactor
}) => {
  const { t } = useTranslation();
  const itemRef = useRef<HTMLDivElement>(null);
  const isVisible = useIntersectionObserver(itemRef, { threshold: 0.1, freezeOnceVisible: true });

  const optionItems = question.options.map((opt, optIndex) => ({
    value: opt,
    label: `${t('reviewOptionLabel', {index: optIndex+1})}: ${opt.length > 30 ? opt.substring(0,27) + '...' : opt}`
  }));

  if (optionItems.length === 0 && question.correctAnswer) {
     optionItems.push({value: question.correctAnswer, label: question.correctAnswer});
  }

  const handleFieldChange = (field: keyof Question, value: any) => {
    dispatch({ type: 'UPDATE_QUESTION', payload: { index: questionIndex, question: { ...question, [field]: value } } });
  };

  const handleOptionChange = (optionIdx: number, newText: string) => {
    const newOptions = [...question.options];
    newOptions[optionIdx] = newText;
    let newCorrectAnswer = question.correctAnswer;
    if (question.correctAnswer === question.options[optionIdx]) {
      newCorrectAnswer = newText;
    } else if (!newOptions.includes(question.correctAnswer) && newOptions.length > 0) {
      newCorrectAnswer = newOptions[0];
    } else if (newOptions.length === 0) {
      newCorrectAnswer = "";
    }
    dispatch({ type: 'UPDATE_QUESTION', payload: { index: questionIndex, question: { ...question, options: newOptions, correctAnswer: newCorrectAnswer } } });
  };

  const handleAddOption = () => {
    if (question.options.length >= 5) return;
    const newOptionText = t('reviewNewOptionDefault', { index: question.options.length + 1 });
    const newOptions = [...question.options, newOptionText];
    dispatch({ type: 'UPDATE_QUESTION', payload: { index: questionIndex, question: { ...question, options: newOptions } } });
  };

  const handleRemoveOption = (optionIdx: number) => {
    if (question.options.length <= 2) {
      alert(t('reviewErrorNotEnoughOptions', {id: ""}).replace(" for question ID: {id}", ""));
      return;
    }
    const oldOptionText = question.options[optionIdx];
    const newOptions = question.options.filter((_, i) => i !== optionIdx);
    let newCorrectAnswer = question.correctAnswer;
    if (oldOptionText === question.correctAnswer && !newOptions.includes(oldOptionText)) {
      newCorrectAnswer = newOptions.length > 0 ? newOptions[0] : "";
    }
    dispatch({ type: 'UPDATE_QUESTION', payload: { index: questionIndex, question: { ...question, options: newOptions, correctAnswer: newCorrectAnswer } } });
  };

  const handleDeleteQuestionRequest = () => {
    // This function will be passed to the QuizCard/QuestionItem and should trigger the new handleDeleteQuestion in QuizReviewPage
    dispatch({ type: 'REMOVE_QUESTION_REQUEST', payload: { index: questionIndex, questionId: question.id } });
  };


  return (
    <motion.div
      ref={itemRef}
      initial={{ opacity: 0, y: 30 }}
      animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1], delay: isVisible ? animationDelayFactor * 0.07 : 0 }}
      className="question-item-motion-wrapper"
    >
      <Card useGlassEffect className="shadow-xl !rounded-2xl !border-slate-700/50">
        <div className="flex justify-between items-center mb-5 sm:mb-6">
          <h3 className="text-lg sm:text-xl font-semibold text-sky-300">
            {t('reviewQuestionLabel', { index: questionIndex + 1 })}
          </h3>
          <Tooltip content={t('reviewDeleteQuestionLabel')} placement="left">
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteQuestionRequest} // Changed to request
              className="!p-2.5 rounded-lg shadow-md hover:shadow-red-500/50"
              aria-label={t('reviewDeleteQuestionLabel')}
            >
              <DeleteIcon className="w-4 h-4" />
            </Button>
          </Tooltip>
        </div>

        <div className="space-y-5 sm:space-y-6">
          <Textarea
            label={<span className="font-medium text-slate-200">{t('reviewQuestionTextLabel')}</span>}
            value={question.questionText}
            onChange={(e) => handleFieldChange('questionText', e.target.value)}
            placeholder={t('reviewQuestionTextPlaceholder')}
            rows={3}
            className="min-h-[80px] text-sm"
          />

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2.5">{t('reviewOptionsLabel')}</label>
            <div className="space-y-3.5">
              {question.options.map((optionText, optIndex) => (
                <div key={optIndex} className="flex items-center gap-3">
                  <Input
                    id={`option-input-${question.id}-${optIndex}`}
                    value={optionText}
                    onChange={(e) => handleOptionChange(optIndex, e.target.value)}
                    placeholder={t('reviewOptionPlaceholder', {index: optIndex + 1})}
                    inputClassName="text-sm !py-2.5"
                    containerClassName="flex-grow"
                  />
                  {question.options.length > 2 && (
                    <Tooltip content={t('reviewRemoveOptionLabel')} placement="right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveOption(optIndex)}
                        className="!p-2.5 rounded-lg text-red-400/80 hover:text-red-400 hover:bg-red-400/15"
                        aria-label={t('reviewRemoveOptionLabel')}
                      >
                        <DeleteIcon className="w-4 h-4" />
                      </Button>
                    </Tooltip>
                  )}
                </div>
              ))}
            </div>
            {question.options.length < 5 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddOption}
                leftIcon={<PlusIcon className="w-4 h-4" strokeWidth={2}/>}
                className="mt-4 py-2 px-4 rounded-lg border-dashed border-sky-400/70 text-sky-300 hover:bg-sky-400/15 hover:border-sky-400"
              >
                {t('reviewAddOption')}
              </Button>
            )}
          </div>
          
          <Select
            label={<span className="font-medium text-slate-200">{t('reviewCorrectAnswerLabel')}</span>}
            value={question.correctAnswer}
            onChange={(e) => handleFieldChange('correctAnswer', e.target.value)}
            options={optionItems.length > 0 ? optionItems : [{value: "", label: "Please add options"}]}
            disabled={optionItems.length === 0}
            className="text-sm"
          />

          <Textarea
            label={<span className="font-medium text-slate-200">{t('reviewExplanationLabel')}</span>}
            value={question.explanation}
            onChange={(e) => handleFieldChange('explanation', e.target.value)}
            placeholder={t('reviewExplanationPlaceholder')}
            rows={3}
            className="min-h-[80px] text-sm"
          />
        </div>
      </Card>
    </motion.div>
  );
};
QuestionItem.displayName = "QuestionItem";

const QuizReviewPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const { addQuiz, updateQuiz, quizzes } = useAppContext();
  const { notification, showSuccess, showError, clearNotification } = useNotification();

  const [state, dispatch] = useReducer(quizReducer, initialQuizReviewState);
  const { editableQuiz, isLoading, isSaving, error, questionToDelete } = state; // Added questionToDelete

  const [isAzotaExportModalOpen, setIsAzotaExportModalOpen] = useState(false);
  const [focusOptionInput, setFocusOptionInput] = useState<{ questionId: string; optionIndex: number } | null>(null); 
  const [confirmDeleteQuestionModal, setConfirmDeleteQuestionModal] = useState<{ isOpen: boolean; questionIndex: number | null; questionId: string | null }>({ isOpen: false, questionIndex: null, questionId: null });


  const { quizId: existingQuizIdFromParams } = useParams<{ quizId?: string }>();

  useEffect(() => {
    logger.info("QuizReviewPage: Initializing or location state changed.", "QuizReviewPage", { hasLocationState: !!location.state, existingQuizIdFromParams });
    dispatch({ type: 'SET_LOADING', payload: true });
    let initialData: { generatedQuizData?: any; quizTitleSuggestion?: string; finalConfig?: QuizConfig, existingQuiz?: Quiz } | null = null;
    if (location.state) initialData = location.state as any;
    const existingQuizId = existingQuizIdFromParams || initialData?.existingQuiz?.id;
    let quizToLoad: Quiz | null = null;

    if (existingQuizId) {
      quizToLoad = initialData?.existingQuiz || quizzes.find(q => q.id === existingQuizId) || null;
      if (!quizToLoad) {
        logger.error("Quiz not found for editing.", "QuizReviewPage", { existingQuizId });
        dispatch({ type: 'SET_ERROR', payload: t('reviewErrorQuizNotFound') });
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }
      logger.info("Loading existing quiz for review/edit.", "QuizReviewPage", { quizId: quizToLoad.id });
    } else if (initialData?.generatedQuizData && initialData.finalConfig) {
      const { generatedQuizData, quizTitleSuggestion, finalConfig } = initialData;
      const now = new Date().toISOString();
      quizToLoad = {
        id: `new-quiz-${Date.now()}`,
        title: quizTitleSuggestion || generatedQuizData.title || t('untitledQuiz'),
        questions: generatedQuizData.questions,
        config: finalConfig,
        sourceContentSnippet: generatedQuizData.sourceContentSnippet,
        createdAt: now,
        lastModified: now,
      };
      logger.info("Initializing review page with newly generated quiz data.", "QuizReviewPage", { title: quizToLoad.title });
    }

    if (quizToLoad) {
      dispatch({ type: 'INIT_QUIZ_DATA', payload: { quiz: quizToLoad, language } });
    } else if (!existingQuizIdFromParams) { 
      logger.warn("No quiz data provided to review page.", "QuizReviewPage");
      dispatch({ type: 'SET_ERROR', payload: t('reviewErrorNoQuizData') });
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [location.state, existingQuizIdFromParams, quizzes, t, language, dispatch]);


  useEffect(() => {
    if (focusOptionInput && editableQuiz) {
      const question = editableQuiz.questions.find(q => q.id === focusOptionInput.questionId);
      if (question) {
          const inputId = `option-input-${focusOptionInput.questionId}-${focusOptionInput.optionIndex}`;
          const element = document.getElementById(inputId);
          element?.focus();
      }
      setFocusOptionInput(null);
    }
  }, [focusOptionInput, editableQuiz]);

  // Effect to handle question deletion confirmation
  useEffect(() => {
    if (questionToDelete) {
      setConfirmDeleteQuestionModal({ isOpen: true, questionIndex: questionToDelete.index, questionId: questionToDelete.questionId });
    }
  }, [questionToDelete]);

  const handleQuizTitleChange = (newTitle: string) => {
    dispatch({ type: 'UPDATE_QUIZ_TITLE', payload: newTitle });
  };

  const handleAddNewQuestion = () => {
    dispatch({ type: 'ADD_QUESTION', payload: { language } });
    logger.info("Added new question to quiz being reviewed.", "QuizReviewPage");
  };

  const handleDeleteQuestion = async () => {
    if (!editableQuiz || confirmDeleteQuestionModal.questionIndex === null || confirmDeleteQuestionModal.questionId === null) return;

    const questionIndexToDelete = confirmDeleteQuestionModal.questionIndex;
    setConfirmDeleteQuestionModal({ isOpen: false, questionIndex: null, questionId: null }); // Close modal first

    const updatedQuizData = {
      ...editableQuiz,
      questions: editableQuiz.questions.filter((_, index) => index !== questionIndexToDelete),
      lastModified: new Date().toISOString()
    };
    
    // Dispatch local state update first for UI responsiveness
    dispatch({ type: 'REMOVE_QUESTION_CONFIRMED', payload: { index: questionIndexToDelete }});

    try {
      if (existingQuizIdFromParams) {
        await updateQuiz(updatedQuizData);
      } else {
        // This case implies deleting a question from a quiz that hasn't been saved yet.
        // addQuiz would typically be for a brand new quiz. If it's an unsaved quiz being edited,
        // the 'editableQuiz' in the reducer is the source of truth. The final save will use addQuiz.
        // For now, the local state update is primary. The main 'Save Quiz' button will handle persistence.
        // However, to trigger sync, we must call updateQuiz or addQuiz from context.
        // If it's a new quiz being edited, addQuiz would create it.
        // If it's an existing quiz, updateQuiz updates it.
        // Let's assume any quiz being edited to this point has an ID and can be 'updated'.
        // If not `existingQuizIdFromParams`, it means it's a new quiz from generation.
        // We still need to save it if any interaction happens that needs persistence.
        await updateQuiz(updatedQuizData); // Assuming updateQuiz can handle "upsert" or add if not found (or AppContext handles it)
                                         // More robustly, one might need specific context function `updateEditableQuizInLocalStore`
      }
      logger.info("Question deleted and quiz updated", "QuizReviewPage", { quizId: updatedQuizData.id, questionId: confirmDeleteQuestionModal.questionId, remainingQuestions: updatedQuizData.questions.length });
      showSuccess(t('questionDeletedSuccessfully'), 3000);
    } catch (error) {
      logger.error("Error saving quiz after question deletion", "QuizReviewPage", { quizId: updatedQuizData.id, questionId: confirmDeleteQuestionModal.questionId }, error as Error);
      showError(t('reviewErrorSaving'), 5000);
      // Optionally, revert local state change or re-fetch if save fails critically
      dispatch({ type: 'INIT_QUIZ_DATA', payload: { quiz: editableQuiz, language } }); // Revert to pre-delete state
    }
  };


  const handleSaveQuiz = async () => {
    if (!editableQuiz || editableQuiz.questions.length === 0) {
      dispatch({ type: 'SET_ERROR', payload: t('reviewCannotSaveNoQuestions') });
      logger.warn("Attempted to save quiz with no questions.", "QuizReviewPage", { quizId: editableQuiz?.id });
      return;
    }
    for (const q of editableQuiz.questions) {
      if (!q.questionText.trim()) { dispatch({ type: 'SET_ERROR', payload: t('reviewErrorEmptyQuestionText', {id: q.id.substring(0,8)})}); return; }
      if (q.options.length < 2) { dispatch({ type: 'SET_ERROR', payload: t('reviewErrorNotEnoughOptions', {id: q.id.substring(0,8)})}); return; }
      if (!q.correctAnswer || !q.options.includes(q.correctAnswer)) { dispatch({ type: 'SET_ERROR', payload: t('reviewErrorInvalidCorrectAnswer', {id: q.id.substring(0,8)})}); return; }
      if (!q.explanation.trim()) { dispatch({ type: 'SET_ERROR', payload: t('reviewErrorEmptyExplanation', {id: q.id.substring(0,8)})}); return; }
    }
    dispatch({ type: 'SET_ERROR', payload: null });
    dispatch({ type: 'SET_SAVING', payload: true });
    
    try {
      const now = new Date().toISOString();
      const quizToSave: Quiz = {
        ...editableQuiz,
        id: existingQuizIdFromParams || editableQuiz.id || `quiz-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: editableQuiz.title.trim() || t('untitledQuiz'),
        createdAt: editableQuiz.createdAt || now, 
        lastModified: now, 
        config: editableQuiz.config || { 
          numQuestions: editableQuiz.questions.length, 
          difficulty: 'Medium', 
          language: language === 'vi' ? 'Vietnamese' : 'English', 
          customUserPrompt: '', 
          selectedModel: GEMINI_MODEL_ID 
        },
      };

      logger.info("Attempting to save quiz...", "QuizReviewPage", { quizId: quizToSave.id, title: quizToSave.title, questionCount: quizToSave.questions.length });

      if (existingQuizIdFromParams) {
        await updateQuiz(quizToSave); 
      } else {
        await addQuiz(quizToSave); 
      }
      
      logger.info("Quiz saved successfully. Navigating to dashboard.", "QuizReviewPage", { quizId: quizToSave.id });
      navigate('/dashboard');

    } catch (error) {
      logger.error("Error saving quiz", "QuizReviewPage", { quizId: editableQuiz?.id }, error as Error);
      dispatch({ type: 'SET_ERROR', payload: t('reviewErrorSaving') });
    } finally {
      dispatch({ type: 'SET_SAVING', payload: false });
    }
  };

  const handleCloseAzotaExportModal = useCallback(() => setIsAzotaExportModalOpen(false), []);

  if (isLoading) return <LoadingSpinner text={t('loading')} className="mt-24" size="xl"/>;
  if (error && !editableQuiz && !isSaving) return <Card className="text-red-400 p-12 text-center shadow-xl !border-red-500/70 !bg-red-800/40 text-lg font-semibold !rounded-2xl animate-fadeInUp" useGlassEffect>{error}</Card>;
  if (!editableQuiz) return <Card className="text-slate-400 p-12 text-center shadow-lg text-lg font-medium !rounded-2xl animate-fadeInUp" useGlassEffect>{t('reviewErrorNoQuizData')}</Card>;

  const isEditingExisting = !!existingQuizIdFromParams;

  return (
    <div className="pb-16">
      <NotificationDisplay notification={notification} onClose={clearNotification} />
      <div className={`sticky-review-actions bg-slate-800 shadow-xl py-4 -mx-4 sm:-mx-6 lg:-mx-8 rounded-b-2xl border-b border-slate-700 animate-fadeInUp`}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-50 leading-tight truncate tracking-tight flex items-center" title={editableQuiz.title}>
                     {isEditingExisting ? t('reviewEditQuizTitle') : t('reviewFinalizeQuizTitle')}
                </h1>
                <div className="flex flex-wrap justify-center sm:justify-end items-center gap-2.5">
                    {!isEditingExisting && (<Button variant="outline" size="sm" onClick={() => navigate('/create')} leftIcon={<ArrowUturnLeftIcon className="w-4 h-4"/>}> {t('reviewDiscardRegenerateShort')} </Button>)}
                    <Button variant="secondary" size="sm" onClick={() => navigate('/dashboard')} leftIcon={<HomeIcon className="w-4 h-4"/>}> {isEditingExisting ? t('cancel') : t('reviewDiscardToDashboardShort')} </Button>
                    <Button variant="outline" size="sm" onClick={() => setIsAzotaExportModalOpen(true)} leftIcon={<ExportIcon className="w-4 h-4"/>} className="border-sky-400/70 text-sky-300 hover:bg-sky-400/15" disabled={!editableQuiz || editableQuiz.questions.length === 0}> {t('azotaExportButton')} </Button>
                    <Button variant="primary" size="sm" onClick={handleSaveQuiz} isLoading={isSaving} disabled={isSaving || !editableQuiz.questions.length} leftIcon={<SaveIcon className="w-4 h-4"/>} className="bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white"> {isSaving ? t('reviewSavingButton') : (isEditingExisting ? t('reviewSaveChangesButton') : t('reviewSaveButton'))} </Button>
                </div>
            </div>
            {error && <p role="alert" className={`text-xs text-red-300 mt-4 bg-red-500/20 p-3 rounded-lg text-center sm:text-left shadow animate-fadeIn`}>{error}</p>}
            {editableQuiz && !editableQuiz.questions.length && <p role="alert" className={`text-xs text-yellow-400 mt-4 bg-yellow-500/20 p-3 rounded-lg text-center sm:text-left shadow animate-fadeIn`}>{t('reviewCannotSaveNoQuestions')}</p>}
        </div>
      </div>

      <div className="pt-6 sm:pt-8">
         <Card useGlassEffect className="shadow-xl !rounded-2xl !border-slate-700/50 mb-6 sm:mb-8">
            <Input
                label={<p className="text-lg font-semibold text-slate-100">{t('reviewQuizTitleLabel')}</p>}
                value={editableQuiz.title}
                onChange={(e) => handleQuizTitleChange(e.target.value)}
                placeholder={t('step2QuizTitlePlaceholder')}
                inputClassName="text-xl py-3.5"
                containerClassName="mb-2"
            />
             {editableQuiz.sourceContentSnippet && (
                <details className="mt-4">
                    <summary className="text-xs text-slate-400 cursor-pointer hover:text-sky-300 flex items-center font-semibold group transition-colors var(--duration-fast) var(--ease-ios)">
                        <DocumentTextIcon className="w-4 h-4 mr-2.5 text-slate-500 group-hover:text-sky-400 transition-colors var(--duration-fast) var(--ease-ios)" strokeWidth={2} />
                        {t('resultsViewSourceSnippet')}
                    </summary>
                    <blockquote className="mt-3 text-xs text-slate-400/80 max-h-24 overflow-y-auto p-3 bg-slate-700/60 border border-slate-600/60 rounded-lg shadow-inner italic">
                        <MathText text={editableQuiz.sourceContentSnippet} />
                    </blockquote>
                </details>
            )}
         </Card>
        
        <div className="space-y-6 sm:space-y-8">
          {editableQuiz.questions.map((q, idx) => (
            <QuestionItem
              key={q.id} 
              question={q}
              index={idx}
              dispatch={dispatch}
              animationDelayFactor={idx}
            />
          ))}
        </div>
      </div>

      <div className="mt-10 sm:mt-12 text-center">
        <Button variant="subtle" onClick={handleAddNewQuestion} leftIcon={<PlusCircleIcon className="w-5 h-5" />} className={`border-2 border-dashed border-slate-600 hover:border-sky-400/80 text-slate-300 hover:text-sky-300 py-3 px-6 rounded-xl shadow-lg hover:shadow-black/20`}>
           {t('reviewAddNewQuestion')}
        </Button>
      </div>
      
      {editableQuiz && isAzotaExportModalOpen && (
        <AzotaExportModal
          isOpen={isAzotaExportModalOpen}
          onClose={handleCloseAzotaExportModal}
          quiz={editableQuiz}
        />
      )}

      {confirmDeleteQuestionModal.isOpen && (
        <Modal
          isOpen={confirmDeleteQuestionModal.isOpen}
          onClose={() => setConfirmDeleteQuestionModal({ isOpen: false, questionIndex: null, questionId: null })}
          title={t('confirmDeletionTitle')}
          size="md"
          footerContent={
            <div className="flex justify-end gap-3.5">
              <Button variant="secondary" onClick={() => setConfirmDeleteQuestionModal({ isOpen: false, questionIndex: null, questionId: null })} size="md">
                {t('cancel')}
              </Button>
              <Button variant="danger" onClick={handleDeleteQuestion} size="md">
                {t('confirmDeleteButton')}
              </Button>
            </div>
          }
        >
          <p className="text-slate-200 text-base leading-relaxed">
            {t('reviewDeleteQuestionConfirmationMessage', { questionIndex: (confirmDeleteQuestionModal.questionIndex ?? 0) + 1 })}
          </p>
        </Modal>
      )}
    </div>
  );
};
QuizReviewPage.displayName = "QuizReviewPage";

export default QuizReviewPage;