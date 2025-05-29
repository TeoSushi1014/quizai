
import React, { useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion'; 
import { useAppContext, useTranslation } from '../../App';
import { Quiz, Question, QuizConfig } from '../../types';
import { Button, Card, Input, Textarea, Select, Modal, LoadingSpinner, Tooltip } from '../../components/ui';
import MathText from '../../components/MathText';
import { PlusIcon, DeleteIcon, SaveIcon, ArrowUturnLeftIcon, HomeIcon, PlusCircleIcon, EditIcon, ExportIcon, CopyIcon, DownloadIcon, InformationCircleIcon } from '../../constants';
import { formatQuizToAzotaStyle1, formatQuizToAzotaStyle2, formatQuizToAzotaStyle4 } from '../../services/azotaExportService';
import useIntersectionObserver from '../../hooks/useIntersectionObserver';


interface EditableQuizData {
  title: string;
  questions: Question[];
  config: QuizConfig;
  sourceContentSnippet?: string;
}

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
        console.error("Error formatting quiz for Azota:", error);
        setFormattedText(t('azotaExportErrorGenerating'));
        setFormattingError(error instanceof Error ? error.message : String(error));
      }
    }
  }, [isOpen, quiz, selectedFormat, t]);

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(formattedText).then(() => { setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); })
    .catch(err => { console.error('Failed to copy text: ', err); alert(t('azotaExportErrorCopy')); });
  };

  const handleDownload = () => {
    const blob = new Blob([formattedText], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const safeTitle = quiz.title.replace(/[^a-z0-9_.-]/gi, '_').substring(0, 50) || 'quiz';
    link.download = `${safeTitle}_Azota_${selectedFormat}.txt`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
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
  // editableQuiz is not directly used if specific handlers are passed and work on the parent's state
  // setEditableQuiz is not directly used if specific handlers are passed
  handleFieldChange: (questionId: string, field: keyof Question, value: any) => void;
  handleOptionChange: (questionId: string, optionIndex: number, newText: string) => void;
  handleAddOption: (questionId: string) => void;
  handleRemoveOption: (questionId: string, optionIndex: number) => void;
  handleDeleteQuestion: (questionId: string) => void;
  animationDelayFactor: number;
}

const QuestionItem: React.FC<QuestionItemProps> = ({
  question,
  index,
  handleFieldChange,
  handleOptionChange,
  handleAddOption,
  handleRemoveOption,
  handleDeleteQuestion,
  animationDelayFactor
}) => {
  const { t } = useTranslation();
  const itemRef = useRef<HTMLDivElement>(null);
  const isVisible = useIntersectionObserver(itemRef, { threshold: 0.1, freezeOnceVisible: true });

  const optionItems = question.options.map((opt, optIndex) => ({
    value: opt, // Value must be the option text itself to match correctAnswer
    label: `${t('reviewOptionLabel', {index: optIndex+1})}: ${opt.length > 30 ? opt.substring(0,27) + '...' : opt}`
  }));

  if (optionItems.length === 0 && question.correctAnswer) {
     optionItems.push({value: question.correctAnswer, label: question.correctAnswer});
  } else if (optionItems.length > 0 && !question.options.includes(question.correctAnswer)) {
     // This case should be handled by handleOptionChange or when initializing/saving to ensure correctAnswer is always valid.
     // For display, if correctAnswer is somehow not in options, the Select might behave unexpectedly.
     // A robust solution would be to ensure correctAnswer is always one of the options.
  }


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
            {t('reviewQuestionLabel', { index: index + 1 })}
          </h3>
          <Tooltip content={t('reviewDeleteQuestionLabel')} placement="left">
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleDeleteQuestion(question.id)}
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
            onChange={(e) => handleFieldChange(question.id, 'questionText', e.target.value)}
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
                    onChange={(e) => handleOptionChange(question.id, optIndex, e.target.value)}
                    placeholder={t('reviewOptionPlaceholder', {index: optIndex + 1})}
                    inputClassName="text-sm !py-2.5"
                    containerClassName="flex-grow"
                  />
                  {question.options.length > 2 && (
                    <Tooltip content={t('reviewRemoveOptionLabel')} placement="right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveOption(question.id, optIndex)}
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
                onClick={() => handleAddOption(question.id)}
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
            onChange={(e) => handleFieldChange(question.id, 'correctAnswer', e.target.value)}
            options={optionItems.length > 0 ? optionItems : [{value: "", label: "Please add options"}]}
            disabled={optionItems.length === 0}
            className="text-sm"
          />

          <Textarea
            label={<span className="font-medium text-slate-200">{t('reviewExplanationLabel')}</span>}
            value={question.explanation}
            onChange={(e) => handleFieldChange(question.id, 'explanation', e.target.value)}
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
  const { t } = useTranslation();
  const { addQuiz, updateQuiz, quizzes, language } = useAppContext();

  const [editableQuiz, setEditableQuiz] = useState<EditableQuizData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAzotaExportModalOpen, setIsAzotaExportModalOpen] = useState(false);
  const [focusOptionInput, setFocusOptionInput] = useState<{ questionId: string; optionIndex: number } | null>(null);

  const titleCardRef = useRef<HTMLDivElement>(null);
  const isTitleCardVisible = useIntersectionObserver(titleCardRef, { threshold: 0.2, freezeOnceVisible: true });

  const { quizId: existingQuizIdFromParams } = useParams<{ quizId?: string }>();

  useEffect(() => {
    let initialData: { generatedQuizData?: any; quizTitleSuggestion?: string; finalConfig?: QuizConfig, existingQuiz?: Quiz } | null = null;
    if (location.state) initialData = location.state as any;
    const existingQuizId = existingQuizIdFromParams || initialData?.existingQuiz?.id;

    if (existingQuizId && !initialData?.existingQuiz) {
        const quizFromContext = quizzes.find(q => q.id === existingQuizId);
        if (quizFromContext) initialData = { ...initialData, existingQuiz: quizFromContext };
        else { setError(t('reviewErrorQuizNotFound')); setIsLoading(false); return; }
    }
    
    if (initialData?.existingQuiz) {
        const q = initialData.existingQuiz;
        setEditableQuiz({ title: q.title, questions: JSON.parse(JSON.stringify(q.questions)), config: q.config || { numQuestions: q.questions.length, difficulty: 'Medium', language: language === 'vi' ? 'Vietnamese' : 'English', customUserPrompt: '', selectedModel: 'gemini' }, sourceContentSnippet: q.sourceContentSnippet });
    } else if (initialData?.generatedQuizData && initialData.finalConfig) {
      const { generatedQuizData, quizTitleSuggestion, finalConfig } = initialData;
      setEditableQuiz({ title: quizTitleSuggestion || generatedQuizData.title, questions: JSON.parse(JSON.stringify(generatedQuizData.questions)), config: finalConfig, sourceContentSnippet: generatedQuizData.sourceContentSnippet });
    } else if (!existingQuizIdFromParams) { setError(t('reviewErrorNoQuizData')); }
    setIsLoading(false);
  }, [location.state, existingQuizIdFromParams, quizzes, t, language]);

  useEffect(() => {
    if (focusOptionInput) {
      const inputId = `option-input-${focusOptionInput.questionId}-${focusOptionInput.optionIndex}`;
      const element = document.getElementById(inputId);
      element?.focus();
      setFocusOptionInput(null);
    }
  }, [focusOptionInput]);

  const handleFieldChange = (questionId: string, field: keyof Question, value: any) => { setEditableQuiz(prev => prev ? { ...prev, questions: prev.questions.map(q => q.id === questionId ? { ...q, [field]: value } : q) } : null); };
  const handleOptionChange = (questionId: string, optionIndex: number, newText: string) => {
    setEditableQuiz(prev => prev ? { ...prev, questions: prev.questions.map(q => { if (q.id === questionId) { const oldOpt = q.options[optionIndex]; const newOpts = [...q.options]; newOpts[optionIndex] = newText; let newCorrect = q.correctAnswer; if (q.correctAnswer === oldOpt) newCorrect = newText; else if (!newOpts.includes(q.correctAnswer) && newOpts.length > 0) newCorrect = newOpts[0]; else if (newOpts.length === 0) newCorrect = ""; return { ...q, options: newOpts, correctAnswer: newCorrect }; } return q; }) } : null);
  };
  
  const handleAddOption = (questionId: string) => {
    let newOptionIndex = -1;
    setEditableQuiz(prev => {
      if (!prev) return null;
      return {
        ...prev,
        questions: prev.questions.map(q => {
          if (q.id === questionId) {
            if (q.options.length >= 5) return q; // Max 5 options
            newOptionIndex = q.options.length;
            return { ...q, options: [...q.options, t('reviewNewOptionDefault', { index: newOptionIndex + 1 })] };
          }
          return q;
        })
      };
    });
    if (newOptionIndex !== -1) {
      setFocusOptionInput({ questionId, optionIndex: newOptionIndex });
    }
  };

  const handleRemoveOption = (questionId: string, optionIndex: number) => {
    setEditableQuiz(prev => prev ? { ...prev, questions: prev.questions.map(q => { if (q.id === questionId) { if (q.options.length <= 2) { alert(t('reviewErrorNotEnoughOptions', {id: ""}).replace(" for question ID: {id}", "")); return q; } const oldOpt = q.options[optionIndex]; const newOpts = q.options.filter((_,i) => i !== optionIndex); let newCorrect = q.correctAnswer; if (oldOpt === q.correctAnswer && !newOpts.includes(oldOpt)) newCorrect = newOpts.length > 0 ? newOpts[0] : ""; return { ...q, options: newOpts, correctAnswer: newCorrect }; } return q; }) } : null);
  };
  const handleDeleteQuestion = (questionId: string) => { setEditableQuiz(prev => { if (!prev) return null; if (prev.questions.length === 1) { setError(t('reviewCannotSaveNoQuestions')); return prev; } return { ...prev, questions: prev.questions.filter(q => q.id !== questionId) }; }); };
  const handleAddNewQuestion = () => { setEditableQuiz(prev => prev ? { ...prev, questions: [...prev.questions, { id: `manual-q-${Date.now()}`, questionText: t('reviewNewQuestionDefaultText'), options: [t('reviewNewOptionDefault',{index:1}), t('reviewNewOptionDefault',{index:2})], correctAnswer: t('reviewNewOptionDefault',{index:1}), explanation: t('reviewNewExplanationDefaultText') }] } : null); };

  const handleSaveQuiz = () => {
    if (!editableQuiz || editableQuiz.questions.length === 0) { setError(t('reviewCannotSaveNoQuestions')); return; }
    for (const q of editableQuiz.questions) {
        if (!q.questionText.trim()) { setError(t('reviewErrorEmptyQuestionText', {id: q.id.substring(0,8)})); return; }
        if (q.options.length < 2) { setError(t('reviewErrorNotEnoughOptions', {id: q.id.substring(0,8)})); return; }
        if (!q.correctAnswer || !q.options.includes(q.correctAnswer)) { setError(t('reviewErrorInvalidCorrectAnswer', {id: q.id.substring(0,8)})); return; }
        if (!q.explanation.trim()) { setError(t('reviewErrorEmptyExplanation', {id: q.id.substring(0,8)})); return; }
    }
    setError(null); setIsSaving(true);
    const quizToSave: Quiz = { id: existingQuizIdFromParams || `quiz-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, title: editableQuiz.title.trim() || t('untitledQuiz'), questions: editableQuiz.questions, createdAt: existingQuizIdFromParams ? (quizzes.find(q=>q.id === existingQuizIdFromParams)?.createdAt || new Date().toISOString()) : new Date().toISOString(), sourceContentSnippet: editableQuiz.sourceContentSnippet, config: editableQuiz.config };
    setTimeout(() => { if (existingQuizIdFromParams) updateQuiz(quizToSave); else addQuiz(quizToSave); setIsSaving(false); navigate('/dashboard'); }, 700);
  };
  
  const handleCloseAzotaExportModal = useCallback(() => {
    setIsAzotaExportModalOpen(false);
  }, []);


  if (isLoading) return <LoadingSpinner text={t('loading')} className="mt-24" size="xl"/>;
  if (error && !editableQuiz && !isSaving) return <Card className="text-red-400 p-12 text-center shadow-xl !border-red-500/70 !bg-red-800/40 text-lg font-semibold !rounded-2xl animate-fadeInUp" useGlassEffect>{error}</Card>;
  if (!editableQuiz) return <Card className="text-slate-400 p-12 text-center shadow-lg text-lg font-medium !rounded-2xl animate-fadeInUp" useGlassEffect>{t('reviewErrorNoQuizData')}</Card>;

  const isEditingExisting = !!existingQuizIdFromParams;
  const currentQuizForExport: Quiz | null = editableQuiz ? { id: existingQuizIdFromParams || 'temp-id', createdAt: new Date().toISOString(), ...editableQuiz } : null;

  return (
    <div className="pb-16">
      <div
        className={`sticky-review-actions bg-slate-800 shadow-xl py-4 -mx-4 sm:-mx-6 lg:-mx-8 rounded-b-2xl border-b border-slate-700 animate-fadeInUp`}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-50 leading-tight truncate tracking-tight flex items-center" title={editableQuiz.title}>
                     {isEditingExisting ? t('reviewEditQuizTitle') : t('reviewFinalizeQuizTitle')}
                </h1>
                <div className="flex flex-wrap justify-center sm:justify-end items-center gap-2.5">
                    {!isEditingExisting && (<Button variant="outline" size="sm" onClick={() => navigate('/create')} leftIcon={<ArrowUturnLeftIcon className="w-4 h-4"/>} className="py-2.5 px-4 rounded-lg"> {t('reviewDiscardRegenerateShort')} </Button>)}
                    <Button variant="secondary" size="sm" onClick={() => navigate('/dashboard')} leftIcon={<HomeIcon className="w-4 h-4"/>} className="py-2.5 px-4 rounded-lg"> {isEditingExisting ? t('cancel') : t('reviewDiscardToDashboardShort')} </Button>
                    <Button variant="outline" size="sm" onClick={() => setIsAzotaExportModalOpen(true)} leftIcon={<ExportIcon className="w-4 h-4"/>} className="py-2.5 px-4 rounded-lg border-sky-400/70 text-sky-300 hover:bg-sky-400/15" disabled={!currentQuizForExport || currentQuizForExport.questions.length === 0}> {t('azotaExportButton')} </Button>
                    <Button variant="primary" size="sm" onClick={handleSaveQuiz} isLoading={isSaving} disabled={isSaving || !editableQuiz.questions.length} leftIcon={<SaveIcon className="w-4 h-4"/>} className="bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white py-2.5 px-4 rounded-lg"> {isSaving ? t('reviewSavingButton') : (isEditingExisting ? t('reviewSaveChangesButton') : t('reviewSaveButton'))} </Button>
                </div>
            </div>
            {error && <p role="alert" className={`text-xs text-red-300 mt-4 bg-red-500/20 p-3 rounded-lg text-center sm:text-left shadow animate-fadeIn`}>{error}</p>}
            {!editableQuiz.questions.length && <p role="alert" className={`text-xs text-yellow-400 mt-4 bg-yellow-500/20 p-3 rounded-lg text-center sm:text-left shadow animate-fadeIn`}>{t('reviewCannotSaveNoQuestions')}</p>}
        </div>
      </div>

      <div className="pt-6 sm:pt-8">
        <div ref={titleCardRef} className={`${isTitleCardVisible ? 'animate-fadeInUp' : 'opacity-0'}`}> 
          <Card useGlassEffect className="shadow-2xl !rounded-2xl">
            <p className="text-sm text-slate-300/90 mb-6">{isEditingExisting ? t('reviewEditQuizDesc') : t('reviewFinalizeQuizDesc')}</p>
            <Input label={<span className="text-base font-semibold text-slate-100">{t('reviewQuizTitleLabel')}</span>} value={editableQuiz.title} onChange={(e) => setEditableQuiz(prev => prev ? { ...prev, title: e.target.value } : null)} className="text-xl mb-3" placeholder={t('step2QuizTitlePlaceholder')} inputClassName="!text-xl !font-semibold !py-3.5 !rounded-xl" />
             {editableQuiz.config && (
                <details className="mt-5 text-xs text-slate-400">
                    <summary className="cursor-pointer hover:text-sky-300 flex items-center font-medium group transition-colors">
                        <InformationCircleIcon className="w-4 h-4 mr-2 text-slate-500 group-hover:text-sky-400 transition-colors"/>
                        View Generation Config
                    </summary>
                    <div className="mt-2.5 p-3.5 bg-slate-700/60 border border-slate-600/60 rounded-lg shadow-inner space-y-1.5">
                        <p><strong>Mode:</strong> {editableQuiz.config.difficulty === 'AI-Determined' ? "AI Optimized" : "Manual"}</p>
                        <p><strong>Questions:</strong> {editableQuiz.config.difficulty === 'AI-Determined' && editableQuiz.config.numQuestions === 0 ? "AI Choice" : editableQuiz.config.numQuestions}</p>
                        <p><strong>Difficulty:</strong> {editableQuiz.config.difficulty === 'AI-Determined' ? "AI Determined" : editableQuiz.config.difficulty}</p>
                        <p><strong>Language:</strong> {editableQuiz.config.language}</p>
                        <p><strong>Model:</strong> {editableQuiz.config.selectedModel}</p>
                        {editableQuiz.config.customUserPrompt && <p><strong>Custom Prompt:</strong> <MathText text={editableQuiz.config.customUserPrompt} /></p>}
                    </div>
                </details>
            )}
          </Card>
        </div>
        
        <div className="space-y-6 sm:space-y-8 mt-6 sm:mt-8">
          {editableQuiz.questions.map((q, idx) => {
            return <QuestionItem
                      key={q.id}
                      question={q}
                      index={idx}
                      handleFieldChange={handleFieldChange}
                      handleOptionChange={handleOptionChange}
                      handleAddOption={handleAddOption}
                      handleRemoveOption={handleRemoveOption}
                      handleDeleteQuestion={handleDeleteQuestion}
                      animationDelayFactor={idx}
                    />;
          })}
        </div>
      </div>

      <div className="mt-10 sm:mt-12 text-center">
        <Button variant="subtle" onClick={handleAddNewQuestion} leftIcon={<PlusCircleIcon className="w-5 h-5" />} className={`border-2 border-dashed border-slate-600 hover:border-sky-400/80 text-slate-300 hover:text-sky-300 py-3 px-6 rounded-xl shadow-lg hover:shadow-black/20`}>
           {t('reviewAddNewQuestion')}
        </Button>
      </div>
      
      {currentQuizForExport && isAzotaExportModalOpen && (
        <AzotaExportModal
          isOpen={isAzotaExportModalOpen}
          onClose={handleCloseAzotaExportModal}
          quiz={currentQuizForExport}
        />
      )}
    </div>
  );
};
QuizReviewPage.displayName = "QuizReviewPage";

export default QuizReviewPage;
