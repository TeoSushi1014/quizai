




import React, { useState, useCallback, ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion'; 
import { useAppContext, useTranslation } from '../../App';
import { QuizConfig, AIModelType, Quiz } from '../../types'; 
import { Button, Card, Input, Textarea, Select, LoadingSpinner, ProgressBar, Toggle, Dropzone, Modal, Tooltip } from '../../components/ui';
import MathText from '../../components/MathText';
import { generateQuizWithSelectedModel } from '../../services/aiQuizService';
import { extractTextFromPdf, convertImageToBase64, extractTextFromDocx } from '../../services/fileService';
import { extractTextFromImageWithGemini } from '../../services/geminiService'; 
import { DocumentTextIcon, ChevronRightIcon, ChevronLeftIcon, InformationCircleIcon, KeyIcon, GEMINI_MODEL_ID, LightbulbIcon, ChartBarIcon, CopyIcon } from '../../constants'; 
import { translations } from '../../i18n';

type CreationStep = 1 | 2 | 3;
const MAX_UNAUTH_QUIZZES_PER_DAY = 5;
const UNAUTH_TIMESTAMPS_KEY = 'quizAICreationTimestamps_unauth';
const MAX_GENERATION_RETRIES = 2;

const easeIOS = [0.25, 0.1, 0.25, 1]; 

const SummaryItem: React.FC<{icon: ReactNode, label: string, value: ReactNode, iconClassName?: string}> = ({ icon, label, value, iconClassName = "text-sky-300" }) => (
  <div className="flex items-start py-2.5">
      <span className={`mr-3.5 mt-0.5 flex-shrink-0 ${iconClassName}`}>{icon}</span>
      <div className="flex-grow">
          <strong className="text-slate-100 font-medium block text-sm">{label}</strong>
          <span className="text-slate-300 text-sm leading-relaxed">{value}</span>
      </div>
  </div>
);
SummaryItem.displayName = "SummaryItem";

const QuizCreatePage: React.FC = () => {
  const { addQuiz, language, isGeminiKeyAvailable, currentUser } = useAppContext(); 
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState<CreationStep>(1);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState<string>('');
  const [processedContentText, setProcessedContentText] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<{ base64Data: string; mimeType: string } | null>(null);
  const [initialImageExtractedText, setInitialImageExtractedText] = useState<string | null>(null); 
  
  const [quizTitleSuggestion, setQuizTitleSuggestion] = useState<string>("");
  const [customUserPrompt, setCustomUserPrompt] = useState<string>("");

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
  

  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [generationStatusText, setGenerationStatusText] = useState<string>(''); 
  const [isFullTextModalOpen, setIsFullTextModalOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    setQuizConfig(prev => ({
      ...prev,
      language: language === 'vi' ? 'Vietnamese' : 'English',
      difficulty: useAIMode ? 'AI-Determined' : (userSelectedDifficulty !== 'AI-Determined' ? userSelectedDifficulty : 'Medium'),
      numQuestions: useAIMode ? prev.numQuestions : (userSelectedNumQuestions > 0 ? userSelectedNumQuestions : 10),
      selectedModel: GEMINI_MODEL_ID
    }));
  }, [language, useAIMode, userSelectedDifficulty, userSelectedNumQuestions]);


  const isApiKeyMissingForGemini = () => !isGeminiKeyAvailable;

  const handleFileUpload = async (file: File) => {
    setUploadedFile(file); setPastedText(''); setImageBase64(null); setProcessedContentText(null); setInitialImageExtractedText(null);
    setIsProcessingFile(true); setProcessingError(null); setProgress(0);

    try {
      setQuizTitleSuggestion(file.name.split('.').slice(0, -1).join('.') || t('step2QuizTitlePlaceholder'));
      setProgress(10); 
      await new Promise(resolve => setTimeout(resolve, 200)); 
      
      let textContentForDisplay: string | null = null; 

      if (file.type === 'application/pdf') {
        setProgress(30);
        textContentForDisplay = await extractTextFromPdf(file);
        setProgress(70); 
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
        setProgress(30);
        textContentForDisplay = await extractTextFromDocx(file);
        setProgress(70);
      } else if (file.type.startsWith('image/')) {
        setProgress(30);
        const imgData = await convertImageToBase64(file);
        setImageBase64(imgData);
        setProgress(50); 
        if (isApiKeyMissingForGemini()) {
          console.warn("API key for Gemini is missing. Skipping text extraction from image for display.");
          textContentForDisplay = t('step1ErrorProcessingFile') + " (API Key missing for text extraction)";
        } else {
          const extractedImageText = await extractTextFromImageWithGemini(imgData);
           textContentForDisplay = extractedImageText || t('step1ErrorProcessingFile') + " (AI could not extract text)";
        }
        setInitialImageExtractedText(textContentForDisplay); 
        setProgress(70); 
      } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        setProgress(30);
        textContentForDisplay = await file.text();
        setProgress(70);
      } else {
        throw new Error(t('step1ErrorUnsupportedFile'));
      }
      
      setProcessedContentText(textContentForDisplay); 
      await new Promise(resolve => setTimeout(resolve, 300)); 
      setProgress(100);
      setStep(2);
    } catch (err) {
      console.error("Error processing file:", err);
      setProcessingError(err instanceof Error ? err.message : t('step1ErrorProcessingFile')); setProgress(0);
    } finally { setIsProcessingFile(false); }
  };

  const handlePasteText = () => {
    if (pastedText.trim()) {
      setProcessedContentText(pastedText.trim()); setUploadedFile(null); setImageBase64(null); setInitialImageExtractedText(null);
      setQuizTitleSuggestion(t('step2PastedText') + " Quiz"); setStep(2); setProcessingError(null);
    } else { setProcessingError(t('step1ErrorPasteText')); }
  };

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
      setQuizConfig(prev => ({
        ...prev,
        [name]: value, 
        selectedModel: GEMINI_MODEL_ID
      }));
    }
  };
  
  const handleAIModeToggle = (checked: boolean) => {
    setUseAIMode(checked);
    if (checked) { 
      if (quizConfig.difficulty !== 'AI-Determined') {
        setUserSelectedDifficulty(quizConfig.difficulty);
      }
      setUserSelectedNumQuestions(prevUserNum => quizConfig.numQuestions > 0 ? quizConfig.numQuestions : prevUserNum);
      setQuizConfig(prev => ({ ...prev, difficulty: 'AI-Determined', numQuestions: 0 }));
    } else { 
      setQuizConfig(prev => ({ 
        ...prev, 
        difficulty: userSelectedDifficulty === 'AI-Determined' ? 'Medium' : userSelectedDifficulty,
        numQuestions: userSelectedNumQuestions > 0 ? userSelectedNumQuestions : 10
      }));
    }
  };
  

  const handleGenerateQuiz = async () => {
    if (isApiKeyMissingForGemini()) { 
      setProcessingError(t('step3ErrorAPIKeyMissingForModel', {modelName: "Google Gemini"})); 
      return; 
    }

    if (!currentUser) {
        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
        let timestamps: number[] = [];
        try {
            const storedTimestamps = localStorage.getItem(UNAUTH_TIMESTAMPS_KEY);
            if (storedTimestamps) {
                timestamps = JSON.parse(storedTimestamps);
            }
        } catch (e) {
            console.error("Error reading unauth timestamps from localStorage", e);
            timestamps = []; 
        }

        const recentTimestamps = timestamps.filter(ts => ts > oneDayAgo);

        if (recentTimestamps.length >= MAX_UNAUTH_QUIZZES_PER_DAY) {
            setProcessingError(t('rateLimitErrorUnauthenticated', { limit: MAX_UNAUTH_QUIZZES_PER_DAY }));
            setIsGeneratingQuiz(false); 
            setProgress(0);
            return;
        }
    }
    
    let contentForAI: string | { base64Data: string; mimeType: string };

    if (imageBase64) { 
        const wasImageTextEditedAndValid = processedContentText && 
                                           processedContentText.trim() && 
                                           initialImageExtractedText && 
                                           processedContentText.trim() !== initialImageExtractedText.trim();
        
        if (wasImageTextEditedAndValid) {
            contentForAI = processedContentText; 
        } else {
            contentForAI = imageBase64;
        }
    } else if (processedContentText && processedContentText.trim()) { 
        contentForAI = processedContentText;
    } else if (imageBase64 && (!processedContentText || !processedContentText.trim())) { 
        contentForAI = imageBase64;
    }
    else { 
        setProcessingError(t('step1ErrorProcessingFile')); 
        return;
    }

    setIsGeneratingQuiz(true); 
    setProcessingError(null); 
    setProgress(0);
    setGenerationStatusText(t('step3AIIsThinking'));

    for (let attempt = 0; attempt <= MAX_GENERATION_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          setGenerationStatusText(t('step3AIIsRetrying', { currentAttempt: attempt, maxAttempts: MAX_GENERATION_RETRIES }));
          await new Promise(resolve => setTimeout(resolve, 1500 * attempt)); 
        }
        
        const finalConfig: QuizConfig = { 
          ...quizConfig,
          customUserPrompt: customUserPrompt.trim() || undefined, 
          selectedModel: GEMINI_MODEL_ID 
        };
        
        setProgress(10 + (attempt * 5)); 
        const generatingQuizPromise = generateQuizWithSelectedModel(contentForAI, finalConfig, quizTitleSuggestion);
        
        let progressInterval = setInterval(() => { 
          setProgress(oldProgress => { 
            if (oldProgress >= 85 - (attempt * 5)) { 
              clearInterval(progressInterval); return oldProgress; 
            } 
            return Math.min(oldProgress + 5, 85 - (attempt * 5)); 
          }); 
        }, 400); 

        const generatedQuizData = await generatingQuizPromise;
        clearInterval(progressInterval); 
        setProgress(95); 

        if (!currentUser) {
            let timestamps: number[] = [];
            try {
                const storedTimestamps = localStorage.getItem(UNAUTH_TIMESTAMPS_KEY);
                if (storedTimestamps) {
                    timestamps = JSON.parse(storedTimestamps);
                }
            } catch (e) {
                console.error("Error reading unauth timestamps for update", e);
                timestamps = [];
            }
            const now = Date.now();
            const oneDayAgo = now - (24 * 60 * 60 * 1000);
            const recentTimestamps = timestamps.filter(ts => ts > oneDayAgo);
            recentTimestamps.push(now);
            try {
                localStorage.setItem(UNAUTH_TIMESTAMPS_KEY, JSON.stringify(recentTimestamps));
            } catch (e) {
                console.error("Error writing unauth timestamps to localStorage", e);
            }
        }
        
        navigate('/review', { state: { generatedQuizData, quizTitleSuggestion: quizTitleSuggestion || generatedQuizData.title, finalConfig } });
        setProgress(100);
        setIsGeneratingQuiz(false);
        setGenerationStatusText(''); 
        return; 

      } catch (err: any) {
        console.error(`Error generating quiz (Attempt ${attempt + 1}/${MAX_GENERATION_RETRIES + 1}):`, err);
        if (err.message && err.message.includes("Gemini AI failed to generate quiz") && attempt < MAX_GENERATION_RETRIES) {
          if (attempt === MAX_GENERATION_RETRIES -1) { 
             setProgress(70); 
          }
        } else {
          setProcessingError(err instanceof Error ? err.message : t('step3ErrorGenerate')); 
          setProgress(0);
          setIsGeneratingQuiz(false);
          setGenerationStatusText(''); 
          return; 
        }
      }
    }
  };

  const handleCopyToClipboard = () => {
    if (processedContentText) {
      navigator.clipboard.writeText(processedContentText)
        .then(() => {
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2000);
        })
        .catch(err => {
          console.error('Failed to copy text: ', err);
          alert(t('azotaExportErrorCopy')); 
        });
    }
  };
  
  const handleCloseFullTextModal = useCallback(() => {
    setIsFullTextModalOpen(false);
  }, []);

  const generateIconUrl = "https://img.icons8.com/?size=256&id=eoxMN35Z6JKg&format=png";

  const getStepIndicator = (currentStep: number, targetStep: CreationStep, titleKey: keyof typeof translations.en, defaultIcon: ReactNode, _isLastStep: boolean = false) => {
    const isActive = currentStep === targetStep;
    const isCompleted = currentStep > targetStep;
    const inactiveTextColor = 'text-slate-400';

    let displayIconNode: ReactNode;
    const newCompletedIconUrl = "https://img.icons8.com/?size=256&id=VFaz7MkjAiu0&format=png";
    const iconClassName = "w-5 h-5 sm:w-6 sm:h-6 transition-transform var(--duration-fast) var(--ease-ios)";

    if (isCompleted) {
        displayIconNode = <img src={newCompletedIconUrl} alt={t('stepCompleted')} className={iconClassName} />;
    } else if (isActive) {
        let activeIconSrc = "";
        if (targetStep === 1) activeIconSrc = "https://img.icons8.com/?size=256&id=hwKgsZN5Is2H&format=png";
        else if (targetStep === 2) activeIconSrc = "https://img.icons8.com/?size=256&id=WwHcZxa9PFUq&format=png";
        else if (targetStep === 3) activeIconSrc = generateIconUrl;
        
        if (activeIconSrc) {
          displayIconNode = <img src={activeIconSrc} alt={t(titleKey)} className={`${iconClassName} scale-110`} />;
        } else if (React.isValidElement(defaultIcon)) {
          displayIconNode = React.cloneElement(defaultIcon as React.ReactElement<{ className?: string }>, { className: `${iconClassName} scale-110` });
        } else {
          displayIconNode = defaultIcon;
        }
    } else { 
        if (React.isValidElement(defaultIcon)) {
            displayIconNode = React.cloneElement(defaultIcon as React.ReactElement<{ className?: string }>, { className: iconClassName });
        } else {
            displayIconNode = defaultIcon;
        }
    }


    return (
      <div className={`flex flex-col items-center transition-colors var(--duration-fast) var(--ease-ios) ${isActive ? 'text-sky-300' : isCompleted ? 'text-green-400' : inactiveTextColor}`}>
        <div className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 mb-2.5
         transition-all var(--duration-fast) var(--ease-ios) will-change-transform, border, background-color, box-shadow
         ${isActive ? 'border-sky-400 bg-sky-400/20 text-sky-300 shadow-xl scale-105' :
           isCompleted ? 'border-green-400 bg-green-400/20 text-green-400 shadow-lg' : 
           `border-slate-600 bg-slate-700/60 text-slate-400`}
         font-semibold text-base sm:text-lg`}>
          {displayIconNode}
        </div>
        <span className={`text-xs sm:text-sm font-semibold text-center transition-colors var(--duration-fast) var(--ease-ios) ${isActive ? 'text-slate-50' : isCompleted ? 'text-slate-200' : inactiveTextColor}`}>{t(titleKey)}</span>
      </div>
    );
  };
  

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <Card className="max-w-xl mx-auto shadow-2xl !rounded-2xl" useGlassEffect>
            <div className="space-y-8">
              <Dropzone 
                onFileUpload={handleFileUpload} acceptedFileTypes=".pdf,.txt,.docx,.jpg,.png,.jpeg" maxFileSizeMB={10}
                label={<p className="text-base font-semibold text-slate-100 mb-2">{t('step1UploadOrDrag')}</p>}
                icon={<img src="https://img.icons8.com/?size=256&id=hwKgsZN5Is2H&format=png" alt={t('upload')} className="w-12 h-12 sm:w-14 sm:h-14 mb-3.5 text-slate-500 group-hover:text-sky-400 transition-all var(--duration-fast) var(--ease-ios) group-hover:scale-105" />}
                isLoading={isProcessingFile} currentFile={uploadedFile}
              />
              {isProcessingFile && progress > 0 && <ProgressBar progress={progress} label={t('step1ProcessingFile')} className="mt-4 animate-fadeIn" />}
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-600/70"></div>
                <span className="flex-shrink mx-4 text-slate-400 text-xs font-medium uppercase tracking-wider">{t('step1Or')}</span>
                <div className="flex-grow border-t border-slate-600/70"></div>
              </div>
              <Textarea
                label={<p className="text-base font-semibold text-slate-100">{t('step1PasteTextLabel')}</p>}
                value={pastedText} onChange={(e) => setPastedText(e.target.value)} placeholder={t('step1PasteTextPlaceholder')}
                rows={6} className="min-h-[150px] text-sm"
              />
              <Button onClick={handlePasteText} disabled={!pastedText.trim() || isProcessingFile} fullWidth size="lg" variant="secondary" className="py-3 shadow-lg">
                {t('step1UsePastedText')}
              </Button>
              {processingError && !isProcessingFile && (<div role="alert" className={`p-3.5 bg-red-500/20 border border-red-500/50 rounded-lg text-sm text-red-300 text-center shadow-md animate-fadeIn`}>{processingError}</div>)}
            </div>
          </Card>
        );
      case 2:
        const modelDisplayLabel = (
            <div className="flex items-center text-sm font-semibold text-slate-100">
                 <img src="https://www.pngall.com/wp-content/uploads/16/Google-Gemini-Logo-Transparent.png" alt={t('step2AIModelLabel')} className="w-5 h-5 mr-2.5" />
                {t('step2AIModelLabel')}
                {isApiKeyMissingForGemini() && (
                    <Tooltip content={t('apiKeyMissingTooltip')} placement="top">
                        <KeyIcon className="w-4 h-4 text-yellow-400 ml-2.5 cursor-help"/>
                    </Tooltip>
                )}
            </div>
        );
        const customPromptLabel = (<div className="flex items-center text-sm font-medium text-slate-200">{t('step2CustomPromptLabel')}<Tooltip content={<div className="max-w-xs text-left text-xs">{t('step2CustomPromptPlaceholder')}</div>} placement="top"><InformationCircleIcon className="w-4 h-4 text-slate-500 ml-2.5 cursor-help" /></Tooltip></div>);
        
        const manualDifficultyOptions = [
          { value: 'Easy', label: t('step2DifficultyEasy') },
          { value: 'Medium', label: t('step2DifficultyMedium') },
          { value: 'Hard', label: t('step2DifficultyHard') },
        ];
        const allDifficultyOptions = [
          ...manualDifficultyOptions,
          { value: 'AI-Determined', label: t('step2DifficultyAIDetermined') } 
        ];
        const numQuestionsLabelText = useAIMode ? t('step2NumQuestionsLabelAIMode') : t('step2NumQuestionsLabel');

        return (
          <Card className="max-w-2xl mx-auto shadow-2xl !rounded-2xl" useGlassEffect>
            <div className="space-y-6 sm:space-y-8">
              <Card className={`!bg-slate-700/70 !border-slate-600/70 p-4 sm:p-5 !rounded-xl shadow-lg`} useGlassEffect={false}>
                  <h3 className="text-sm font-semibold text-slate-200 mb-2.5">{t('step2SourceContent')}</h3>
                  <div className="flex items-center text-sm text-slate-300 overflow-x-auto overflow-y-hidden whitespace-nowrap cursor-default thin-scrollbar-horizontal py-0.5">
                      <DocumentTextIcon className="w-5 h-5 mr-3 text-sky-400 flex-shrink-0" strokeWidth={1.5}/>
                      <span className="pr-1">
                           {uploadedFile 
                              ? (imageBase64 
                                  ? t('step2Image', {fileName: uploadedFile.name}) 
                                  : t('step2File', {fileName: uploadedFile.name}))
                              : pastedText 
                                  ? t('step2PastedText') 
                                  : "N/A"}
                      </span>
                  </div>
                  {processedContentText && (
                       <Button 
                         variant="secondary" 
                         onClick={() => setIsFullTextModalOpen(true)} 
                         className="text-xs !font-semibold mt-3.5 py-2 px-4 rounded-lg shadow-md hover:shadow-slate-900/50"
                         leftIcon={<DocumentTextIcon className="w-4 h-4" strokeWidth={2}/>}
                       >
                           {t('step2ViewFullText')}
                       </Button>
                  )}
              </Card>

              <Input label={<p className="text-base font-semibold text-slate-100">{t('step2QuizTitleLabel')}</p>} name="quizTitle" value={quizTitleSuggestion} onChange={(e) => setQuizTitleSuggestion(e.target.value)} placeholder={t('step2QuizTitlePlaceholder')} inputClassName="text-lg py-3" />
              
              <Card className={`!bg-slate-700/70 !border-slate-600/70 p-4 sm:p-5 !rounded-xl shadow-lg`} useGlassEffect={false}>
                {modelDisplayLabel}
                <p className="text-sm text-slate-300 mt-1.5">Google Gemini <span className="font-medium">{isApiKeyMissingForGemini() ? <span className="text-yellow-400">({t('apiKeyMissingShort')})</span> : <span className="text-green-400">({t('default')})</span>}</span></p>
              </Card>

              <Card className={`p-4 sm:p-5 !border-slate-600/70 !rounded-xl !bg-slate-800/70 shadow-lg space-y-5`} useGlassEffect={false}>
                <Toggle 
                  label={<p className="text-base font-semibold text-slate-100">{t('step2AIModeLabel')}</p>} 
                  checked={useAIMode} 
                  onChange={handleAIModeToggle} 
                  description={t('step2AIModeDesc')}
                />
                
                <Input 
                  label={numQuestionsLabelText} 
                  type="number" 
                  name="numQuestions" 
                  value={quizConfig.numQuestions} 
                  onChange={handleConfigChange} 
                  min={useAIMode ? "0" : "1"} 
                  max="50" 
                  containerClassName={useAIMode ? 'mt-4' : ''}
                  placeholder={useAIMode && quizConfig.numQuestions === 0 ? t('step2NumQuestionsAIPlaceholder') : undefined}
                />
                
                <Select 
                  label={t('step2DifficultyLabel')} 
                  name="difficulty" 
                  value={quizConfig.difficulty} 
                  onChange={handleConfigChange} 
                  options={useAIMode ? allDifficultyOptions : manualDifficultyOptions} 
                  disabled={useAIMode}
                />

                <Select 
                  label={t('step2LanguageLabel')} 
                  name="language" 
                  value={quizConfig.language} 
                  onChange={handleConfigChange} 
                  options={[{ value: 'English', label: t('step2LanguageEnglish') }, { value: 'Vietnamese', label: t('step2LanguageVietnamese') }]} 
                />
              </Card>
              
              <Textarea label={customPromptLabel} name="customUserPrompt" value={customUserPrompt} onChange={(e) => setCustomUserPrompt(e.target.value)} placeholder={t('step2CustomPromptPlaceholder').substring(0,60) + "..."} rows={4} className="min-h-[90px] text-sm" />
              
              {processingError && (<div role="alert" className={`p-3.5 bg-red-500/20 border border-red-500/50 rounded-lg text-sm text-red-300 text-center shadow-md animate-fadeIn`}>{processingError}</div>)}

              <div className="flex flex-col sm:flex-row justify-between items-center pt-5 gap-4">
                  <Button variant="outline" onClick={() => { setStep(1); setProcessedContentText(null); setImageBase64(null); setUploadedFile(null); setPastedText(''); setProcessingError(null); setInitialImageExtractedText(null); }} leftIcon={<ChevronLeftIcon className="w-4 h-4"/>} size="lg" className="w-full sm:w-auto py-3"> {t('back')} </Button>
                  <Button onClick={() => { setStep(3); setProcessingError(null); }} disabled={(isApiKeyMissingForGemini() && quizConfig.selectedModel === GEMINI_MODEL_ID)} rightIcon={<ChevronRightIcon className="w-4 h-4"/>} variant="primary" size="lg" tooltip={(isApiKeyMissingForGemini() && quizConfig.selectedModel === GEMINI_MODEL_ID) ? t('apiKeyMissingTooltip') : undefined} className="w-full sm:w-auto py-3"> {t('step2NextButton')} </Button>
              </div>
            </div>
            {isFullTextModalOpen && (
            <Modal 
              isOpen={isFullTextModalOpen} 
              onClose={handleCloseFullTextModal} 
              title={t('fullTextModalTitle')} 
              size="3xl"
              footerContent={
                <div className="flex flex-col sm:flex-row sm:justify-between items-center w-full gap-3 sm:gap-0">
                  <Button 
                    variant="outline" 
                    onClick={handleCopyToClipboard}
                    leftIcon={<CopyIcon className="w-4 h-4"/>}
                    size="md"
                    className="w-full sm:w-auto"
                  >
                    {copySuccess ? t('azotaExportCopied') : t('azotaExportCopy')}
                  </Button>
                  <Button 
                      onClick={handleCloseFullTextModal} 
                      variant="secondary" 
                      size="md"
                      className="w-full sm:w-auto"
                  >
                    {t('close')}
                  </Button>
                </div>
              }
            >
              <Textarea
                value={processedContentText || ''}
                readOnly
                className="!bg-slate-700/70 !border-slate-600/50 text-slate-100 whitespace-pre-wrap text-sm min-h-[60vh] max-h-[65vh] shadow-inner focus:!border-sky-400/70 focus:!ring-sky-400/40"
                rows={20}
                aria-label={t('fullTextModalTitle')}
              />
            </Modal>
          )}
          </Card>
        );
      case 3:
        const iconSize = "w-5 h-5"; 
        let currentButtonText = t('step3GenerateButton');
        if (isGeneratingQuiz) {
            const attemptMatch = generationStatusText.match(/Attempt (\d+)\/(\d+)/) || 
                                 generationStatusText.match(/Lần (\d+)\/(\d+)/);       

            if (attemptMatch && attemptMatch.length === 3) {
                const currentAttempt = parseInt(attemptMatch[1], 10);
                const maxAttempts = parseInt(attemptMatch[2], 10);
                currentButtonText = t('step3GeneratingRetryButton', { currentAttempt, maxAttempts });
            } else {
                currentButtonText = t('step3GeneratingButton');
            }
        }
        
        return (
          <Card className="max-w-xl mx-auto shadow-2xl !rounded-2xl" useGlassEffect>
            <div 
              className={`!bg-slate-700/70 p-6 sm:p-8 !rounded-xl mb-8 border border-slate-600/70 shadow-xl`}
            >
              <h3 className="text-2xl sm:text-3xl font-semibold text-slate-50 mb-6 text-center">{t('step3SummaryTitle')}</h3>
              <div className="space-y-1 divide-y divide-slate-600/50">
                <SummaryItem icon={<img src="https://www.pngall.com/wp-content/uploads/16/Google-Gemini-Logo-Transparent.png" alt={t('step2AIModelLabel')} className={iconSize} />} label={t('step3AIModelSelected', {modelName: ""})} value="Google Gemini" />
                <SummaryItem 
                  icon={<DocumentTextIcon className={iconSize} />} 
                  label={t('step3TitleSuggestion', {title: ""})} 
                  value={<MathText text={quizTitleSuggestion || t('step3TitleAISuggested')} />} 
                />
                <SummaryItem icon={<img src="https://img.icons8.com/?size=256&id=hwKgsZN5Is2H&format=png" alt={t('upload')} className={iconSize} />} label={t('step3ContentSource', {source: ""})} value={uploadedFile ? (imageBase64 ? t('step2Image', {fileName: uploadedFile.name}) : t('step2File', {fileName: uploadedFile.name})) : pastedText ? t('step2PastedText') : "N/A"} />
                
                <SummaryItem icon={<img src="https://img.icons8.com/?size=256&id=WwHcZxa9PFUq&format=png" alt={t('settings')} className={iconSize} />} label={t('step3Mode', {mode: ""})} value={useAIMode ? t('step3ModeAIOptimized') : "Manual"} />
                <SummaryItem icon={<img src="https://img.icons8.com/?size=256&id=PPnPJOpQpJ2J&format=png" alt={t('step3NumQuestions', {count:""})} className={iconSize} />} label={t('step3NumQuestions', {count:""})} value={useAIMode && quizConfig.numQuestions === 0 ? t('step2NumQuestionsAIPlaceholder') : quizConfig.numQuestions} />
                <SummaryItem icon={<ChartBarIcon className={iconSize} />} label={t('step3Difficulty', {level:""})} value={quizConfig.difficulty === 'AI-Determined' ? t('step2DifficultyAIDetermined') : t(`step2Difficulty${quizConfig.difficulty}` as keyof typeof translations.en)} />
                <SummaryItem icon={<img src="https://img.icons8.com/?size=48&id=fs8AdHsHlO36&format=png" alt="Language" className={iconSize} />} label={t('step3Language', {lang:""})} value={quizConfig.language === "English" ? t('step2LanguageEnglish') : t('step2LanguageVietnamese')} />
                
                <div className="pt-2.5"> 
                  <SummaryItem 
                    icon={<InformationCircleIcon className={iconSize} />} 
                    label={customUserPrompt.trim() ? t('step3CustomPromptProvidedLabel') : t('step3CustomPromptNone')}
                    value={customUserPrompt.trim() ? <blockquote className="text-xs text-slate-300/90 italic whitespace-pre-wrap max-h-24 overflow-y-auto bg-slate-700/40 p-2 rounded-md mt-1 border-l-2 border-slate-500/70"><MathText text={customUserPrompt.trim()} /></blockquote> : ""}
                  />
                </div>
              </div>
            </div>
            {(isApiKeyMissingForGemini() && quizConfig.selectedModel === GEMINI_MODEL_ID) && (<div role="alert" className={`my-5 p-3.5 bg-red-500/20 border border-red-500/50 rounded-lg text-sm text-red-300 text-center shadow-md animate-fadeIn`}>{t('error')}! {t('step3ErrorAPIKeyMissingForModel', {modelName: "Google Gemini"})}</div>)}
            <Button 
              onClick={handleGenerateQuiz} 
              isLoading={isGeneratingQuiz} 
              disabled={isGeneratingQuiz || (isApiKeyMissingForGemini() && quizConfig.selectedModel === GEMINI_MODEL_ID)} 
              fullWidth 
              size="lg" 
              variant="primary" 
              leftIcon={<img src={generateIconUrl} alt={t('step3GenerateButton')} className="w-5 h-5" />}
              className="bg-gradient-to-r from-green-500 via-teal-500 to-sky-500 hover:from-green-600 hover:via-teal-600 hover:to-sky-600 text-white dark:text-white shadow-xl hover:shadow-green-500/40 py-3.5 rounded-xl"
            > 
              {currentButtonText}
            </Button>
            {isGeneratingQuiz && <ProgressBar progress={progress} label={generationStatusText || t('step3AIIsThinking')} className="mt-6 animate-fadeIn" />}
            {processingError && !isGeneratingQuiz && (<div role="alert" className={`mt-5 p-3.5 bg-red-500/20 border border-red-500/50 rounded-lg text-sm text-red-300 text-center shadow-md animate-fadeIn`}>{processingError}</div>)}
            <div className="mt-8 text-center"> <Button variant="outline" onClick={() => {setStep(2); setProcessingError(null); setGenerationStatusText('');}} leftIcon={<ChevronLeftIcon className="w-4 h-4"/>} size="lg" className="w-full sm:w-auto py-3"> {t('step3BackButtonCfg')} </Button> </div>
          </Card>
        );
    }
  };
  
  return (
    <div className="py-6 sm:py-8">
      <motion.div 
        className="relative mb-10 sm:mb-12"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: easeIOS }}
      >
        <div className="absolute inset-0 flex items-center" aria-hidden="true"> <div className={`w-full border-t-2 border-slate-700/60 border-dashed`} /> </div>
        <div className="relative flex justify-center"> <span className={`px-5 sm:px-6 bg-slate-900 text-2xl sm:text-3xl font-bold text-slate-50 tracking-tight`}> {t('createQuiz')} </span> </div>
      </motion.div>

      <motion.div 
        className={`mb-8 sm:mb-10 text-center px-4`} 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: easeIOS, delay: 0.1 }}
      >
        <p className="text-xs text-slate-400">
            {t('rateLimitInfoUnauthenticated', { limit: MAX_UNAUTH_QUIZZES_PER_DAY })} {t('rateLimitInfoAuthenticated')}
        </p>
      </motion.div>
      
      <motion.div 
        className={`max-w-lg mx-auto mb-12 sm:mb-16 flex justify-around items-start p-4 sm:p-5 bg-slate-800/70 rounded-2xl shadow-xl border border-slate-700/70 glass-effect`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeIOS, delay: 0.2 }}
      >
        {getStepIndicator(step, 1, 'step1Title', <img src="https://img.icons8.com/?size=256&id=hwKgsZN5Is2H&format=png" alt={t('step1Title')} />)}
        <div className={`flex-grow h-1.5 bg-slate-600 rounded-full mx-3 sm:mx-5 mt-5 sm:mt-[1.375rem]`}><div className="h-1.5 bg-sky-400 rounded-full transition-width var(--duration-normal) var(--ease-ios)" style={{width: step === 1 ? '0%' : step === 2 ? '50%' : '100%'}}></div> </div>
        {getStepIndicator(step, 2, 'step2Title', <img src="https://img.icons8.com/?size=256&id=WwHcZxa9PFUq&format=png" alt={t('step2Title')} />)}
         <div className={`flex-grow h-1.5 bg-slate-600 rounded-full mx-3 sm:mx-5 mt-5 sm:mt-[1.375rem]`}><div className="h-1.5 bg-sky-400 rounded-full transition-width var(--duration-normal) var(--ease-ios)" style={{width: step <= 2 ? '0%' : '100%'}}></div> </div>
        {getStepIndicator(step, 3, 'step3Title', <img src={generateIconUrl} alt={t('step3Title')} className="w-5 h-5 sm:w-6 sm:h-6" />, true)}
      </motion.div>
      
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4, ease: easeIOS }}
        >
          {renderStepContent()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
QuizCreatePage.displayName = "QuizCreatePage";

export default QuizCreatePage;