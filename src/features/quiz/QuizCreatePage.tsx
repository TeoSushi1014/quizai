

import React, { useState, useCallback, ReactNode, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion'; 
import { useAppContext, useTranslation } from '../../App';
import { QuizConfig } from '../../types'; 
import { Button, Card, Input, Textarea, Select, ProgressBar, Toggle, Dropzone, Modal, Tooltip } from '../../components/ui';
import MathText from '../../components/MathText';
import { extractTextFromPdf, convertImageToBase64, extractTextFromDocx } from '../../services/fileService';
import { extractTextFromImageWithGemini, generateQuizWithGemini } from '../../services/geminiService'; 
import { DocumentTextIcon, ChevronRightIcon, ChevronLeftIcon, InformationCircleIcon, KeyIcon, GEMINI_MODEL_ID, ChartBarIcon, CopyIcon } from '../../constants'; 
import { translations } from '../../i18n';
import { logger } from '../../services/logService';

type CreationStep = 1 | 2 | 3;
const MAX_UNAUTH_QUIZZES_PER_DAY = 5;
const UNAUTH_TIMESTAMPS_KEY = 'quizAICreationTimestamps_unauth';
const MAX_GENERATION_RETRIES = 2;

const easeIOS = [0.25, 0.1, 0.25, 1]; 

const SummaryItem: React.FC<{icon: ReactNode, label: string, value: ReactNode, iconClassName?: string}> = ({ icon, label, value, iconClassName = "text-[var(--color-primary-accent)]" }) => (
  <div className="flex items-start py-2.5">
      <span className={`mr-3.5 mt-0.5 flex-shrink-0 ${iconClassName}`}>{icon}</span>
      <div className="flex-grow">
          <strong className="text-[var(--color-text-primary)] font-medium block text-sm">{label}</strong>
          <span className="text-[var(--color-text-secondary)] text-sm leading-relaxed">{value}</span>
      </div>
  </div>
);
SummaryItem.displayName = "SummaryItem";

const findCommonPrefix = (strings: string[]): string => {
  if (strings.length === 0) return '';
  if (strings.length === 1) return strings[0].split('.').slice(0, -1).join('.') || strings[0];
  
  let prefix = '';
  const firstStringNamePart = strings[0].split('.').slice(0, -1).join('.') || strings[0];
  let maxPrefixLength = Math.min(...strings.map(s => (s.split('.').slice(0,-1).join('.') || s).length));
  maxPrefixLength = Math.min(maxPrefixLength, firstStringNamePart.length);
  
  for (let i = 0; i < maxPrefixLength; i++) {
    const char = firstStringNamePart[i];
    if (strings.every(str => (str.split('.').slice(0,-1).join('.') || str)[i] === char)) {
      prefix += char;
    } else {
      break;
    }
  }
  return prefix.replace(/[^a-zA-Z0-9\s_-]+$/, '').trim();
};


const QuizCreatePage: React.FC = () => {
  const { language, currentUser } = useAppContext(); 
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState<CreationStep>(1);
  
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [processedContents, setProcessedContents] = useState<{text: string, fileName: string}[]>([]);
  const [combinedContent, setCombinedContent] = useState<string | null>(null);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<{current: number, total: number}>({current: 0, total: 0});


  const [pastedText, setPastedText] = useState<string>('');
  const [processedContentText, setProcessedContentText] = useState<string | null>(null); 
  const [imageBase64, setImageBase64] = useState<{ base64Data: string; mimeType: string } | null>(null);
  const [initialImageExtractedText, setInitialImageExtractedText] = useState<string | null>(null); 
  
  const [quizTitleSuggestion, setQuizTitleSuggestion] = useState<string>("");
  
  const [isFormattedQuiz, setIsFormattedQuiz] = useState(false);
  const [customUserPrompt, setCustomUserPrompt] = useState<string>("");
  const [usePromptOnlyMode, setUsePromptOnlyMode] = useState(false);
  const [promptOnlyText, setPromptOnlyText] = useState<string>("");

  const initialAIMode = true;
  const [useAIMode, setUseAIMode] = useState(initialAIMode);
  const [userSelectedDifficulty, setUserSelectedDifficulty] = useState<QuizConfig['difficulty']>('Medium');
  const [userSelectedNumQuestions, setUserSelectedNumQuestions] = useState<number>(10);


  const [quizConfig, setQuizConfig] = useState<QuizConfig>({
    numQuestions: initialAIMode ? 0 : userSelectedNumQuestions,
    difficulty: initialAIMode ? 'AI-Determined' : userSelectedDifficulty,
    language: language === 'vi' ? 'Vietnamese' : 'English',
    selectedModel: GEMINI_MODEL_ID, 
  });
  

  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [processingError, setProcessingErrorState] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [generationStatusText, setGenerationStatusText] = useState<string>(''); 
  const [isFullTextModalOpen, setIsFullTextModalOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const setProcessingError = (message: string | null) => {
    setProcessingErrorState(message);
  };

  useEffect(() => {
    setQuizConfig(prev => ({
      ...prev,
      language: language === 'vi' ? 'Vietnamese' : 'English',
      difficulty: useAIMode ? 'AI-Determined' : (userSelectedDifficulty !== 'AI-Determined' ? userSelectedDifficulty : 'Medium'),
      numQuestions: useAIMode ? prev.numQuestions : (userSelectedNumQuestions > 0 ? userSelectedNumQuestions : 10),
      selectedModel: GEMINI_MODEL_ID
    }));
  }, [language, useAIMode, userSelectedDifficulty, userSelectedNumQuestions]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);
  
  useEffect(() => {
    if (processedContentText && typeof processedContentText === 'string') {
      import('../../services/geminiService').then(module => {
        const isFormatted = module.isFormattedQuiz(processedContentText);
        setIsFormattedQuiz(isFormatted);
      }).catch(error => {
        logger.error('Error checking for formatted quiz', 'QuizCreatePage', undefined, error as Error);
        setIsFormattedQuiz(false);
      });
    } else {
      setIsFormattedQuiz(false);
    }
  }, [processedContentText]);
  const isApiKeyMissingForGemini = () => false;

  const handleFileUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) {
      setUploadedFiles([]); setPastedText(''); setImageBase64(null); 
      setProcessedContents([]); setCombinedContent(null);
      setProcessedContentText(null); setInitialImageExtractedText(null);
      setQuizTitleSuggestion('');
      return;
    }
    setUploadedFiles(files); 
    setPastedText(''); setImageBase64(null);
    setIsProcessingFiles(true); setProcessingError(null); setProgress(0);
    setProcessingProgress({current: 0, total: files.length});
    setQuizTitleSuggestion(findCommonPrefix(files.map(f => f.name)) || t('step2MultipleFilesQuizTitle'));

    try {
      const tempProcessedContents: {text: string, fileName: string}[] = [];
      let allTextsCombined = "";
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProcessingProgress({current: i + 1, total: files.length});
        
        let textContentForFile: string | null = null; 
        let isImageFile = false;
        if (file.type === 'application/pdf') {
          textContentForFile = await extractTextFromPdf(file);
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
          textContentForFile = await extractTextFromDocx(file);
        } else if (file.type.startsWith('image/')) {
          isImageFile = true;
          const imgData = await convertImageToBase64(file);
          if (files.length === 1) setImageBase64(imgData); 
          
          if (isApiKeyMissingForGemini()) {
            textContentForFile = t('step1ErrorProcessingFile') + ` (${file.name} - API Key missing for text extraction)`;
          } else {
            const extractedImageText = await extractTextFromImageWithGemini(imgData);
            textContentForFile = extractedImageText || t('step1ErrorProcessingFile') + ` (${file.name} - AI could not extract text)`;
          }
          if (files.length === 1) setInitialImageExtractedText(textContentForFile); 
        } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
          textContentForFile = await file.text();
        } else {
          throw new Error(t('step1ErrorUnsupportedFile') + ` (${file.name})`);
        }
        
        if (textContentForFile) {
          tempProcessedContents.push({ text: textContentForFile, fileName: file.name });
          allTextsCombined += `=== [${file.name}] ===\n\n${textContentForFile}\n\n`;
        } else if (isImageFile && files.length > 1) { 
          allTextsCombined += `=== [${file.name}] ===\n\n[Image content - text extraction may have been skipped or failed]\n\n`;
        }
      }
      
      const trimmedContent = allTextsCombined.trim();
      setProcessedContents(tempProcessedContents);
      setCombinedContent(trimmedContent);
      setProcessedContentText(trimmedContent);
      import('../../services/geminiService').then(module => {
        const isFormatted = module.isFormattedQuiz(trimmedContent);
        setIsFormattedQuiz(isFormatted);
        if (isFormatted) {
          setProcessingError("✅ Quiz format detected! The system will preserve all questions and options exactly as provided.");
        }
      }).catch(() => setIsFormattedQuiz(false));
      
      setStep(2);
    } catch (err) {
      logger.error("Error processing files:", 'QuizCreatePageFileProcessing', undefined, err as Error);
      setProcessingError(err instanceof Error ? err.message : t('step1ErrorProcessingFile'));
    } finally { 
      setIsProcessingFiles(false); 
      setProcessingProgress({current: files.length, total: files.length});
    }
  }, [t, isApiKeyMissingForGemini]);


  const handlePasteText = useCallback(async () => {
    if (pastedText.trim()) {
      const trimmedPastedText = pastedText.trim();
      setUploadedFiles([]); setProcessedContents([]); setCombinedContent(null); setImageBase64(null); setInitialImageExtractedText(null);
      
      setProcessedContentText(trimmedPastedText);
      setQuizTitleSuggestion(t('step2PastedText') + " Quiz");
      import('../../services/geminiService').then(module => {
        const isFormatted = module.isFormattedQuiz(trimmedPastedText);
        setIsFormattedQuiz(isFormatted);
        if (isFormatted) {
          setProcessingError("✅ Quiz format detected! The system will preserve your quiz exactly as provided.");
        } else {
          setProcessingError(null);
        }
      }).catch(() => {
        setIsFormattedQuiz(false);
        setProcessingError(null);
      });
       
      setStep(2);
    } else { 
      setProcessingError(t('step1ErrorPasteText'));
    }
  }, [pastedText, t]);

  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'numQuestions') {
      const rawValue = e.target.value;
      const valueAsInt = parseInt(rawValue, 10);
      const finalValue = isNaN(valueAsInt) || valueAsInt < 0 ? 0 : valueAsInt;
      if (useAIMode) {
        setQuizConfig(prev => ({ ...prev, numQuestions: finalValue }));
      } else { 
        const validNum = finalValue <= 0 ? 1 : finalValue;
        setQuizConfig(prev => ({ ...prev, numQuestions: validNum }));
        setUserSelectedNumQuestions(validNum);
      }
    } else if (name === 'difficulty') {
      const newDifficulty = value as QuizConfig['difficulty'];
      setQuizConfig(prev => ({ ...prev, difficulty: newDifficulty, selectedModel: GEMINI_MODEL_ID }));
      if (!useAIMode && newDifficulty !== 'AI-Determined') {
        setUserSelectedDifficulty(newDifficulty);
      }
    } else {
      setQuizConfig(prev => ({ ...prev, [name]: value, selectedModel: GEMINI_MODEL_ID }));
    }
  };
  
  const handleAIModeToggle = useCallback((checked: boolean) => {
    setUseAIMode(checked);
    if (checked) { 
      if (quizConfig.difficulty !== 'AI-Determined') setUserSelectedDifficulty(quizConfig.difficulty);
      setUserSelectedNumQuestions(prevUserNum => quizConfig.numQuestions > 0 ? quizConfig.numQuestions : prevUserNum);
      setQuizConfig(prev => ({ ...prev, difficulty: 'AI-Determined', numQuestions: 0 }));
    } else { 
      setQuizConfig(prev => ({ ...prev, difficulty: userSelectedDifficulty === 'AI-Determined' ? 'Medium' : userSelectedDifficulty, numQuestions: userSelectedNumQuestions > 0 ? userSelectedNumQuestions : 10 }));
    }
  }, [quizConfig.difficulty, quizConfig.numQuestions, userSelectedDifficulty, userSelectedNumQuestions]);
  
  const handleGenerateQuiz = async () => {
    logger.info('Quiz generation initiated.', 'QuizCreatePageGenerate', { config: quizConfig });
    
    if (!currentUser) {
        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
        let timestamps: number[] = [];
        try {
            const storedTimestamps = localStorage.getItem(UNAUTH_TIMESTAMPS_KEY);
            if (storedTimestamps) timestamps = JSON.parse(storedTimestamps);
        } catch (e) {
            logger.error("Error reading unauth timestamps from localStorage", 'QuizCreateRateLimit', undefined, e as Error);
            timestamps = []; 
        }
        const recentTimestamps = timestamps.filter(ts => ts > oneDayAgo);
        if (recentTimestamps.length >= MAX_UNAUTH_QUIZZES_PER_DAY) {
            setProcessingError(t('rateLimitErrorUnauthenticated', { limit: MAX_UNAUTH_QUIZZES_PER_DAY }));
            setIsGeneratingQuiz(false); setProgress(0);
            return;
        }
    }
    
    let contentForAI: string | { base64Data: string; mimeType: string };
    if (usePromptOnlyMode && customUserPrompt && customUserPrompt.trim()) {
        contentForAI = "Generate quiz from user prompt.";
    } else if (uploadedFiles.length > 0) {
        if (combinedContent && combinedContent.trim()) {
            contentForAI = combinedContent;
        } else if (imageBase64 && uploadedFiles.length === 1 && uploadedFiles[0].type.startsWith('image/')) {
             setProcessingError(t('step1ErrorProcessingFile')); return;
        } else {
            setProcessingError(t('step1ErrorProcessingFile')); return;
        }
    } else if (pastedText && pastedText.trim()) {
        contentForAI = pastedText;
    } else {
        setProcessingError(t('step1ErrorProcessingFile')); return;
    }
    
    setIsGeneratingQuiz(true); setProcessingError(null); setProgress(0);
    setGenerationStatusText(t('step3AIIsThinking'));

    for (let attempt = 0; attempt <= MAX_GENERATION_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          setGenerationStatusText(t('step3AIIsRetrying', { currentAttempt: attempt, maxAttempts: MAX_GENERATION_RETRIES }));
          await new Promise(resolve => setTimeout(resolve, 1500 * attempt)); 
        }
        const finalConfig: QuizConfig = { ...quizConfig, customUserPrompt: customUserPrompt.trim() || undefined };
        setProgress(10 + (attempt * 5)); 
        const generatingQuizPromise = generateQuizWithGemini(contentForAI, finalConfig, quizTitleSuggestion);
        let progressInterval = setInterval(() => { 
          setProgress(oldProgress => { 
            if (oldProgress >= 85 - (attempt * 5)) { clearInterval(progressInterval); return oldProgress; } 
            return Math.min(oldProgress + 5, 85 - (attempt * 5)); 
          }); 
        }, 400); 
        const generatedQuizData = await generatingQuizPromise;
        clearInterval(progressInterval); setProgress(95); 
        if (!currentUser) {
            let timestamps: number[] = [];
            try {
                const storedTimestamps = localStorage.getItem(UNAUTH_TIMESTAMPS_KEY);
                if (storedTimestamps) timestamps = JSON.parse(storedTimestamps);
            } catch (e) { logger.error("Error reading unauth timestamps for update", 'QuizCreateRateLimit', undefined, e as Error); timestamps = []; }
            const now = Date.now(); const oneDayAgo = now - (24 * 60 * 60 * 1000);
            const recentTimestamps = timestamps.filter(ts => ts > oneDayAgo); recentTimestamps.push(now);
            try { localStorage.setItem(UNAUTH_TIMESTAMPS_KEY, JSON.stringify(recentTimestamps)); } 
            catch (e) { logger.error("Error writing unauth timestamps to localStorage", 'QuizCreateRateLimit', undefined, e as Error); }
        }
        logger.info('Quiz generated successfully, navigating to review.', 'QuizCreatePageGenerate', { title: generatedQuizData.title });
        navigate('/review', { state: { generatedQuizData, quizTitleSuggestion: quizTitleSuggestion || generatedQuizData.title, finalConfig } });
        setProgress(100); setIsGeneratingQuiz(false); setGenerationStatusText(''); return; 
      } catch (err: any) {
        logger.error(`Error generating quiz (Attempt ${attempt + 1}/${MAX_GENERATION_RETRIES + 1}):`, 'QuizCreatePageGenerate', { config: quizConfig }, err);
        if (err.message && err.message.includes("Gemini AI failed to generate quiz") && attempt < MAX_GENERATION_RETRIES) {
          if (attempt === MAX_GENERATION_RETRIES -1) setProgress(70); 
        } else {
          setProcessingError(err instanceof Error ? err.message : t('step3ErrorGenerate')); 
          setProgress(0); setIsGeneratingQuiz(false); setGenerationStatusText(''); return; 
        }
      }
    }
  };

  const handleCopyToClipboard = () => {
    if (processedContentText) { 
      navigator.clipboard.writeText(processedContentText)
        .then(() => { setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); })
        .catch(err => { logger.error('Failed to copy text to clipboard', 'QuizCreatePage', undefined, err); alert(t('azotaExportErrorCopy')); });
    }
  };
  
  const handleCloseFullTextModal = useCallback(() => setIsFullTextModalOpen(false), []);
  const generateIconUrl = "https://img.icons8.com/?size=256&id=eoxMN35Z6JKg&format=png";
  const getStepIndicator = (currentStep: number, targetStep: CreationStep, titleKey: keyof typeof translations.en, defaultIcon: ReactNode, _isLastStep: boolean = false) => {
    const isActive = currentStep === targetStep; const isCompleted = currentStep > targetStep; const inactiveTextColorCls = 'text-[var(--color-text-muted)]';
    let displayIconNode: ReactNode; const newCompletedIconUrl = "https://img.icons8.com/?size=256&id=VFaz7MkjAiu0&format=png"; const iconClassName = "w-5 h-5 sm:w-6 sm:h-6 transition-transform var(--duration-fast) var(--ease-ios)";
    if (isCompleted) displayIconNode = <img src={newCompletedIconUrl} alt={t('stepCompleted')} className={iconClassName} />;
    else if (isActive) {
        let activeIconSrc = "";
        if (targetStep === 1) activeIconSrc = "https://img.icons8.com/?size=256&id=hwKgsZN5Is2H&format=png";
        else if (targetStep === 2) activeIconSrc = "https://img.icons8.com/?size=256&id=WwHcZxa9PFUq&format=png";
        else if (targetStep === 3) activeIconSrc = generateIconUrl;
        if (activeIconSrc) displayIconNode = <img src={activeIconSrc} alt={t(titleKey)} className={`${iconClassName} scale-110`} />;
        else if (React.isValidElement(defaultIcon)) displayIconNode = React.cloneElement(defaultIcon as React.ReactElement<{ className?: string }>, { className: `${iconClassName} scale-110` });
        else displayIconNode = defaultIcon;
    } else { 
        if (React.isValidElement(defaultIcon)) displayIconNode = React.cloneElement(defaultIcon as React.ReactElement<{ className?: string }>, { className: iconClassName });
        else displayIconNode = defaultIcon;
    }
    return (
      <div className={`flex flex-col items-center transition-colors var(--duration-fast) var(--ease-ios) ${isActive ? 'text-[var(--color-primary-accent)]' : isCompleted ? 'text-green-400' : inactiveTextColorCls}`}>
        <div className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 mb-2.5 transition-all var(--duration-fast) var(--ease-ios) will-change-transform, border, background-color, box-shadow ${isActive ? 'border-[var(--color-primary-accent)] bg-[var(--color-primary-accent)]/20 text-[var(--color-primary-accent)] shadow-xl scale-105' : isCompleted ? 'border-green-400 bg-green-400/20 text-green-400 shadow-lg' : `border-[var(--color-border-default)] bg-[var(--color-bg-surface-2)]/60 ${inactiveTextColorCls}`} font-semibold text-base sm:text-lg`}> {displayIconNode} </div>
        <span className={`text-xs sm:text-sm font-semibold text-center transition-colors var(--duration-fast) var(--ease-ios) ${isActive ? 'text-[var(--color-text-primary)]' : isCompleted ? 'text-[var(--color-text-secondary)]' : inactiveTextColorCls}`}>{t(titleKey)}</span>
      </div>);};
  
  const renderStepContent = () => {
    switch (step) {
      case 1: return ( <Card className="max-w-xl mx-auto shadow-2xl !rounded-2xl" useGlassEffect> <div className="space-y-8"> 
        <Dropzone 
            onFileUpload={handleFileUpload} 
            acceptedFileTypes=".pdf,.txt,.docx,.jpg,.png,.jpeg" 
            maxFileSizeMB={10} 
            label={<p className="text-base font-semibold text-[var(--color-text-primary)] mb-2">{t('step1UploadOrDrag')}</p>} 
            icon={<img src="https://img.icons8.com/?size=256&id=hwKgsZN5Is2H&format=png" alt={t('upload')} className="w-12 h-12 sm:w-14 sm:h-14 mb-3.5 text-[var(--color-text-muted)] group-hover:text-[var(--color-primary-accent)] transition-all var(--duration-fast) var(--ease-ios) group-hover:scale-105" />} 
            isLoading={isProcessingFiles} 
            currentFiles={uploadedFiles.length > 0 ? uploadedFiles : null}
            multipleFiles={true}
        /> 
        {isProcessingFiles && (
            <div className="mt-4 animate-fadeIn">
                <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-[var(--color-text-secondary)]">
                    {t('step1ProcessingProgress', { current: processingProgress.current, total: processingProgress.total})}
                </span>
                </div>
                <ProgressBar progress={(processingProgress.current / Math.max(1, processingProgress.total)) * 100} showPercentage={false} />
            </div>
        )}
        <div className="relative flex py-1 items-center"> <div className="flex-grow border-t border-[var(--color-border-default)]"></div> <span className="flex-shrink mx-4 text-[var(--color-text-muted)] text-xs font-medium uppercase tracking-wider">{t('step1Or')}</span> <div className="flex-grow border-t border-[var(--color-border-default)]"></div> </div>
        
        <Textarea 
          label={<p className="text-base font-semibold text-[var(--color-text-primary)]">AI Prompt</p>} 
          value={promptOnlyText} 
          onChange={(e) => setPromptOnlyText(e.target.value)} 
          placeholder={t('step1AIPromptPlaceholder')} 
          rows={6} 
          className="min-h-[150px] text-sm paste-text-area" 
        />
        <Button 
          onClick={() => {
            if (promptOnlyText.trim()) {
              setUsePromptOnlyMode(true);
              setCustomUserPrompt(promptOnlyText);
              setPastedText('');
              setUploadedFiles([]);
              setProcessedContents([]);
              setCombinedContent(null);
              setImageBase64(null);
              setInitialImageExtractedText(null);
              setProcessedContentText(`AI Prompt: ${promptOnlyText.trim()}`);
              setQuizTitleSuggestion("AI Generated Quiz");
              setStep(2);
            } else {
              setProcessingError("Please enter an AI prompt");
            }
          }}
          disabled={!promptOnlyText.trim() || isProcessingFiles} 
          fullWidth 
          size="lg" 
          variant="primary" 
          className="py-3 shadow-lg bg-gradient-to-r from-green-500 via-teal-500 to-sky-500 hover:from-green-600 hover:via-teal-600 hover:to-sky-600 text-white"
        > 
          Generate Quiz from Prompt
        </Button>
        
        <div className="relative flex py-1 items-center"> <div className="flex-grow border-t border-[var(--color-border-default)]"></div> <span className="flex-shrink mx-4 text-[var(--color-text-muted)] text-xs font-medium uppercase tracking-wider">{t('step1Or')}</span> <div className="flex-grow border-t border-[var(--color-border-default)]"></div> </div> 
        <Textarea label={<p className="text-base font-semibold text-[var(--color-text-primary)]">{t('step1PasteTextLabel')}</p>} value={pastedText} onChange={(e) => setPastedText(e.target.value)} placeholder={t('step1PasteTextPlaceholder')} rows={6} className="min-h-[150px] text-sm paste-text-area" /> 
        <Button onClick={handlePasteText} disabled={!pastedText.trim() || isProcessingFiles} fullWidth size="lg" variant="secondary" className="py-3 shadow-lg"> {t('step1UsePastedText')} </Button>
        {processingError && !isProcessingFiles && (
          <div role="alert" className={`p-3.5 ${processingError.startsWith('✅') ? 'bg-green-500/20 border-green-500/50 text-green-300' : 'bg-red-500/20 border-red-500/50 text-red-300'} border rounded-lg text-sm text-center shadow-md animate-fadeIn`}>
            {processingError}
          </div>
        )} 
        </div> </Card> );
      case 2:
        const modelDisplayLabel = (<div className="flex items-center text-sm font-semibold text-[var(--color-text-primary)]"> <img src="https://www.pngall.com/wp-content/uploads/16/Google-Gemini-Logo-Transparent.png" alt={t('step2AIModelLabel')} className="w-5 h-5 mr-2.5" /> {t('step2AIModelLabel')} {isApiKeyMissingForGemini() && (<Tooltip content={t('apiKeyMissingTooltip')} placement="top"> <KeyIcon className="w-4 h-4 text-yellow-400 ml-2.5 cursor-help"/> </Tooltip>)} </div>);
        const customPromptLabel = (<div className="flex items-center text-sm font-medium text-[var(--color-text-secondary)]">{t('step2CustomPromptLabel')}<Tooltip content={<div className="max-w-xs text-left text-xs">{t('step2CustomPromptPlaceholder')}</div>} placement="top"><InformationCircleIcon className="w-4 h-4 text-[var(--color-text-muted)] ml-2.5 cursor-help" /></Tooltip></div>);
        const manualDifficultyOptions = [{ value: 'Easy', label: t('step2DifficultyEasy') }, { value: 'Medium', label: t('step2DifficultyMedium') }, { value: 'Hard', label: t('step2DifficultyHard') }];
        const allDifficultyOptions = [...manualDifficultyOptions, { value: 'AI-Determined', label: t('step2DifficultyAIDetermined') } ];
        const numQuestionsLabelText = useAIMode ? t('step2NumQuestionsLabelAIMode') : t('step2NumQuestionsLabel');
        
        let sourceDisplayContent: ReactNode;
        if (usePromptOnlyMode && processedContentText?.startsWith('AI Prompt:')) {
            sourceDisplayContent = (
              <div>
                <span className="text-blue-400 font-medium">AI Prompt:</span> {promptOnlyText}
              </div>
            );
        } else if (uploadedFiles.length > 0) {
            if (uploadedFiles.length === 1) {
                sourceDisplayContent = (
                  <div>
                    {imageBase64 ? t('step2Image', {fileName: uploadedFiles[0].name}) : t('step2File', {fileName: uploadedFiles[0].name})}
                    {isFormattedQuiz && <div className="mt-2 text-xs font-medium text-green-500">✅ Quiz format detected! Questions will be preserved exactly as provided.</div>}
                  </div>
                );
            } else {
                sourceDisplayContent = (
                  <>
                    {t('step2MultipleFiles', { count: uploadedFiles.length })}:
                    <ul className="list-none text-xs opacity-80 max-h-20 overflow-y-auto thin-scrollbar-horizontal">
                        {uploadedFiles.slice(0, 5).map((file,idx) => <li key={idx} className="truncate" title={file.name}>{file.name}</li>)}
                        {uploadedFiles.length > 5 && <li>{t('step2AndMoreFiles', {count: uploadedFiles.length - 5})}</li>}
                    </ul>
                    {isFormattedQuiz && <div className="mt-2 text-xs font-medium text-green-500">✅ Quiz format detected! Questions will be preserved exactly as provided.</div>}
                  </>  
                );
            }
        } else if (pastedText) {
            sourceDisplayContent = (
              <div>
                {t('step2PastedText')}
                {isFormattedQuiz && <div className="mt-2 text-xs font-medium text-green-500">✅ Quiz format detected! Questions will be preserved exactly as provided.</div>}
              </div>
            );
        } else {
            sourceDisplayContent = "N/A";
        }

        return ( <Card className="max-w-2xl mx-auto shadow-2xl !rounded-2xl" useGlassEffect> <div className="space-y-6 sm:space-y-8"> 
          <Card className={`!bg-[var(--color-bg-surface-2)]/70 !border-[var(--color-border-default)] p-4 sm:p-5 !rounded-xl shadow-lg`} useGlassEffect={false}> 
            <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2.5">{t('step2SourceContent')}</h3> 
            <div className="flex items-center text-sm text-[var(--color-text-body)] overflow-x-auto overflow-y-hidden whitespace-nowrap cursor-default thin-scrollbar-horizontal py-0.5"> 
              <DocumentTextIcon className="w-5 h-5 mr-3 text-[var(--color-primary-accent)] flex-shrink-0" strokeWidth={1.5}/> 
              <span className="pr-1">{sourceDisplayContent}</span> 
            </div> 
            {processedContentText && ( <Button variant="secondary" onClick={() => setIsFullTextModalOpen(true)} className="text-xs !font-semibold mt-3.5 py-2 px-4 rounded-lg shadow-md" leftIcon={<DocumentTextIcon className="w-4 h-4" strokeWidth={2}/>}> {t('step2ViewFullText')} </Button> )} 
          </Card> 
          <Input label={<p className="text-base font-semibold text-[var(--color-text-primary)]">{t('step2QuizTitleLabel')}</p>} name="quizTitle" value={quizTitleSuggestion} onChange={(e) => setQuizTitleSuggestion(e.target.value)} placeholder={t('step2QuizTitlePlaceholder')} inputClassName="text-lg py-3" /> 
          <Card className={`!bg-[var(--color-bg-surface-2)]/70 !border-[var(--color-border-default)] p-4 sm:p-5 !rounded-xl shadow-lg`} useGlassEffect={false}> {modelDisplayLabel} <p className="text-sm text-[var(--color-text-secondary)] mt-1.5">Google Gemini <span className="font-medium">{isApiKeyMissingForGemini() ? <span className="text-yellow-400">({t('apiKeyMissingShort')})</span> : <span className="text-green-400">({t('default')})</span>}</span></p> </Card> 
          <Card className={`p-4 sm:p-5 !border-[var(--color-border-default)] !bg-[var(--color-bg-surface-1)]/70 shadow-lg space-y-5 !rounded-xl`} useGlassEffect={false}> 
            <Toggle label={<p className="text-base font-semibold text-[var(--color-text-primary)]">{t('step2AIModeLabel')}</p>} checked={useAIMode} onChange={handleAIModeToggle} /> 
            <Input label={numQuestionsLabelText} type="number" name="numQuestions" value={quizConfig.numQuestions} onChange={handleConfigChange} min={useAIMode ? "0" : "1"} max="50" containerClassName={useAIMode ? 'mt-4' : ''} placeholder={useAIMode && quizConfig.numQuestions === 0 ? t('step2NumQuestionsAIPlaceholder') : undefined} /> 
            <Select label={t('step2DifficultyLabel')} name="difficulty" value={quizConfig.difficulty} onChange={handleConfigChange} options={useAIMode ? allDifficultyOptions : manualDifficultyOptions} disabled={useAIMode} /> 
            <Select label={t('step2LanguageLabel')} name="language" value={quizConfig.language} onChange={handleConfigChange} options={[{ value: 'English', label: t('step2LanguageEnglish') }, { value: 'Vietnamese', label: t('step2LanguageVietnamese') }]} /> 
          </Card> 
          <Textarea label={customPromptLabel} name="customUserPrompt" value={customUserPrompt} onChange={(e) => setCustomUserPrompt(e.target.value)} placeholder={t('step2CustomPromptPlaceholder').substring(0,60) + "..."} rows={4} className="min-h-[90px] text-sm" /> 
          {processingError && (<div role="alert" className={`p-3.5 bg-red-500/20 border border-red-500/50 rounded-lg text-sm text-red-300 text-center shadow-md animate-fadeIn`}>{processingError}</div>)} 
          <div className="flex flex-col sm:flex-row justify-between items-center pt-5 gap-4"> 
            <Button variant="outline" onClick={() => { setStep(1); setProcessedContentText(null); setCombinedContent(null); setProcessedContents([]); setImageBase64(null); setUploadedFiles([]); setPastedText(''); setProcessingError(null); setInitialImageExtractedText(null); }} leftIcon={<ChevronLeftIcon className="w-4 h-4"/>} size="lg" className="w-full sm:w-auto py-3"> {t('back')} </Button> 
            <Button onClick={() => { setStep(3); setProcessingError(null); }} disabled={false} rightIcon={<ChevronRightIcon className="w-4 h-4"/>} variant="primary" size="lg" className="w-full sm:w-auto py-3"> {t('step2NextButton')} </Button> 
          </div> 
        </div> 
        {isFullTextModalOpen && (<Modal isOpen={isFullTextModalOpen} onClose={handleCloseFullTextModal} title={t('fullTextModalTitle')} size="3xl" footerContent={ <div className="flex flex-col sm:flex-row sm:justify-between items-center w-full gap-3 sm:gap-0"> <Button variant="outline" onClick={handleCopyToClipboard} leftIcon={<CopyIcon className="w-4 h-4"/>} size="md" className="w-full sm:w-auto"> {copySuccess ? t('azotaExportCopied') : t('azotaExportCopy')} </Button> <Button onClick={handleCloseFullTextModal} variant="secondary" size="md" className="w-full sm:w-auto"> {t('close')} </Button> </div> }> 
          <Textarea value={processedContentText || ''} readOnly className="!bg-[var(--color-bg-surface-2)] !border-[var(--color-border-default)] text-[var(--color-text-primary)] whitespace-pre-wrap text-sm min-h-[60vh] max-h-[65vh] shadow-inner focus:!border-[var(--color-primary-accent)]/70 focus:!ring-[var(--color-primary-accent)]/40" rows={20} aria-label={t('fullTextModalTitle')} /> 
        </Modal> )} </Card> );
      case 3:
        const iconSize = "w-5 h-5"; 
        let currentButtonText = t('step3GenerateButton');
        if (isGeneratingQuiz) {
          const attemptMatch = generationStatusText.match(/Attempt (\d+)\/(\d+)/) || 
                               generationStatusText.match(/Lần (\d+)\/(\d+)/);
          if (attemptMatch && attemptMatch.length === 3) {
            const currentAttemptNum = parseInt(attemptMatch[1], 10);
            const maxAttemptsNum = parseInt(attemptMatch[2], 10);
            currentButtonText = t('step3GeneratingRetryButton', { currentAttempt: currentAttemptNum, maxAttempts: maxAttemptsNum });
          } else {
            currentButtonText = t('step3GeneratingButton');
          }
        }
        let sourceSummary: ReactNode;
        if (usePromptOnlyMode) {
            sourceSummary = "AI Prompt";
        } else if (uploadedFiles.length > 0) {
            if (uploadedFiles.length === 1) {
                sourceSummary = imageBase64 ? t('step2Image', {fileName: uploadedFiles[0].name}) : t('step2File', {fileName: uploadedFiles[0].name});
            } else {
                sourceSummary = t('step2MultipleFiles', { count: uploadedFiles.length });
            }
        } else if (pastedText) {
            sourceSummary = t('step2PastedText');
        } else {
            sourceSummary = "N/A";
        }

        return ( <Card className="max-w-xl mx-auto shadow-2xl !rounded-2xl" useGlassEffect> 
          <div className={`!bg-[var(--color-bg-surface-2)]/70 p-6 sm:p-8 !rounded-xl mb-8 border border-[var(--color-border-default)] shadow-xl`}> 
            <h3 className="text-2xl sm:text-3xl font-semibold text-[var(--color-text-primary)] mb-6 text-center">{t('step3SummaryTitle')}</h3> 
            <div className="space-y-1 divide-y divide-[var(--color-border-default)]/50"> 
              <SummaryItem icon={<img src="https://www.pngall.com/wp-content/uploads/16/Google-Gemini-Logo-Transparent.png" alt={t('step2AIModelLabel')} className={iconSize} />} label={t('step3AIModelSelected', {modelName: ""})} value="Google Gemini" /> 
              <SummaryItem icon={<DocumentTextIcon className={iconSize} />} label={t('step3TitleSuggestion', {title: ""})} value={<MathText text={quizTitleSuggestion || t('step3TitleAISuggested')} />} /> 
              <SummaryItem icon={<img src="https://img.icons8.com/?size=256&id=hwKgsZN5Is2H&format=png" alt={t('upload')} className={iconSize} />} label={t('step3ContentSource', {source: ""})} value={sourceSummary} /> 
              <SummaryItem icon={<img src="https://img.icons8.com/?size=256&id=WwHcZxa9PFUq&format=png" alt={t('settings')} className={iconSize} />} label={t('step3Mode', {mode: ""})} value={useAIMode ? t('step3ModeAIOptimized') : "Manual"} /> 
              <SummaryItem icon={<img src="https://img.icons8.com/?size=256&id=PPnPJOpQpJ2J&format=png" alt={t('step3NumQuestions', {count:""})} className={iconSize} />} label={t('step3NumQuestions', {count:""})} value={useAIMode && quizConfig.numQuestions === 0 ? t('step2NumQuestionsAIPlaceholder') : quizConfig.numQuestions} /> 
              <SummaryItem icon={<ChartBarIcon className={iconSize} />} label={t('step3Difficulty', {level:""})} value={quizConfig.difficulty === 'AI-Determined' ? t('step2DifficultyAIDetermined') : t(`step2Difficulty${quizConfig.difficulty}` as keyof typeof translations.en)} /> 
              <SummaryItem icon={<img src="https://img.icons8.com/?size=48&id=fs8AdHsHlO36&format=png" alt="Language" className={iconSize} />} label={t('step3Language', {lang:""})} value={quizConfig.language === "English" ? t('step2LanguageEnglish') : t('step2LanguageVietnamese')} /> 
              <div className="pt-2.5"> 
                <SummaryItem icon={<InformationCircleIcon className={iconSize} />} label={customUserPrompt.trim() ? t('step3CustomPromptProvidedLabel') : t('step3CustomPromptNone')} value={customUserPrompt.trim() ? <blockquote className="text-xs text-[var(--color-text-body)]/90 italic whitespace-pre-wrap max-h-24 overflow-y-auto bg-[var(--color-bg-surface-1)]/40 p-2 rounded-md mt-1 border-l-2 border-[var(--color-border-default)]/70"><MathText text={customUserPrompt.trim()} /></blockquote> : ""} /> 
              </div> 
            </div> 
          </div> 
          {/* API keys are managed through Supabase, no error messages needed */}
          <Button onClick={handleGenerateQuiz} isLoading={isGeneratingQuiz} disabled={isGeneratingQuiz} fullWidth size="lg" variant="primary" leftIcon={<img src={generateIconUrl} alt={t('step3GenerateButton')} className="w-5 h-5" />} className="bg-gradient-to-r from-green-500 via-teal-500 to-sky-500 hover:from-green-600 hover:via-teal-600 hover:to-sky-600 text-white dark:text-white shadow-xl hover:shadow-green-500/40 py-3.5 rounded-xl"> {currentButtonText} </Button> 
          {isGeneratingQuiz && <ProgressBar progress={progress} label={generationStatusText || t('step3AIIsThinking')} className="mt-6 animate-fadeIn" />} 
          {processingError && !isGeneratingQuiz && (<div role="alert" className={`mt-5 p-3.5 bg-red-500/20 border border-red-500/50 rounded-lg text-sm text-red-300 text-center shadow-md animate-fadeIn`}>{processingError}</div>)} 
          <div className="mt-8 text-center"> <Button variant="outline" onClick={() => {setStep(2); setProcessingError(null); setGenerationStatusText('');}} leftIcon={<ChevronLeftIcon className="w-4 h-4"/>} size="lg" className="w-full sm:w-auto py-3"> {t('step3BackButtonCfg')} </Button> </div> 
        </Card> );
    }
  };
  return ( <div className="py-6 sm:py-8"> <motion.div className="relative mb-10 sm:mb-12" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: easeIOS }}> <div className="absolute inset-0 flex items-center" aria-hidden="true"> <div className={`w-full border-t-2 border-[var(--color-border-default)]/60 border-dashed`} /> </div> <div className="relative flex justify-center"> <span className={`px-5 sm:px-6 bg-[var(--color-bg-body)] text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] tracking-tight`}> {t('createQuiz')} </span> </div> </motion.div> <motion.div className={`mb-8 sm:mb-10 text-center px-4`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35, ease: easeIOS, delay: 0.1 }}> <p className="text-xs text-[var(--color-text-muted)]"> {t('rateLimitInfoUnauthenticated', { limit: MAX_UNAUTH_QUIZZES_PER_DAY })} {t('rateLimitInfoAuthenticated')} </p> </motion.div> <motion.div className={`max-w-lg mx-auto mb-12 sm:mb-16 flex justify-around items-start p-4 sm:p-5 bg-[var(--color-bg-surface-1)]/70 rounded-2xl shadow-xl border border-[var(--color-border-default)] glass-effect`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: easeIOS, delay: 0.2 }}> {getStepIndicator(step, 1, 'step1Title', <img src="https://img.icons8.com/?size=256&id=hwKgsZN5Is2H&format=png" alt={t('step1Title')} />)} <div className={`flex-grow h-1.5 bg-[var(--color-bg-surface-3)] rounded-full mx-3 sm:mx-5 mt-5 sm:mt-[1.375rem]`}><div className="h-1.5 bg-[var(--color-primary-accent)] rounded-full transition-width var(--duration-normal) var(--ease-ios)" style={{width: step === 1 ? '0%' : step === 2 ? '50%' : '100%'}}></div> </div> {getStepIndicator(step, 2, 'step2Title', <img src="https://img.icons8.com/?size=256&id=WwHcZxa9PFUq&format=png" alt={t('step2Title')} />)} <div className={`flex-grow h-1.5 bg-[var(--color-bg-surface-3)] rounded-full mx-3 sm:mx-5 mt-5 sm:mt-[1.375rem]`}><div className="h-1.5 bg-[var(--color-primary-accent)] rounded-full transition-width var(--duration-normal) var(--ease-ios)" style={{width: step <= 2 ? '0%' : '100%'}}></div> </div> {getStepIndicator(step, 3, 'step3Title', <img src={generateIconUrl} alt={t('step3Title')} className="w-5 h-5 sm:w-6 sm:h-6" />, true)} </motion.div> <AnimatePresence mode="wait"> <motion.div key={step} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4, ease: easeIOS }}> {renderStepContent()} </motion.div> </AnimatePresence> </div> );
};
QuizCreatePage.displayName = "QuizCreatePage";
export default QuizCreatePage;