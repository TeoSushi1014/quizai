


import React, { useState, useCallback, useEffect, createContext, useContext, ReactNode, useMemo, useRef, lazy, Suspense, useId } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation, NavLink as RouterNavLink, Navigate } from 'react-router-dom'; 
import { GoogleOAuthProvider, googleLogout } from '@react-oauth/google';
import { useSwipeable } from 'react-swipeable';
import { Quiz, AppContextType, Language, QuizResult, UserProfile, SyncState } from './types';
import { APP_NAME, KeyIcon, LogoutIcon, HomeIcon, PlusCircleIcon, ChartBarIcon, SettingsIcon, SettingsIconMobileNav, InformationCircleIcon, XCircleIcon, RefreshIcon, CheckCircleIcon, ChevronDownIcon, UserCircleIcon, SunIcon, MoonIcon } from './constants'; 
import { Button, LoadingSpinner, Tooltip, Toggle } from './components/ui';
import { UserAvatar } from './components/UserAvatar'; 
import ErrorBoundary from './components/ErrorBoundary'; 
import { getTranslator, translations } from './i18n';
import useIntersectionObserver from './hooks/useIntersectionObserver';
import { logger } from './services/logService'; 
import { useTheme } from './contexts/ThemeContext'; 
import { ThemeToggle, ThemeToggleSwitch } from './components/ThemeToggle'; 
import { useNotification } from './hooks/useNotification';

import HomePage from './features/quiz/HomePage';
import DashboardPage from './features/quiz/DashboardPage';
const QuizCreatePage = lazy(() => import('./features/quiz/QuizCreatePage'));
const QuizTakingPage = lazy(() => import('./features/quiz/QuizTakingPage'));
const ResultsPage = lazy(() => import('./features/quiz/ResultsPage'));
const QuizReviewPage = lazy(() => import('./features/quiz/QuizReviewPage'));
const SignInPage = lazy(() => import('./features/auth/SignInPage'));
const QuizPracticePage = lazy(() => import('./features/quiz/QuizPracticePage'));
const SyncSettingsPage = lazy(() => import('./features/settings/SyncSettingsPage'));
const ProfilePage = lazy(() => import('./features/user/ProfilePage'));

import { loadQuizDataFromDrive, saveQuizDataToDrive } from './services/driveService';
import { quizStorage } from './services/storageService'; 

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

export const useTranslation = () => {
  const { language } = useAppContext();
  return {
    t: useMemo(() => getTranslator(language), [language]),
    language,
  };
};

const GOOGLE_CLIENT_ID = "486123633428-14f8o50husb82sho688e0qvc962ucr4n.apps.googleusercontent.com"; 
const LOCALSTORAGE_USER_KEY = 'currentUser'; 
const LOCALSTORAGE_LANGUAGE_KEY = 'appLanguage';
const LOCALSTORAGE_DRIVE_SYNC_KEY = 'driveLastSyncTimestamp';
const LOCALSTORAGE_QUIZ_RESULT_KEY = 'quizResult';

const mergeQuizzes = (localQuizzes: Quiz[], driveQuizzes: Quiz[]): Quiz[] => {
  logger.info('Merging local and Drive quizzes', 'MergeUtils', { localCount: localQuizzes.length, driveCount: driveQuizzes.length });
  const quizMap = new Map<string, Quiz>();

  [...localQuizzes, ...driveQuizzes].forEach(quiz => {
    const existingQuiz = quizMap.get(quiz.id);
    if (!existingQuiz) {
      quizMap.set(quiz.id, quiz);
    } else {
      const existingTime = new Date(existingQuiz.lastModified || existingQuiz.createdAt).getTime();
      const newTime = new Date(quiz.lastModified || quiz.createdAt).getTime();
      if (newTime > existingTime) {
        quizMap.set(quiz.id, quiz);
      }
    }
  });
  const merged = Array.from(quizMap.values());
  logger.info('Merge complete', 'MergeUtils', { mergedCount: merged.length });
  return merged;
};


const AppProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [allQuizzes, setAllQuizzes] = useState<Quiz[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [language, setLanguageState] = useState<Language>('en');
  const [currentUser, setCurrentUserInternal] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true); 
  const [isGeminiKeyAvailable, setIsGeminiKeyAvailable] = useState(false);
  const [appInitialized, setAppInitialized] = useState(false);

  const [isDriveLoading, setIsDriveLoading] = useState(false);
  const [driveSyncError, setDriveSyncErrorState] = useState<string | null>(null);
  const [lastDriveSync, setLastDriveSync] = useState<Date | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [currentSyncActivityMessage, setCurrentSyncActivityMessage] = useState<string | null>(null);
  
  const saveToDriveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveToDriveMinIntervalRef = useRef(0); 
  const autoSyncAttemptLimitRef = useRef({ count: 0, lastWindowStart: 0 }); 
  const manualSyncAttemptLimitRef = useRef({ count: 0, lastWindowStart: 0 }); 
  
  const tForProvider = useMemo(() => getTranslator(language), [language]);
  const { showSuccess: showSuccessNotification, showError: showErrorNotification } = useNotification();


  const setCurrentUser = useCallback((user: UserProfile | null) => {
    if (user) {
        const userWithDefaults: UserProfile = {
            ...user,
            bio: user.bio || null,
            quizCount: user.quizCount || 0,
            completionCount: user.completionCount || 0,
            averageScore: user.averageScore || null,
        };
        setCurrentUserInternal(userWithDefaults);
        logger.setUserId(userWithDefaults.id);
        logger.info('User logged in or updated', 'AuthContext', { userId: userWithDefaults.id, email: userWithDefaults.email, hasPhotoUrl: !!userWithDefaults.imageUrl });
    } else {
        setCurrentUserInternal(null);
        logger.setUserId(null);
        logger.info('User logged out', 'AuthContext');
    }
  }, []);

  const setDriveSyncError = useCallback((errorKey: string | null) => {
    if (errorKey === null) {
        setDriveSyncErrorState(null);
    } else {
        const errorMessage = tForProvider(errorKey as keyof typeof translations.en) || tForProvider('driveErrorGeneric');
        setDriveSyncErrorState(errorMessage);
        setSyncState('error'); 
        setCurrentSyncActivityMessage(null); 
        logger.warn(`Drive Sync Error set: ${errorMessage}`, 'DriveContext', { errorKey });
    }
  }, [tForProvider]);

  useEffect(() => {
    logger.info('App initializing: Loading initial data', 'AppInit');
    const hardcodedKey = 'AIzaSyDDcYcb1JB-NKFRDC28KK0yVH_Z3GX9lU0';
    const apiKeyFromEnv = (typeof process !== 'undefined' && process.env) ? process.env.GEMINI_API_KEY : undefined;
    const geminiKeyStatus = !!(apiKeyFromEnv || hardcodedKey);
    setIsGeminiKeyAvailable(geminiKeyStatus);
    if (!geminiKeyStatus) {
        logger.warn('Gemini API key not available.', 'AppInit');
    }

    const savedLanguage = localStorage.getItem(LOCALSTORAGE_LANGUAGE_KEY) as Language | null;
    if (savedLanguage && translations[savedLanguage]) {
      setLanguageState(savedLanguage);
    }
    
    const savedUserJson = localStorage.getItem(LOCALSTORAGE_USER_KEY);
    if (savedUserJson) {
      try {
        const user = JSON.parse(savedUserJson) as UserProfile;
        setCurrentUser(user); 
      } catch (e) { 
        logger.error("Failed to parse current user from localStorage", 'AppInit', undefined, e as Error);
        localStorage.removeItem(LOCALSTORAGE_USER_KEY); 
      }
    }

    const savedResultJson = localStorage.getItem(LOCALSTORAGE_QUIZ_RESULT_KEY);
    if (savedResultJson) {
      try {
        setQuizResult(JSON.parse(savedResultJson) as QuizResult);
      } catch (e) {
        logger.error("Failed to parse quiz result from localStorage", 'AppInit', undefined, e as Error);
        localStorage.removeItem(LOCALSTORAGE_QUIZ_RESULT_KEY);
      }
    }
    
    const lastSyncTimestamp = localStorage.getItem(LOCALSTORAGE_DRIVE_SYNC_KEY);
    if (lastSyncTimestamp) setLastDriveSync(new Date(lastSyncTimestamp));

    setAppInitialized(true); 
    logger.info('App initialization complete.', 'AppInit');
  }, [setCurrentUser, tForProvider]); 

  useEffect(() => {
    if (!appInitialized) return;

    const loadInitialQuizzesAndSync = async () => {
      logger.info('Loading initial quizzes and potentially syncing.', 'QuizLoading', { isLoggedIn: !!currentUser?.accessToken });
      setIsLoading(true);
      setDriveSyncError(null);
      
      let finalQuizzesToSet: Quiz[] = [];
      let operationSuccessful = false;

      if (currentUser?.accessToken) {
        setIsDriveLoading(true);
        setSyncState('syncing');
        setCurrentSyncActivityMessage(tForProvider('initialSyncMessage'));
        
        try {
          const driveQuizzes = await loadQuizDataFromDrive(currentUser.accessToken);
          const localQuizzes = await quizStorage.getAllQuizzes();

          if (driveQuizzes !== null) { 
            logger.info("Initial load: Data found on Drive. Merging with local.", 'QuizLoading', { driveCount: driveQuizzes.length, localCount: localQuizzes.length });
            finalQuizzesToSet = mergeQuizzes(localQuizzes, driveQuizzes);
            await quizStorage.saveQuizzes(finalQuizzesToSet);
            await saveQuizDataToDrive(currentUser.accessToken, finalQuizzesToSet); 
            logger.info("Initial load: Merged data saved locally and to Drive.", 'QuizLoading', { count: finalQuizzesToSet.length });
          } else { 
            logger.info("Initial load: No data file on Drive. Using local data.", 'QuizLoading', { localCount: localQuizzes.length });
            finalQuizzesToSet = localQuizzes;
            if (localQuizzes.length > 0) {
              logger.info("Initial load: Uploading local data to new Drive file.", 'QuizLoading', { count: localQuizzes.length });
              await saveQuizDataToDrive(currentUser.accessToken, localQuizzes);
            }
          }
          setLastDriveSync(new Date());
          localStorage.setItem(LOCALSTORAGE_DRIVE_SYNC_KEY, new Date().toISOString());
          setSyncState('success');
          setCurrentSyncActivityMessage(tForProvider('syncCompleteMessage'));
          operationSuccessful = true;
        } catch (error: any) {
          logger.error("Initial load: Failed to load or sync quizzes with Google Drive.", 'QuizLoading', { errorMsg: error.message }, error);
          const errorKey = error.message as keyof typeof translations.en;
          const knownError = translations.en[errorKey] ? errorKey : 'driveErrorLoading';
          setDriveSyncError(knownError);
          finalQuizzesToSet = await quizStorage.getAllQuizzes(); 
          logger.info("Initial load: Fell back to local storage due to Drive error.", 'QuizLoading', { count: finalQuizzesToSet.length });
          operationSuccessful = false; 
        } finally {
          setAllQuizzes(finalQuizzesToSet); 
          setIsDriveLoading(false);
          setTimeout(() => {
             if ((syncState === 'success' && operationSuccessful) || (syncState === 'error' && !operationSuccessful)) {
               setCurrentSyncActivityMessage(null);
             }
          }, 3000);
        }
      } else { 
        finalQuizzesToSet = await quizStorage.getAllQuizzes();
        setAllQuizzes(finalQuizzesToSet);
        setSyncState('idle');
        setCurrentSyncActivityMessage(null);
        logger.info("Initial load: User not logged in, loaded from local storage.", 'QuizLoading', { count: finalQuizzesToSet.length });
      }
      setIsLoading(false);
      logger.info('Initial quiz loading and sync attempt finished.', 'QuizLoading');
    };

    loadInitialQuizzesAndSync();
  }, [appInitialized, currentUser?.accessToken, setDriveSyncError, tForProvider]);

  const triggerSaveToDrive = useCallback((quizzesToSave: Quiz[]) => {
    if (Date.now() - saveToDriveMinIntervalRef.current < 10000) { 
        logger.debug("triggerSaveToDrive: Skipping schedule, too soon since last actual save initiation.", 'DriveSync');
        return;
    }

    if (saveToDriveTimeoutRef.current) {
      clearTimeout(saveToDriveTimeoutRef.current);
    }
    saveToDriveTimeoutRef.current = setTimeout(async () => {
      saveToDriveMinIntervalRef.current = Date.now(); 

      const now = Date.now();
      if (now - autoSyncAttemptLimitRef.current.lastWindowStart < 60000) { 
          autoSyncAttemptLimitRef.current.count++;
          if (autoSyncAttemptLimitRef.current.count > 5) { 
              logger.warn("triggerSaveToDrive: Too many auto-sync attempts in a short period. Aborting this attempt.", 'DriveSyncRateLimit');
              setIsDriveLoading(false); 
              setSyncState('error'); 
              setDriveSyncError('driveErrorRateLimit'); 
              return;
          }
      } else {
          autoSyncAttemptLimitRef.current.lastWindowStart = now;
          autoSyncAttemptLimitRef.current.count = 1;
      }

      if (currentUser?.accessToken) {
        setIsDriveLoading(true);
        setDriveSyncError(null); 
        setSyncState('syncing');
        setCurrentSyncActivityMessage(tForProvider('syncStatusInProgress')); 
        logger.info("Debounced: Attempting to save to Google Drive...", 'DriveSync', { quizCount: quizzesToSave.length });
        try {
          await saveQuizDataToDrive(currentUser.accessToken, quizzesToSave);
          setLastDriveSync(new Date());
          localStorage.setItem(LOCALSTORAGE_DRIVE_SYNC_KEY, new Date().toISOString());
          logger.info("Debounced: Successfully saved quizzes to Google Drive.", 'DriveSync');
          setSyncState('success');
          setCurrentSyncActivityMessage(tForProvider('autoSyncCompleteMessage')); 
        } catch (error: any) {
          logger.error("Debounced: Failed to save quizzes to Google Drive.", 'DriveSync', { errorMsg: error.message }, error);
          const errorKey = error.message as keyof typeof translations.en;
          setDriveSyncError(translations.en[errorKey] ? errorKey : 'driveErrorSaving');
        } finally {
          setIsDriveLoading(false);
          setTimeout(() => { 
            if (syncState === 'success' || syncState === 'error') setCurrentSyncActivityMessage(null);
          }, 3000);
        }
      }
    }, 3000); 
  }, [currentUser?.accessToken, setDriveSyncError, tForProvider, syncState]);

  useEffect(() => {
    if (appInitialized && !isLoading && currentUser?.accessToken && allQuizzes.length >= 0) {
        triggerSaveToDrive(allQuizzes);
    }
  }, [allQuizzes, appInitialized, isLoading, currentUser?.accessToken, triggerSaveToDrive]);
  
  useEffect(() => {
    if (appInitialized) { 
      if (currentUser) {
        localStorage.setItem(LOCALSTORAGE_USER_KEY, JSON.stringify(currentUser));
      } else {
        localStorage.removeItem(LOCALSTORAGE_USER_KEY);
        localStorage.removeItem(LOCALSTORAGE_DRIVE_SYNC_KEY); 
        setLastDriveSync(null);
        setSyncState('idle');
        setCurrentSyncActivityMessage(null);
      }
    }
  }, [currentUser, appInitialized]);

  useEffect(() => {
    if (appInitialized) {
      if (quizResult) {
        localStorage.setItem(LOCALSTORAGE_QUIZ_RESULT_KEY, JSON.stringify(quizResult));
      } else {
        localStorage.removeItem(LOCALSTORAGE_QUIZ_RESULT_KEY);
      }
    }
  }, [quizResult, appInitialized]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(LOCALSTORAGE_LANGUAGE_KEY, lang);
    logger.info(`Language changed to ${lang}`, 'AppContext');
  }, []);
  
  const navigate = useNavigate(); 

  const setCurrentView = useCallback((viewPath: string, _params?: Record<string, string | number>) => {
    navigate(viewPath);
  }, [navigate]);

  const addQuiz = useCallback(async (quiz: Quiz): Promise<void> => {
    const now = new Date().toISOString();
    const quizWithOwnerAndTimestamp = { 
      ...quiz, 
      userId: currentUser ? currentUser.id : undefined,
      createdAt: quiz.createdAt || now, 
      lastModified: now,
    };

    let finalQuizzesList: Quiz[] = [];
    setAllQuizzes(prevQuizzes => {
      finalQuizzesList = [quizWithOwnerAndTimestamp, ...prevQuizzes.filter(q => q.id !== quiz.id)]; 
      return finalQuizzesList;
    });
    logger.info('Quiz added to context state', 'AppContext', { quizId: quiz.id, title: quiz.title });
    try {
      await quizStorage.saveQuizzes(finalQuizzesList);
      logger.info('Quiz saved to local storage via addQuiz call', 'AppContext', { quizId: quiz.id });
    } catch (e) {
      logger.error('Error from quizStorage.saveQuizzes in addQuiz', 'AppContext', { quizId: quiz.id }, e as Error);
      throw e; 
    }
  }, [currentUser]);

  const deleteQuiz = useCallback(async (quizId: string): Promise<void> => {
    let finalQuizzesList: Quiz[] = [];
    setAllQuizzes(prevQuizzes => {
      finalQuizzesList = prevQuizzes.filter(q => q.id !== quizId);
      return finalQuizzesList;
    });
    logger.info('Quiz deleted from context state', 'AppContext', { quizId });
    try {
      await quizStorage.saveQuizzes(finalQuizzesList);
      logger.info('Quizzes (after deletion) saved to local storage via deleteQuiz call', 'AppContext', { quizId });
    } catch (e) {
      logger.error('Error from quizStorage.saveQuizzes in deleteQuiz', 'AppContext', { quizId }, e as Error);
      throw e;
    }
  }, []);

  const updateQuiz = useCallback(async (updatedQuiz: Quiz): Promise<void> => {
    const now = new Date().toISOString();
    const quizWithTimestamp = {
      ...updatedQuiz,
      lastModified: now,
    };
    let finalQuizzesList: Quiz[] = [];
    setAllQuizzes(prevQuizzes => {
      finalQuizzesList = prevQuizzes.map(q => q.id === quizWithTimestamp.id ? quizWithTimestamp : q);
      return finalQuizzesList;
    });
    logger.info('Quiz updated in context state', 'AppContext', { quizId: updatedQuiz.id, title: updatedQuiz.title });
    try {
      await quizStorage.saveQuizzes(finalQuizzesList);
      logger.info('Quiz saved to local storage via updateQuiz call', 'AppContext', { quizId: updatedQuiz.id });
    } catch (e) {
      logger.error('Error from quizStorage.saveQuizzes in updateQuiz', 'AppContext', { quizId: updatedQuiz.id }, e as Error);
      throw e;
    }
  }, []);

  const getQuizByIdFromAll = useCallback((id: string): Quiz | null => {
    return allQuizzes.find(q => q.id === id) || null;
  }, [allQuizzes]);

  const setQuizResultWithPersistence = useCallback((result: QuizResult | null) => {
    setQuizResult(result);
  }, []);

  const login = useCallback((user: UserProfile, token?: string) => {
    const userWithTokenAndDefaults: UserProfile = {
        ...user,
        accessToken: token || user.accessToken,
        bio: user.bio || null,
        quizCount: user.quizCount || 0,
        completionCount: user.completionCount || 0,
        averageScore: user.averageScore || null,
    };
    setCurrentUser(userWithTokenAndDefaults); 
    setDriveSyncError(null); 
    setSyncState('idle'); 
    setCurrentSyncActivityMessage(null);
  }, [setCurrentUser, setDriveSyncError]); 

  const handleLogout = useCallback(async () => { 
    logger.info('Logout initiated', 'AuthContext');
    googleLogout();
    if (saveToDriveTimeoutRef.current) {
      clearTimeout(saveToDriveTimeoutRef.current); 
    }
    setCurrentUser(null); 
    setActiveQuiz(null); 
    setQuizResult(null);
    setAllQuizzes([]); 
    await quizStorage.saveQuizzes([]); 
    localStorage.removeItem(LOCALSTORAGE_QUIZ_RESULT_KEY);
    setDriveSyncError(null);
    setCurrentSyncActivityMessage(null);
    setSyncState('idle');
    navigate('/'); 
    logger.info('Logout complete', 'AuthContext');
  }, [navigate, setCurrentUser, setDriveSyncError]); 
  
  const updateUserProfile = useCallback(async (updatedProfileData: Partial<UserProfile>): Promise<boolean> => {
    if (!currentUser) {
      showErrorNotification(tForProvider('profileSaveError'), 5000);
      return false;
    }
    
    const updatedUser: UserProfile = {
      ...currentUser,
      name: updatedProfileData.name !== undefined ? updatedProfileData.name : currentUser.name,
      bio: updatedProfileData.bio !== undefined ? updatedProfileData.bio : currentUser.bio,
      // Keep existing stats, they are not updated here
      quizCount: currentUser.quizCount,
      completionCount: currentUser.completionCount,
      averageScore: currentUser.averageScore,
    };

    try {
      setCurrentUserInternal(updatedUser); // Update state, which triggers localStorage update via useEffect
      // No Drive sync for profile data implemented yet as per instruction.
      // If Drive sync were implemented for profile data, it would go here.
      // For now, local storage is the persistence layer.
      localStorage.setItem(LOCALSTORAGE_USER_KEY, JSON.stringify(updatedUser));

      showSuccessNotification(tForProvider('profileSaveSuccess'), 3000);
      logger.info("User profile updated successfully in AppContext.", 'UserProfile', { userId: updatedUser.id });
      return true;
    } catch (error) {
      logger.error('Error updating profile in AppContext:', 'UserProfile', { userId: currentUser.id }, error as Error);
      showErrorNotification(tForProvider('profileSaveError'), 5000);
      // Revert to previous state if saving to localStorage fails (though unlikely for localStorage)
      setCurrentUserInternal(currentUser); 
      return false;
    }
  }, [currentUser, setCurrentUserInternal, showSuccessNotification, showErrorNotification, tForProvider]);


  const syncWithGoogleDrive = useCallback(async () => {
    const nowMs = Date.now();
    if (nowMs - manualSyncAttemptLimitRef.current.lastWindowStart < 30000) { 
        manualSyncAttemptLimitRef.current.count++;
        if (manualSyncAttemptLimitRef.current.count > 3) { 
            logger.warn("syncWithGoogleDrive: Too many manual sync attempts in a short period. Aborting.", 'DriveSyncRateLimit');
            setDriveSyncError('driveErrorRateLimit');
            setIsLoading(false); setIsDriveLoading(false); setSyncState('error');
            return;
        }
    } else {
        manualSyncAttemptLimitRef.current.lastWindowStart = nowMs;
        manualSyncAttemptLimitRef.current.count = 1;
    }

    if (!currentUser?.accessToken) {
      setDriveSyncError('driveErrorNoToken');
      logger.warn('Manual sync: No access token.', 'DriveSync');
      return;
    }
    
    setIsLoading(true); 
    setIsDriveLoading(true);
    setDriveSyncError(null); 
    setSyncState('syncing');
    setCurrentSyncActivityMessage(tForProvider('syncStatusInProgress')); 
    logger.info("Manual sync: Initiated.", 'DriveSync');
    
    try {
      const driveQuizzesPromise = loadQuizDataFromDrive(currentUser.accessToken);
      const localQuizzesPromise = quizStorage.getAllQuizzes();
      
      const [driveQuizzes, localQuizzes] = await Promise.all([driveQuizzesPromise, localQuizzesPromise]);
      
      let quizzesToSaveToDrive: Quiz[];

      if (driveQuizzes !== null) { 
        logger.info("Manual sync: Data found on Drive. Merging with local data.", 'DriveSync', { driveCount: driveQuizzes.length, localCount: localQuizzes.length });
        quizzesToSaveToDrive = mergeQuizzes(localQuizzes, driveQuizzes);
      } else { 
        logger.info("Manual sync: No data file on Drive. Using current local data.", 'DriveSync', { localCount: localQuizzes.length });
        quizzesToSaveToDrive = localQuizzes; 
      }
      
      setAllQuizzes(quizzesToSaveToDrive); 
      await quizStorage.saveQuizzes(quizzesToSaveToDrive);
      
      logger.info("Manual sync: Saving merged/current state to Google Drive...", 'DriveSync', { quizCount: quizzesToSaveToDrive.length});
      
      await saveQuizDataToDrive(currentUser.accessToken, quizzesToSaveToDrive);
      setLastDriveSync(new Date());
      localStorage.setItem(LOCALSTORAGE_DRIVE_SYNC_KEY, new Date().toISOString());
      logger.info("Manual sync: Successfully synced with Google Drive.", 'DriveSync');
      setSyncState('success');
      setCurrentSyncActivityMessage(tForProvider('syncCompleteMessage')); 
    } catch (error: any) {
      logger.error("Manual sync: Failed to sync with Google Drive:", 'DriveSync', { errorMsg: error.message }, error);
      const potentialKey = error.message as keyof typeof translations.en;
      const knownError = translations.en[potentialKey] ? potentialKey : 'driveErrorGeneric';
      setDriveSyncError(knownError);
    } finally {
      setIsDriveLoading(false);
      setIsLoading(false);
      setTimeout(() => { 
         if (syncState === 'success' || syncState === 'error') setCurrentSyncActivityMessage(null);
      }, 3000);
    }
  }, [currentUser?.accessToken, setDriveSyncError, tForProvider, syncState]);

  const quizzesForContext = useMemo(() => {
    return allQuizzes; 
  }, [allQuizzes]);
  
  const combinedIsLoading = isLoading || (appInitialized && currentUser && !lastDriveSync && isDriveLoading);

  const contextValue: AppContextType = useMemo(() => ({
    currentView: (location.pathname.substring(1) || 'home') as any, 
    setCurrentView, 
    language,
    setLanguage,
    quizzes: quizzesForContext,
    addQuiz,
    deleteQuiz,
    updateQuiz,
    getQuizByIdFromAll,
    activeQuiz,
    setActiveQuiz,
    quizResult,
    setQuizResult: setQuizResultWithPersistence,
    currentUser,
    login,
    logout: handleLogout, 
    updateUserProfile,
    isGeminiKeyAvailable,
    isLoading: combinedIsLoading,
    isDriveLoading,
    driveSyncError,
    lastDriveSync,
    syncWithGoogleDrive,
    setDriveSyncError,
    syncState,
    currentSyncActivityMessage,
  }), [
    location.pathname, setCurrentView, language, setLanguage, quizzesForContext, 
    addQuiz, deleteQuiz, updateQuiz, getQuizByIdFromAll, activeQuiz, setActiveQuiz, quizResult, 
    setQuizResultWithPersistence, currentUser, login, handleLogout, updateUserProfile, isGeminiKeyAvailable, combinedIsLoading,
    isDriveLoading, driveSyncError, lastDriveSync, syncWithGoogleDrive, setDriveSyncError, 
    syncState, currentSyncActivityMessage, appInitialized, 
  ]);

  if (!appInitialized) {
    return (
        <div style={{
            position: 'fixed', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'var(--color-bg-body)'
        }}>
            <svg className="animate-spin text-[var(--color-primary-accent)] w-14 h-14" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
              <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        </div>
    );
  }


  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};
AppProvider.displayName = "AppProvider";

const NavLink: React.FC<{ to: string; children: ReactNode; end?: boolean; className?: string; activeClassName?: string; inactiveClassName?: string; isMobile?: boolean; }> = 
({ to, children, end = false, className = '', activeClassName = '', inactiveClassName = '', isMobile = false }) => {
  const baseDesktopStyle = `px-3.5 py-2 rounded-lg text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-focus-ring-offset)] hover:bg-[var(--color-primary-accent)]/10 transition-colors var(--duration-fast) var(--ease-ios)`;
  const activeDesktopStyle = `text-[var(--color-primary-accent)] font-semibold border-b-2 border-[var(--color-primary-accent)] bg-[var(--color-primary-accent)]/15`; // Added background for active desktop
  const inactiveDesktopStyle = `text-[var(--color-text-secondary)] hover:text-[var(--color-primary-accent)] border-b-2 border-transparent hover:border-[var(--color-primary-accent)]/50`;

  const baseMobileStyle = `flex flex-col items-center justify-center h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-surface-2)] rounded-lg hover:bg-[var(--color-bg-surface-3)] active:bg-[var(--color-bg-surface-3)] transition-colors var(--duration-fast) var(--ease-ios) ${isMobile ? 'mobile-nav-item' : ''}`;
  const activeMobileStyle = `text-[var(--color-primary-accent)] font-semibold bg-[var(--color-mobile-nav-item-active-bg)] border-t-2 border-[var(--color-primary-accent)]`;
  const inactiveMobileStyle = `text-[var(--color-text-muted)] hover:text-[var(--color-primary-accent)] border-t-2 border-transparent`;


  return (
    <RouterNavLink
      to={to}
      end={end}
      className={({ isActive }) => 
        `${isMobile ? baseMobileStyle : baseDesktopStyle} ${className} 
         ${isActive 
            ? `active ${activeClassName || (isMobile ? activeMobileStyle : activeDesktopStyle)}`
            : (inactiveClassName || (isMobile ? inactiveMobileStyle : inactiveDesktopStyle))}`
      }
    >
      {children}
    </RouterNavLink>
  );
};
NavLink.displayName = "NavLink";

const UserDropdownMenu: React.FC = () => {
    const { currentUser, logout, setCurrentView } = useAppContext();
    const { t } = useTranslation();
    const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
    const userDropdownRef = useRef<HTMLDivElement>(null);
    const location = useLocation();
    const generalSettingsIconUrl = "https://img.icons8.com/?size=256&id=s5NUIabJrb4C&format=png"; 

    useEffect(() => {
        if (!isUserDropdownOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
                setIsUserDropdownOpen(false);
            }
        };
        const handleEscKey = (event: KeyboardEvent) => {
          if (event.key === 'Escape') {
            setIsUserDropdownOpen(false);
          }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscKey);
        return () => {
          document.removeEventListener('mousedown', handleClickOutside);
          document.removeEventListener('keydown', handleEscKey);
        };
    }, [isUserDropdownOpen]);

    if (!currentUser) return null;

    const isSettingsActive = location.pathname === '/settings';
    const isProfileActive = location.pathname === '/profile';


    return (
        <div className="relative" ref={userDropdownRef}>
            <button
                onClick={() => setIsUserDropdownOpen(prev => !prev)}
                className={`flex items-center p-1.5 sm:p-2 rounded-full focus-visible:ring-2 focus-visible:ring-[var(--color-primary-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-body)] group
                            ${isUserDropdownOpen ? 'bg-[var(--color-primary-accent)]/10 ring-2 ring-[var(--color-primary-accent)]' : ''}`}
                aria-label="User menu"
                aria-expanded={isUserDropdownOpen}
                aria-haspopup="true"
                aria-controls="user-dropdown-menu"
            >
                <UserAvatar
                  photoUrl={currentUser.imageUrl}
                  userName={currentUser.name}
                  size="sm" 
                  className={`border-2 ${isUserDropdownOpen ? 'border-[var(--color-primary-accent)]' : 'border-[var(--color-border-interactive)] group-hover:border-[var(--color-primary-accent)]'} transition-colors var(--duration-fast) var(--ease-ios)`}
                />
                <ChevronDownIcon className={`w-4 h-4 ml-1 text-[var(--color-text-muted)] transition-transform var(--duration-fast) var(--ease-ios) ${isUserDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            <div
                id="user-dropdown-menu"
                role="menu"
                className={`absolute right-0 mt-3 w-64 sm:w-72 bg-[var(--color-bg-surface-1)] border border-[var(--color-border-default)] rounded-xl shadow-2xl py-2 z-50 origin-top-right
                            ${isUserDropdownOpen ? 'dropdown-animation-active pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}
            >
                <div className="px-5 py-4 border-b border-[var(--color-border-default)]">
                    <div className="flex items-center gap-3">
                        <UserAvatar
                          photoUrl={currentUser.imageUrl}
                          userName={currentUser.name}
                          size="md" 
                          className="border-2 border-[var(--color-border-interactive)]"
                        />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate mb-0.5" title={currentUser.name || undefined}>{currentUser.name || t('user')}</p>
                            <p className="text-xs text-[var(--color-text-secondary)] truncate" title={currentUser.email || undefined}>{currentUser.email}</p>
                        </div>
                    </div>
                </div>
                <div className="py-2">
                    <button
                        onClick={() => { setCurrentView('/profile'); setIsUserDropdownOpen(false); }}
                        className={`w-full text-left px-5 py-3.5 text-sm hover:bg-[var(--color-bg-surface-2)] active:bg-[var(--color-bg-surface-3)] flex items-center transition-colors var(--duration-fast) var(--ease-ios)
                                    ${isProfileActive ? 'bg-[var(--color-primary-accent)]/20 text-[var(--color-primary-accent)]' : 'text-[var(--color-text-body)] hover:text-[var(--color-primary-accent)]'}`}
                        role="menuitem"
                    >
                        <UserCircleIcon className="w-4 h-4 mr-3 flex-shrink-0" />
                        {t('profile')}
                    </button>
                    <button
                        onClick={() => { setCurrentView('/settings'); setIsUserDropdownOpen(false); }}
                        className={`w-full text-left px-5 py-3.5 text-sm hover:bg-[var(--color-bg-surface-2)] active:bg-[var(--color-bg-surface-3)] flex items-center transition-colors var(--duration-fast) var(--ease-ios) group
                                    ${isSettingsActive ? 'bg-[var(--color-primary-accent)]/20 text-[var(--color-primary-accent)]' : 'text-[var(--color-text-body)] hover:text-[var(--color-primary-accent)]'}`}
                        role="menuitem"
                    >
                        <img 
                            src={generalSettingsIconUrl} 
                            alt={t('navSettings')} 
                            className="w-4 h-4 mr-3 flex-shrink-0 group-hover:rotate-12 transition-transform var(--duration-normal) var(--ease-ios)" 
                        />
                        {t('navSettings')}
                    </button>
                    <ThemeToggleSwitch />
                    <div className="h-px bg-[var(--color-border-default)] my-2 mx-5"></div>
                    <button
                        onClick={() => { logout(); setIsUserDropdownOpen(false); }}
                        className="w-full text-left px-5 py-3.5 text-sm text-[var(--color-danger-accent)] hover:bg-[var(--color-danger-accent)]/15 active:bg-[var(--color-danger-accent)]/25 flex items-center hover:text-[var(--color-danger-accent)] transition-colors var(--duration-fast) var(--ease-ios)"
                        role="menuitem"
                    >
                        <LogoutIcon className="w-4 h-4 mr-3 flex-shrink-0" />
                        {t('logout')}
                    </button>
                </div>
            </div>
        </div>
    );
};
UserDropdownMenu.displayName = "UserDropdownMenu";

const AnimatedApiKeyWarning: React.FC<{children: ReactNode}> = ({ children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isVisible = useIntersectionObserver(ref, { threshold: 0.1, freezeOnceVisible: true });
  
  return (
    <div 
      ref={ref} 
      className={isVisible ? 'animate-page-slide-fade-in' : 'opacity-0'}
    >
      {children}
    </div>
  );
};
AnimatedApiKeyWarning.displayName = "AnimatedApiKeyWarning";

const RouteLoadingFallback: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center h-[calc(100vh-200px)]"> 
      <LoadingSpinner size="lg" text={t('loading')} /> 
    </div>
  );
};
RouteLoadingFallback.displayName = "RouteLoadingFallback";


const AppLayout: React.FC = () => {
  const { 
    language, setLanguage, currentUser, isGeminiKeyAvailable, 
    isLoading: globalIsLoading, isDriveLoading, driveSyncError, 
    lastDriveSync, setDriveSyncError, syncState, currentSyncActivityMessage,
    logout, setCurrentView
  } = useAppContext(); 
  const { t } = useTranslation();
  const { theme } = useTheme(); 
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileProfileOpen, setIsMobileProfileOpen] = useState(false);
  const generalSettingsIconUrl = "https://img.icons8.com/?size=256&id=s5NUIabJrb4C&format=png"; 
  
  const apiKeyWarnings = [];
  if (!isGeminiKeyAvailable) {
    apiKeyWarnings.push("Google Gemini API Key (process.env.GEMINI_API_KEY)");
  }
  
  const appInitialized = true; 
  if (globalIsLoading && !appInitialized) { 
    return (
      <div className="fixed inset-0 bg-[var(--color-bg-body)] flex items-center justify-center z-[200]">
        <LoadingSpinner text={currentUser?.accessToken && isDriveLoading && !lastDriveSync && syncState === 'syncing' ? (currentSyncActivityMessage || t('initialSyncMessage')) : t('loading')} size="xl" />
      </div>
    );
  }

  const SyncStatusIndicator: React.FC = () => {
    const { language: currentLang } = useTranslation(); 
    let icon = null;
    let text = "";
    let tooltipText = "";
    let baseClasses = "text-xs font-medium flex items-center";
    let colorClasses = ""; 
    let showIndicator = false;

    switch (syncState) {
        case 'syncing':
            showIndicator = true;
            icon = <RefreshIcon className="w-3.5 h-3.5 mr-1.5 animate-spin" />;
            text = currentSyncActivityMessage || t('syncStatusInProgressShort'); 
            colorClasses = "text-[var(--color-primary-accent)]";
            tooltipText = currentSyncActivityMessage || t('syncStatusInProgress');
            break;
        case 'success':
            showIndicator = true;
            icon = <CheckCircleIcon className="w-3.5 h-3.5 mr-1.5" />;
            colorClasses = "text-[var(--color-success-accent)]";
             if (currentSyncActivityMessage) { 
                text = currentSyncActivityMessage;
                tooltipText = currentSyncActivityMessage;
            } else if (lastDriveSync) {
                 text = t('syncStatusLastShort', { dateTime: lastDriveSync.toLocaleTimeString(currentLang, { hour: '2-digit', minute: '2-digit'}) });
                 tooltipText = t('syncStatusLast', { dateTime: lastDriveSync.toLocaleString(currentLang, { dateStyle: 'medium', timeStyle: 'short' }) });
            } else {
                text = t('syncStatusSuccessShort');
                tooltipText = t('syncStatusSuccess');
            }
            break;
        case 'error':
            showIndicator = true;
            icon = <XCircleIcon className="w-3.5 h-3.5 mr-1.5" />;
            colorClasses = "text-[var(--color-danger-accent)]";
            text = t('syncStatusErrorShort');
            tooltipText = driveSyncError || t('driveErrorGeneric');
            break;
        case 'idle':
        default:
            if (currentUser && lastDriveSync) {
                 showIndicator = true;
                 icon = <CheckCircleIcon className="w-3.5 h-3.5 mr-1.5 text-[var(--color-text-muted)]" />;
                 colorClasses = "text-[var(--color-text-muted)]";
                 text = t('syncStatusLastShort', { dateTime: lastDriveSync.toLocaleTimeString(currentLang, { hour: '2-digit', minute: '2-digit'}) });
                 tooltipText = t('syncStatusLast', { dateTime: lastDriveSync.toLocaleString(currentLang, { dateStyle: 'medium', timeStyle: 'short' }) });
            } else if (currentUser) { 
                showIndicator = true;
                icon = <InformationCircleIcon className="w-3.5 h-3.5 mr-1.5 text-[var(--color-text-muted)]" />;
                colorClasses = "text-[var(--color-text-muted)]";
                text = t('syncStatusNeverShort');
                tooltipText = t('syncStatusNever');
            } else { 
                return null; 
            }
            break;
    }
    if (!currentUser) return null;

    return (
        <Tooltip content={tooltipText} placement="bottom-end">
          <div className={`${baseClasses} ${colorClasses} px-2 py-1 rounded-md bg-[var(--color-bg-surface-2)] border border-[var(--color-border-default)] sync-indicator-base ${showIndicator ? 'sync-indicator-visible' : 'sync-indicator-hidden'}`}>
            {icon}
            <span>{text}</span>
          </div>
        </Tooltip>
    );
  };

  const MobileProfileSheet: React.FC = () => {
    const sheetId = useId(); 
    const { t } = useTranslation(); 
    const { logout, setCurrentView, currentUser } = useAppContext();

    if (!currentUser || !isMobileProfileOpen) return null;
    
    const swipeHandlers = useSwipeable({
      onSwipedDown: () => setIsMobileProfileOpen(false),
      preventScrollOnSwipe: true,
      trackMouse: false,
    });

    return (
      <>
        <div 
            className={`fixed inset-0 z-[199] transition-opacity var(--duration-normal) var(--ease-ios) ${isMobileProfileOpen ? 'modal-backdrop-enhanced open' : 'opacity-0 pointer-events-none'}`}
            onClick={() => setIsMobileProfileOpen(false)}
            aria-hidden="true"
        />
        <div 
          {...swipeHandlers}
          className={`fixed bottom-0 left-0 right-0 z-[200] w-full max-w-md mx-auto bg-[var(--color-bg-surface-1)] border-t border-x border-[var(--color-border-default)] rounded-t-2xl shadow-2xl 
                     transition-transform var(--duration-normal) var(--ease-ios) ${isMobileProfileOpen ? 'mobile-sheet-enter-active' : 'mobile-sheet-enter'}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${sheetId}-title`}
          style={{maxHeight: '85vh', overflowY: 'auto'}}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1.5 bg-[var(--color-bg-surface-3)] rounded-full"></div>
          </div>
          <div className="px-5 py-6 flex items-center space-x-4 border-b border-[var(--color-border-default)]">
            <UserAvatar
              photoUrl={currentUser.imageUrl}
              userName={currentUser.name}
              size="lg" 
              className="border-2 border-[var(--color-primary-accent)]"
            />
            <div className="flex-1 min-w-0">
              <h2 id={`${sheetId}-title`} className="text-xl font-semibold text-[var(--color-text-primary)] truncate mb-1">{currentUser.name || t('user')}</h2>
              <p className="text-sm text-[var(--color-text-secondary)] truncate" title={currentUser.email || undefined}>{currentUser.email}</p>
            </div>
          </div>
          <div className="py-4 divide-y divide-[var(--color-border-default)]">
            <div className="px-5 py-2 space-y-1">
                <h3 className="text-xs uppercase text-[var(--color-text-muted)] font-semibold tracking-wider mb-2">{t('account')}</h3>
                <button
                  onClick={() => { setCurrentView('/profile'); setIsMobileProfileOpen(false); }}
                  className="w-full text-left px-4 py-3.5 text-base text-[var(--color-text-body)] hover:bg-[var(--color-bg-surface-2)] active:bg-[var(--color-bg-surface-3)] flex items-center rounded-lg transition-colors var(--duration-fast) var(--ease-ios)"
                >
                  <UserCircleIcon className="w-5 h-5 mr-3.5 flex-shrink-0" />
                  {t('profile')}
                </button>
                <button
                  onClick={() => { setCurrentView('/settings'); setIsMobileProfileOpen(false); }}
                  className="w-full text-left px-4 py-3.5 text-base text-[var(--color-text-body)] hover:bg-[var(--color-bg-surface-2)] active:bg-[var(--color-bg-surface-3)] flex items-center rounded-lg transition-colors var(--duration-fast) var(--ease-ios)"
                >
                   <img 
                      src={generalSettingsIconUrl} 
                      alt={t('navSettings')} 
                      className="w-5 h-5 mr-3.5 flex-shrink-0" 
                    />
                  {t('navSettings')}
                  <div className="ml-auto flex items-center">
                    <span className="bg-[var(--color-primary-accent)]/20 text-[var(--color-primary-accent)] text-xs px-2 py-0.5 rounded-full">{t('new')}</span>
                  </div>
                </button>
                <ThemeToggleSwitch className="!px-4 !py-3.5 !text-base"/>
            </div>
            <div className="px-5 py-2">
                <button
                  onClick={() => { logout(); setIsMobileProfileOpen(false); }}
                  className="w-full text-left px-4 py-3.5 text-base text-[var(--color-danger-accent)] hover:bg-[var(--color-danger-accent)]/15 active:bg-[var(--color-danger-accent)]/25 flex items-center rounded-lg transition-colors var(--duration-fast) var(--ease-ios)"
                >
                  <LogoutIcon className="w-5 h-5 mr-3.5 flex-shrink-0" />
                  {t('logout')}
                </button>
            </div>
          </div>
          <div className="px-5 py-4 border-t border-[var(--color-border-default)] mt-2">
            <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-[var(--color-text-muted)]">{t('appVersion')} 1.0.0</p>
                <p className="text-xs text-[var(--color-text-muted)]">© {new Date().getFullYear()} {t('appName')}</p>
            </div>
            <Button
              variant="secondary"
              onClick={() => setIsMobileProfileOpen(false)}
              className="w-full py-3.5 rounded-lg !text-[var(--color-text-primary)] text-center font-medium"
            >
              {t('close')}
            </Button>
          </div>
        </div>
      </>
    );
  };
  MobileProfileSheet.displayName = "MobileProfileSheet";
  
  return (
    <div className="min-h-screen flex flex-col selection:bg-[var(--color-primary-accent)]/20 selection:text-[var(--color-primary-accent)] pb-16 md:pb-0"
         style={{ backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-body)' }}>
      <header className="glass-effect sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-[72px]">
            <div className="flex items-center space-x-2 sm:space-x-3 cursor-pointer group" onClick={() => navigate('/')}>
              <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-primary-accent)] tracking-tight transition-colors var(--duration-fast) var(--ease-ios)">
                {APP_NAME} 
              </h1>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-3">
              <nav className="hidden md:flex items-center space-x-1">
                 <NavLink to="/" end>{t('navHome')}</NavLink>
                <NavLink to="/dashboard">{t('navDashboard')}</NavLink>
                <NavLink to="/create">{t('navCreateQuiz')}</NavLink>
              </nav>
              
              {currentUser && <SyncStatusIndicator />}

              {!currentUser && (
                <ThemeToggle compact={true} />
              )}

              <Tooltip content={t('languageSwitcherTooltip')} placement="bottom">
                <Button 
                    variant="ghost" 
                    size="md"
                    className="!p-2 sm:!p-2.5 !text-[var(--color-text-secondary)] hover:!text-[var(--color-primary-accent)] hover:!bg-[var(--color-primary-accent)]/10 rounded-lg"
                    onClick={() => setLanguage(language === 'en' ? 'vi' : 'en')}
                    aria-label={language === 'en' ? "Switch to Vietnamese" : "Switch to English"}
                >
                    <img src="https://img.icons8.com/?size=48&id=fs8AdHsHlO36&format=png" alt="Language" className="w-5 h-5" />
                    <span className="ml-1.5 sm:ml-2 text-xs font-semibold uppercase hidden lg:inline">{language}</span>
                </Button>
              </Tooltip>

              {currentUser ? (
                <UserDropdownMenu />
              ) : (
                <Button 
                    variant="primary" 
                    size="sm" 
                    onClick={() => navigate('/signin')}
                    className="font-semibold shadow-lg hover:shadow-[var(--color-primary-accent)]/30 py-2 px-4 sm:px-5 rounded-lg"
                >
                    {t('signIn')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 mobile-nav-style z-40 flex justify-around items-stretch h-16">
          <NavLink to="/" end isMobile>
            <HomeIcon className="w-5 h-5 mb-1"/> <span className="text-xs font-medium">{t('navHome')}</span>
          </NavLink>
          <NavLink to="/dashboard" isMobile>
            <ChartBarIcon className="w-5 h-5 mb-1"/> <span className="text-xs font-medium">{t('navDashboard')}</span>
          </NavLink>
          <NavLink to="/create" isMobile>
            <PlusCircleIcon className="w-5 h-5 mb-1"/> <span className="text-xs font-medium">{t('navCreateQuiz')}</span>
          </NavLink>
          
           {currentUser && (
            <NavLink to="/profile" isMobile>
              <UserCircleIcon className="w-5 h-5 mb-1"/> <span className="text-xs font-medium">{t('profile')}</span>
            </NavLink>
          )}
        </nav>

      <main key={location.pathname} className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 md:py-10 mb-20 md:mb-0"> 
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/signin" element={<SignInPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/create" element={<QuizCreatePage />} />
            <Route path="/review" element={<QuizReviewPage />} /> 
            <Route path="/review/:quizId" element={<QuizReviewPage />} />
            <Route path="/quiz/:quizId" element={<QuizTakingPage />} />
            <Route path="/practice/:quizId" element={<QuizPracticePage />} />
            <Route path="/results/:quizId" element={<ResultsPage />} />
            <Route path="/settings" element={currentUser ? <SyncSettingsPage /> : <Navigate to="/signin" state={{ from: location }} replace />} />
            <Route path="/profile" element={currentUser ? <ProfilePage /> : <Navigate to="/signin" state={{ from: location }} replace />} />
            <Route path="*" element={<HomePage />} /> 
          </Routes>
        </Suspense>
      </main>

      <footer className="bg-transparent py-4 md:py-6 mt-auto">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-4 md:mb-5 space-x-3 sm:space-x-4 text-center">
            <a href="#" className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary-accent)] transition-colors var(--duration-fast) var(--ease-ios)">{t('footerTerms')}</a>
            <a href="#" className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary-accent)] transition-colors var(--duration-fast) var(--ease-ios)">{t('footerPrivacy')}</a>
            <a href="#" className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary-accent)] transition-colors var(--duration-fast) var(--ease-ios)">{t('footerFAQ')}</a>
          </div>

          <div className="pt-4 md:pt-5 border-t border-[var(--color-border-default)]">
            <p className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3 sm:mb-3 text-center">{t('footerContactUs')}</p> 
            <div className="flex justify-center items-center space-x-3 sm:space-x-4">
              <Tooltip content="Facebook" placement="top">
                <a href="https://www.facebook.com/boboiboy.gala.7/" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-[var(--color-text-muted)] hover:text-[var(--color-primary-accent)] transition-colors var(--duration-fast) var(--ease-ios)">
                  <img src="https://img.icons8.com/?size=256&id=uLWV5A9vXIPu&format=png" alt="Facebook" className="w-5 h-5"/>
                </a>
              </Tooltip>
              <Tooltip content="TikTok" placement="top">
                <a href="https://www.tiktok.com/@teosushi1014" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="text-[var(--color-text-muted)] hover:text-[var(--color-primary-accent)] transition-colors var(--duration-fast) var(--ease-ios)">
                   <img src="https://img.icons8.com/?size=256&id=118640&format=png" alt="TikTok" className="w-5 h-5"/>
                </a>
              </Tooltip>
              <Tooltip content="YouTube" placement="top">
                <a href="https://www.youtube.com/@TeoSushi1014" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="text-[var(--color-text-muted)] hover:text-[var(--color-primary-accent)] transition-colors var(--duration-fast) var(--ease-ios)">
                   <img src="https://img.icons8.com/?size=256&id=19318&format=png" alt="YouTube" className="w-5 h-5"/>
                </a>
              </Tooltip>
              <Tooltip content={t('footerGmail')} placement="top">
                <a href="mailto:teosushi1014@gmail.com" aria-label={t('footerGmail')} className="text-[var(--color-text-muted)] hover:text-[var(--color-primary-accent)] transition-colors var(--duration-fast) var(--ease-ios)">
                  <img src="https://img.icons8.com/?size=256&id=P7UIlhbpWzZm&format=png" alt="Gmail" className="w-5 h-5"/>
                </a>
              </Tooltip>
            </div>
          </div>
          
          <p className="text-xs text-[var(--color-text-muted)]/70 mt-6 md:mt-8 text-center">{t('footerRights', {year: new Date().getFullYear(), appName: APP_NAME})}</p>
        </div>
      </footer>
      
      {apiKeyWarnings.length > 0 && (
         <AnimatedApiKeyWarning>
            <div role="alert" className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 w-auto max-w-[calc(100%-2rem)] bg-amber-500 text-amber-950 p-3 sm:p-3.5 text-xs sm:text-sm shadow-2xl z-[200] flex items-center justify-center gap-2.5 border border-amber-400/50 rounded-xl">
                <KeyIcon className="w-4 h-4 sm:w-5 sm:h-5 text-amber-950 flex-shrink-0" strokeWidth={2}/>
                <strong className="font-semibold">{t('apiKeyWarningTitle')}:</strong> 
                <span className="text-amber-950/90">{t('apiKeyWarningMissing', {keys: apiKeyWarnings.join(', ')})} {t('apiKeyWarningFunctionality')}</span>
            </div>
        </AnimatedApiKeyWarning>
      )}

      {driveSyncError && syncState === 'error' && ( 
         <AnimatedApiKeyWarning>
            <div role="alert" className="fixed bottom-20 md:bottom-4 right-4 w-auto max-w-[calc(100%-2rem)] md:max-w-md bg-[var(--color-danger-accent)] text-[var(--color-primary-accent-text)] p-3 sm:p-3.5 text-xs sm:text-sm shadow-2xl z-[200] flex items-center gap-2.5 border border-[var(--color-danger-accent)]/50 rounded-xl">
                <InformationCircleIcon className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--color-primary-accent-text)] flex-shrink-0" />
                <strong className="font-semibold">{t('error')}:</strong> 
                <span className="text-[var(--color-primary-accent-text)]/90">{driveSyncError}</span>
                 <Button variant="ghost" size="xs" onClick={() => setDriveSyncError(null)} className="!p-1 !text-[var(--color-primary-accent-text)]/90 hover:!text-white hover:!bg-black/20 -mr-1">
                    <XCircleIcon className="w-4 h-4"/>
                </Button>
            </div>
        </AnimatedApiKeyWarning>
      )}
      {currentUser && isMobileProfileOpen && <MobileProfileSheet /> } 
    </div>
  );
};
AppLayout.displayName = "AppLayout";

const App: React.FC = () => {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <HashRouter>
        <AppProvider>
          <ErrorBoundary>
            <AppLayout />
          </ErrorBoundary>
        </AppProvider>
      </HashRouter>
    </GoogleOAuthProvider>
  );
};
App.displayName = "App";

export default App;