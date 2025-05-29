
import React, { useState, useCallback, useEffect, createContext, useContext, ReactNode, useMemo, useRef } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation, NavLink as RouterNavLink } from 'react-router-dom';
import { GoogleOAuthProvider, googleLogout } from '@react-oauth/google';
import { Quiz, AppContextType, Language, QuizResult, UserProfile } from './types';
import { APP_NAME, UserCircleIcon, KeyIcon, LogoutIcon, HomeIcon, PlusCircleIcon, ChartBarIcon, SettingsIcon, InformationCircleIcon, XCircleIcon } from './constants'; 
import { Button, LoadingSpinner, Tooltip } from './components/ui';
import ErrorBoundary from './components/ErrorBoundary'; // Import ErrorBoundary
import { getTranslator, translations } from './i18n';
import useIntersectionObserver from './hooks/useIntersectionObserver';
import { logger } from './services/logService'; // Import logger

import HomePage from './features/quiz/HomePage';
import DashboardPage from './features/quiz/DashboardPage';
import QuizCreatePage from './features/quiz/QuizCreatePage';
import QuizTakingPage from './features/quiz/QuizTakingPage';
import ResultsPage from './features/quiz/ResultsPage';
import QuizReviewPage from './features/quiz/QuizReviewPage';
import SignInPage from './features/auth/SignInPage';
import QuizPracticePage from './features/quiz/QuizPracticePage';
import SyncSettingsPage from './features/settings/SyncSettingsPage';
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
  const saveToDriveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const tForProvider = useMemo(() => getTranslator(language), [language]);

  const setCurrentUser = useCallback((user: UserProfile | null) => {
    setCurrentUserInternal(user);
    logger.setUserId(user ? user.id : null);
    if (user) {
      logger.info('User logged in', 'AuthContext', { userId: user.id, email: user.email });
    } else {
      logger.info('User logged out', 'AuthContext');
    }
  }, []);

  const setDriveSyncError = useCallback((errorKey: string | null) => {
    if (errorKey === null) {
        setDriveSyncErrorState(null);
    } else {
        const errorMessage = tForProvider(errorKey as keyof typeof translations.en) || tForProvider('driveErrorGeneric');
        setDriveSyncErrorState(errorMessage);
        logger.warn(`Drive Sync Error set: ${errorMessage}`, 'DriveContext', { errorKey });
    }
  }, [tForProvider]);


  // Load initial data from localStorage and check API keys
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
      document.documentElement.lang = savedLanguage;
    } else {
      document.documentElement.lang = 'en'; 
    }
    
    const savedUserJson = localStorage.getItem(LOCALSTORAGE_USER_KEY);
    if (savedUserJson) {
      try {
        const user = JSON.parse(savedUserJson) as UserProfile;
        setCurrentUser(user); // Uses the new setCurrentUser with logging
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
  }, [setCurrentUser]); // Added setCurrentUser to dependency array

  // Effect for loading quizzes based on user state and app initialization
  useEffect(() => {
    if (!appInitialized) return;

    const loadInitialQuizzes = async () => {
      logger.info('Loading initial quizzes.', 'QuizLoading', { isLoggedIn: !!currentUser?.accessToken });
      setIsLoading(true);
      setDriveSyncError(null);

      if (currentUser?.accessToken) {
        setIsDriveLoading(true);
        try {
          logger.info("Attempting to load from Google Drive...", 'QuizLoading');
          const driveQuizzes = await loadQuizDataFromDrive(currentUser.accessToken);
          if (driveQuizzes !== null) { 
            setAllQuizzes(driveQuizzes);
            await quizStorage.saveQuizzes(driveQuizzes); 
            setLastDriveSync(new Date());
            localStorage.setItem(LOCALSTORAGE_DRIVE_SYNC_KEY, new Date().toISOString());
            logger.info("Successfully loaded quizzes from Google Drive and saved locally.", 'QuizLoading', { count: driveQuizzes.length });
            setDriveSyncError(null);
          } else { 
            logger.info("No quiz data file found on Google Drive. Checking local storage (via quizStorage).", 'QuizLoading');
            const localQuizzes = await quizStorage.getAllQuizzes();
            setAllQuizzes(localQuizzes);
            if (localQuizzes.length > 0) { 
                logger.info("Local data found, attempting to save to new Drive file.", 'QuizLoading', { count: localQuizzes.length });
                await saveQuizDataToDrive(currentUser.accessToken, localQuizzes);
                setLastDriveSync(new Date());
                localStorage.setItem(LOCALSTORAGE_DRIVE_SYNC_KEY, new Date().toISOString());
                logger.info("Successfully saved initial local data to Google Drive.", 'QuizLoading');
            }
            setDriveSyncError(null); 
          }
        } catch (error: any) {
          logger.error("Failed to load or init quizzes from Google Drive.", 'QuizLoading', { errorMsg: error.message }, error);
          setDriveSyncError(error.message as keyof typeof translations.en || 'driveErrorLoading');
          const localQuizzes = await quizStorage.getAllQuizzes(); 
          setAllQuizzes(localQuizzes);
        } finally {
          setIsDriveLoading(false);
        }
      } else { 
        const localQuizzes = await quizStorage.getAllQuizzes();
        setAllQuizzes(localQuizzes);
        logger.info("User not logged in or no access token, loaded from local storage (via quizStorage).", 'QuizLoading', { count: localQuizzes.length });
      }
      setIsLoading(false);
      logger.info('Initial quiz loading finished.', 'QuizLoading');
    };

    loadInitialQuizzes();
  }, [appInitialized, currentUser?.accessToken, setDriveSyncError]); 


  // Debounced save to Drive
  const triggerSaveToDrive = useCallback((quizzesToSave: Quiz[]) => {
    if (saveToDriveTimeoutRef.current) {
      clearTimeout(saveToDriveTimeoutRef.current);
    }
    saveToDriveTimeoutRef.current = setTimeout(async () => {
      if (currentUser?.accessToken) {
        setIsDriveLoading(true);
        setDriveSyncError(null);
        logger.info("Debounced: Attempting to save to Google Drive...", 'DriveSync', { quizCount: quizzesToSave.length });
        try {
          await saveQuizDataToDrive(currentUser.accessToken, quizzesToSave);
          setLastDriveSync(new Date());
          localStorage.setItem(LOCALSTORAGE_DRIVE_SYNC_KEY, new Date().toISOString());
          logger.info("Debounced: Successfully saved quizzes to Google Drive.", 'DriveSync');
        } catch (error: any) {
          logger.error("Debounced: Failed to save quizzes to Google Drive.", 'DriveSync', { errorMsg: error.message }, error);
          setDriveSyncError(error.message as keyof typeof translations.en || 'driveErrorSaving');
        } finally {
          setIsDriveLoading(false);
        }
      }
    }, 1500); 
  }, [currentUser?.accessToken, setDriveSyncError]);


  // Persist quizzes to localforage/localStorage and trigger Drive save
  useEffect(() => {
    if (appInitialized && !isLoading) { 
      quizStorage.saveQuizzes(allQuizzes); 
      if (currentUser?.accessToken) {
        triggerSaveToDrive(allQuizzes);
      }
    }
  }, [allQuizzes, appInitialized, isLoading, currentUser?.accessToken, triggerSaveToDrive]);
  
  // Persist user (including accessToken) to localStorage
  useEffect(() => {
    if (appInitialized) { 
      if (currentUser) {
        localStorage.setItem(LOCALSTORAGE_USER_KEY, JSON.stringify(currentUser));
      } else {
        localStorage.removeItem(LOCALSTORAGE_USER_KEY);
        localStorage.removeItem(LOCALSTORAGE_DRIVE_SYNC_KEY); 
        setLastDriveSync(null);
      }
    }
  }, [currentUser, appInitialized]);

  // Persist quizResult to localStorage
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
    document.documentElement.lang = lang; 
    logger.info(`Language changed to ${lang}`, 'AppContext');
  }, []);
  
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const navigate = useNavigate(); 

  const setCurrentView = useCallback((viewPath: string, _params?: Record<string, string | number>) => {
    navigate(viewPath);
  }, [navigate]);

  const addQuiz = useCallback((quiz: Quiz) => {
    const quizWithOwner = currentUser ? { ...quiz, userId: currentUser.id } : quiz;
    setAllQuizzes(prev => [quizWithOwner, ...prev]);
    logger.info('Quiz added', 'AppContext', { quizId: quiz.id, title: quiz.title });
  }, [currentUser]);

  const deleteQuiz = useCallback((quizId: string) => {
    setAllQuizzes(prev => prev.filter(q => q.id !== quizId));
    logger.info('Quiz deleted', 'AppContext', { quizId });
  }, []);

  const updateQuiz = useCallback((updatedQuiz: Quiz) => {
    setAllQuizzes(prev => prev.map(q => q.id === updatedQuiz.id ? updatedQuiz : q));
    logger.info('Quiz updated', 'AppContext', { quizId: updatedQuiz.id, title: updatedQuiz.title });
  }, []);

  const getQuizByIdFromAll = useCallback((id: string): Quiz | null => {
    return allQuizzes.find(q => q.id === id) || null;
  }, [allQuizzes]);

  const setQuizResultWithPersistence = useCallback((result: QuizResult | null) => {
    setQuizResult(result);
  }, []);

  const login = useCallback((user: UserProfile, token?: string) => {
    const userWithToken = token ? { ...user, accessToken: token } : user;
    setCurrentUser(userWithToken); // Uses the new setCurrentUser with logging
    setDriveSyncError(null); 
  }, [setCurrentUser, setDriveSyncError]); // Added setCurrentUser

  const handleLogout = useCallback(async () => { 
    logger.info('Logout initiated', 'AuthContext');
    googleLogout();
    if (saveToDriveTimeoutRef.current) {
      clearTimeout(saveToDriveTimeoutRef.current); 
    }
    setCurrentUser(null); // Uses the new setCurrentUser with logging
    setActiveQuiz(null); 
    setQuizResult(null);
    setAllQuizzes([]); 
    await quizStorage.saveQuizzes([]); 
    localStorage.removeItem(LOCALSTORAGE_QUIZ_RESULT_KEY);
    setDriveSyncError(null);
    navigate('/'); 
    logger.info('Logout complete', 'AuthContext');
  }, [navigate, setCurrentUser, setDriveSyncError]); // Added setCurrentUser
  
  const syncWithGoogleDrive = useCallback(async () => {
    if (!currentUser?.accessToken) {
      setDriveSyncError('driveErrorNoToken');
      logger.warn('Manual sync: No access token.', 'DriveSync');
      return;
    }
    setIsLoading(true); 
    setIsDriveLoading(true);
    setDriveSyncError(null);
    logger.info("Manual sync: Attempting to load from Google Drive...", 'DriveSync');
    try {
      const driveQuizzes = await loadQuizDataFromDrive(currentUser.accessToken);
      let quizzesToSaveToDrive: Quiz[];

      if (driveQuizzes !== null) { 
        logger.info("Manual sync: Data found on Drive. Merging strategy: Drive is source of truth.", 'DriveSync', { count: driveQuizzes.length});
        setAllQuizzes(driveQuizzes); 
        await quizStorage.saveQuizzes(driveQuizzes); 
        quizzesToSaveToDrive = driveQuizzes; 
      } else { 
        logger.info("Manual sync: No data file on Drive. Using current local data (via quizStorage).", 'DriveSync');
        const localQuizzes = await quizStorage.getAllQuizzes();
        setAllQuizzes(localQuizzes); 
        quizzesToSaveToDrive = localQuizzes; 
      }
      
      logger.info("Manual sync: Saving current state to Google Drive...", 'DriveSync', { quizCount: quizzesToSaveToDrive.length});
      await saveQuizDataToDrive(currentUser.accessToken, quizzesToSaveToDrive);
      setLastDriveSync(new Date());
      localStorage.setItem(LOCALSTORAGE_DRIVE_SYNC_KEY, new Date().toISOString());
      logger.info("Manual sync: Successfully synced with Google Drive.", 'DriveSync');
    } catch (error: any) {
      logger.error("Manual sync: Failed to sync with Google Drive:", 'DriveSync', { errorMsg: error.message }, error);
      const potentialKey = error.message as keyof typeof translations.en;
      if (translations.en[potentialKey]) { 
        setDriveSyncError(potentialKey);
      } else {
        setDriveSyncError('driveErrorGeneric');
      }
    } finally {
      setIsDriveLoading(false);
      setIsLoading(false);
    }
  }, [currentUser?.accessToken, setDriveSyncError]);

  const quizzesForContext = useMemo(() => {
    if (currentUser) {
      return allQuizzes.filter(q => q.userId === currentUser.id || !q.userId); 
    }
    return allQuizzes.filter(q => !q.userId);
  }, [allQuizzes, currentUser]);
  
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
    isGeminiKeyAvailable,
    isLoading: combinedIsLoading,
    isDriveLoading,
    driveSyncError,
    lastDriveSync,
    syncWithGoogleDrive,
    setDriveSyncError
  }), [
    location.pathname, setCurrentView, language, setLanguage, quizzesForContext, 
    addQuiz, deleteQuiz, updateQuiz, getQuizByIdFromAll, activeQuiz, setActiveQuiz, quizResult, 
    setQuizResultWithPersistence, currentUser, login, handleLogout, isGeminiKeyAvailable, combinedIsLoading,
    isDriveLoading, driveSyncError, lastDriveSync, syncWithGoogleDrive, setDriveSyncError, appInitialized
  ]);

  if (!appInitialized) {
    return <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-[300]"><LoadingSpinner size="xl" /></div>;
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

  const baseDesktopStyle = "px-3.5 py-2 rounded-lg text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 hover:bg-sky-400/10 transition-colors var(--duration-fast) var(--ease-ios)";
  const activeDesktopStyle = "bg-sky-400/20 text-sky-300 font-semibold";
  const inactiveDesktopStyle = "text-slate-300 hover:text-sky-300";

  const baseMobileStyle = "flex flex-col items-center justify-center h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 rounded-lg hover:bg-slate-500/10 transition-colors var(--duration-fast) var(--ease-ios)";
  const activeMobileStyle = "text-sky-300 font-semibold bg-sky-400/15";
  const inactiveMobileStyle = "text-slate-400 hover:text-sky-300";

  return (
    <RouterNavLink
      to={to}
      end={end}
      className={({ isActive }) => 
        `${isMobile ? baseMobileStyle : baseDesktopStyle} ${className} 
         ${isActive 
            ? (activeClassName || (isMobile ? activeMobileStyle : activeDesktopStyle)) 
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

    useEffect(() => {
        if (!isUserDropdownOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
                setIsUserDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isUserDropdownOpen]);

    if (!currentUser) return null;

    return (
        <div className="relative" ref={userDropdownRef}>
            <button
                onClick={() => setIsUserDropdownOpen(prev => !prev)}
                className="flex items-center p-1 rounded-full focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 group"
                aria-label="User menu"
                aria-expanded={isUserDropdownOpen}
                aria-haspopup="true"
            >
                {currentUser.imageUrl ? (
                    <img src={currentUser.imageUrl} alt={currentUser.name || "User"} className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 border-slate-600 group-hover:border-sky-300 transition-colors var(--duration-fast) var(--ease-ios)" />
                ) : (
                    <UserCircleIcon className="w-8 h-8 sm:w-9 sm:h-9 text-slate-400 group-hover:text-sky-300 transition-colors var(--duration-fast) var(--ease-ios)" />
                )}
            </button>
            <div
                className={`absolute right-0 mt-2.5 w-60 sm:w-64 glass-effect rounded-xl shadow-2xl py-2 z-50 origin-top-right
                            transition-all var(--duration-fast) var(--ease-ios)
                            ${isUserDropdownOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}
            >
                <div className="px-4 py-3 border-b border-slate-700/70">
                    <p className="text-sm font-semibold text-slate-100 truncate" title={currentUser.name || undefined}>{currentUser.name || t('untitledQuiz')}</p>
                    <p className="text-xs text-slate-400 truncate" title={currentUser.email || undefined}>{currentUser.email}</p>
                </div>
                <button
                    onClick={() => { setCurrentView('/settings'); setIsUserDropdownOpen(false); }}
                    className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-slate-700/60 flex items-center hover:text-sky-300 transition-colors var(--duration-fast) var(--ease-ios)"
                >
                    <SettingsIcon className="w-4 h-4 mr-2.5 flex-shrink-0" strokeWidth={2}/>
                    {t('navSettings')}
                </button>
                <button
                    onClick={() => { logout(); setIsUserDropdownOpen(false); }}
                    className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-400/15 flex items-center hover:text-red-300 transition-colors var(--duration-fast) var(--ease-ios)"
                >
                    <LogoutIcon className="w-4 h-4 mr-2.5 flex-shrink-0" />
                    {t('logout')}
                </button>
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

const AppLayout: React.FC = () => {
  const { language, setLanguage, currentUser, isGeminiKeyAvailable, isLoading: globalIsLoading, isDriveLoading, driveSyncError, lastDriveSync, setDriveSyncError } = useAppContext(); 
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  
  const apiKeyWarnings = [];
  if (!isGeminiKeyAvailable) {
    apiKeyWarnings.push("Google Gemini API Key (process.env.GEMINI_API_KEY)");
  }
  
  if (globalIsLoading) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-[200]">
        <LoadingSpinner text={currentUser?.accessToken && isDriveLoading && !lastDriveSync ? t('syncStatusInProgress') : t('loading')} size="xl" />
      </div>
    );
  }
  
  return (
    <div className={`min-h-screen flex flex-col bg-slate-900 selection:bg-sky-500/20 selection:text-sky-300 pb-16 md:pb-0`}>
      <header className="glass-effect sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-[72px]">
            <div className="flex items-center space-x-2 sm:space-x-3 cursor-pointer group" onClick={() => navigate('/')}>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-50 group-hover:text-sky-400 tracking-tight transition-colors var(--duration-fast) var(--ease-ios)">
                {APP_NAME} 
              </h1>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-3">
              <nav className="hidden md:flex items-center space-x-1">
                 <NavLink to="/" end>{t('navHome')}</NavLink>
                <NavLink to="/dashboard">{t('navDashboard')}</NavLink>
                <NavLink to="/create">{t('navCreateQuiz')}</NavLink>
                {currentUser && <NavLink to="/settings">{t('navSettings')}</NavLink>}
              </nav>
              
              <Tooltip content={language === 'en' ? "Change Language / Đổi Ngôn Ngữ" : "Đổi Ngôn Ngữ / Change Language"} placement="bottom">
                <Button 
                    variant="ghost" 
                    size="md"
                    className="!p-2 sm:!p-2.5 text-slate-300 hover:text-sky-400 hover:bg-sky-400/10 rounded-lg"
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
                    className="font-semibold shadow-lg hover:shadow-sky-400/30 py-2 px-4 sm:px-5 rounded-lg"
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
            <NavLink to="/settings" isMobile>
              <SettingsIcon className="w-5 h-5 mb-1" strokeWidth={2}/> <span className="text-xs font-medium">{t('navSettings')}</span>
            </NavLink>
          )}
        </nav>

      <main key={location.pathname} className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 md:py-10 mb-20 md:mb-0"> 
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
            <Route path="/settings" element={currentUser ? <SyncSettingsPage /> : <HomePage />} /> 
            <Route path="*" element={<HomePage />} /> 
          </Routes>
      </main>

      <footer className="bg-transparent py-4 md:py-6 mt-auto">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-4 md:mb-5 space-x-3 sm:space-x-4 text-center">
            <a href="#" className="text-xs text-slate-400 hover:text-sky-300 transition-colors var(--duration-fast) var(--ease-ios)">{t('footerTerms')}</a>
            <a href="#" className="text-xs text-slate-400 hover:text-sky-300 transition-colors var(--duration-fast) var(--ease-ios)">{t('footerPrivacy')}</a>
            <a href="#" className="text-xs text-slate-400 hover:text-sky-300 transition-colors var(--duration-fast) var(--ease-ios)">{t('footerFAQ')}</a>
          </div>

          <div className="pt-4 md:pt-5 border-t border-slate-700/50">
            <p className="text-sm font-semibold text-slate-300 mb-3 sm:mb-3 text-center">{t('footerContactUs')}</p> 
            <div className="flex justify-center items-center space-x-3 sm:space-x-4">
              <Tooltip content="Facebook" placement="top">
                <a href="https://www.facebook.com/boboiboy.gala.7/" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-slate-400 hover:text-sky-400 transition-colors var(--duration-fast) var(--ease-ios)">
                  <img src="https://img.icons8.com/?size=256&id=uLWV5A9vXIPu&format=png" alt="Facebook" className="w-5 h-5"/>
                </a>
              </Tooltip>
              <Tooltip content="TikTok" placement="top">
                <a href="https://www.tiktok.com/@teosushi1014" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="text-slate-400 hover:text-sky-400 transition-colors var(--duration-fast) var(--ease-ios)">
                   <img src="https://img.icons8.com/?size=256&id=118640&format=png" alt="TikTok" className="w-5 h-5"/>
                </a>
              </Tooltip>
              <Tooltip content="YouTube" placement="top">
                <a href="https://www.youtube.com/@TeoSushi1014" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="text-slate-400 hover:text-sky-400 transition-colors var(--duration-fast) var(--ease-ios)">
                   <img src="https://img.icons8.com/?size=256&id=19318&format=png" alt="YouTube" className="w-5 h-5"/>
                </a>
              </Tooltip>
              <Tooltip content={t('footerGmail')} placement="top">
                <a href="mailto:teosushi1014@gmail.com" aria-label={t('footerGmail')} className="text-slate-400 hover:text-sky-400 transition-colors var(--duration-fast) var(--ease-ios)">
                  <img src="https://img.icons8.com/?size=256&id=P7UIlhbpWzZm&format=png" alt="Gmail" className="w-5 h-5"/>
                </a>
              </Tooltip>
            </div>
          </div>
          
          <p className="text-xs text-slate-400/70 mt-6 md:mt-8 text-center">{t('footerRights', {year: new Date().getFullYear(), appName: APP_NAME})}</p>
        </div>
      </footer>
      
      {apiKeyWarnings.length > 0 && (
         <AnimatedApiKeyWarning>
            <div role="alert" className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 w-auto max-w-[calc(100%-2rem)] bg-amber-500 text-amber-50 p-3 sm:p-3.5 text-xs sm:text-sm shadow-2xl z-[200] flex items-center justify-center gap-2.5 border border-amber-400/50 rounded-xl">
                <KeyIcon className="w-4 h-4 sm:w-5 sm:h-5 text-amber-950 flex-shrink-0" strokeWidth={2}/>
                <strong className="font-semibold">{t('apiKeyWarningTitle')}:</strong> 
                <span className="text-amber-950/90">{t('apiKeyWarningMissing', {keys: apiKeyWarnings.join(', ')})} {t('apiKeyWarningFunctionality')}</span>
            </div>
        </AnimatedApiKeyWarning>
      )}

      {driveSyncError && (
         <AnimatedApiKeyWarning>
            <div role="alert" className="fixed bottom-20 md:bottom-4 right-4 w-auto max-w-[calc(100%-2rem)] md:max-w-md bg-red-600 text-white p-3 sm:p-3.5 text-xs sm:text-sm shadow-2xl z-[200] flex items-center gap-2.5 border border-red-500/50 rounded-xl">
                <InformationCircleIcon className="w-4 h-4 sm:w-5 sm:h-5 text-red-50 flex-shrink-0" />
                <strong className="font-semibold">{t('error')}:</strong> 
                <span className="text-red-100">{driveSyncError}</span>
                 <Button variant="ghost" size="xs" onClick={() => setDriveSyncError(null)} className="!p-1 text-red-100 hover:text-white hover:bg-red-500/20 -mr-1">
                    <XCircleIcon className="w-4 h-4"/>
                </Button>
            </div>
        </AnimatedApiKeyWarning>
      )}
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