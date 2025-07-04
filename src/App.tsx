import React, { useState, useCallback, useEffect, createContext, useContext, ReactNode, useMemo, useRef, lazy, Suspense, useId, RefObject } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation, NavLink as RouterNavLink, Navigate } from 'react-router-dom'; 
import { GoogleOAuthProvider, googleLogout, TokenResponse } from '@react-oauth/google';
import { useSwipeable } from 'react-swipeable';
import { Quiz, AppContextType, Language, QuizResult, UserProfile, SyncState } from './types';
import { APP_NAME, KeyIcon, LogoutIcon, HomeIcon, PlusCircleIcon, ChartBarIcon, SettingsIconMobileNav, InformationCircleIcon, XCircleIcon, RefreshIcon, CheckCircleIcon, ChevronDownIcon, UserCircleIcon, PlusIcon } from './constants'; 
import { Button, LoadingSpinner, Tooltip } from './components/ui';
import { UserAvatar } from './components/UserAvatar'; 
import ErrorBoundary from './components/ErrorBoundary'; 
import { getTranslator, translations } from './i18n';
import useIntersectionObserver from './hooks/useIntersectionObserver';
import { authService } from './services/authService'; 
import { ThemeToggle, ThemeToggleSwitch } from './components/ThemeToggle'; 
import { useNotification } from './hooks/useNotification';
import { supabaseService } from './services/supabaseService';
import { logger } from './services/logService';
import { migrateLocalDataToSupabase, checkMigrationNeeded } from './utils/migrationUtils';
import './styles/markdown.css';
import 'github-markdown-css/github-markdown.css';
import './styles/markdown-custom.css';
import './styles/markdown-github.css';

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
const SharedQuizPage = lazy(() => import('./features/quiz/SharedQuizPage')); 

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
const LOCALSTORAGE_USER_KEY = 'quizai_currentUser_v2';
const LOCALSTORAGE_LANGUAGE_KEY = 'appLanguage';
const LOCALSTORAGE_DRIVE_SYNC_KEY = 'driveLastSyncTimestamp';
const LOCALSTORAGE_QUIZ_RESULT_KEY = 'quizResult';
const LOCALSTORAGE_AUTH_TOKEN_KEY = 'quizai_accessToken_v2';
const LOCALSTORAGE_AUTH_EXPIRY_KEY = 'quizai_accessTokenExpiry_v2';


const SYNC_CONFIG = {
  BACKGROUND_SYNC: true,
  QUIET_SUCCESS: true,
  DEBOUNCE_BACKGROUND_SYNC_MS: 1000,
  DEBOUNCE_FOREGROUND_SYNC_MS: 3000, 
  MIN_SYNC_INTERVAL_MS: 10000,
  AUTO_SYNC_ATTEMPT_WINDOW_MS: 60000,
  AUTO_SYNC_ATTEMPT_LIMIT: 5,
  MANUAL_SYNC_ATTEMPT_WINDOW_MS: 30000,
  MANUAL_SYNC_ATTEMPT_LIMIT: 3,
  MESSAGE_DISPLAY_DURATION_MS: 2000,
  MAX_RETRIES: 3, 
  RETRY_DELAY_MS: 3000, 
  QUIET_ERRORS: true, 
};


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
  const [appInitialized, setAppInitialized] = useState(false);
  const [initializationStarted, setInitializationStarted] = useState(false);

  const [isDriveLoading, setIsDriveLoading] = useState(false);
  const [driveSyncError, setDriveSyncErrorState] = useState<string | null>(null);
  const [lastDriveSync, setLastDriveSync] = useState<Date | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [currentSyncActivityMessage, setCurrentSyncActivityMessage] = useState<string | null>(null);
  
  const [isDriveSyncEnabled, setIsDriveSyncEnabled] = useState(() => {
    const saved = localStorage.getItem('driveSyncEnabled');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [driveSyncMode, setDriveSyncModeState] = useState<'auto' | 'manual' | 'backup-only'>(() => {
    const saved = localStorage.getItem('driveSyncMode');
    return (saved as 'auto' | 'manual' | 'backup-only') || 'backup-only';
  });
  
  const saveToDriveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveToDriveMinIntervalRef = useRef(0);
  const autoSyncAttemptLimitRef = useRef({ count: 0, lastWindowStart: 0 });
  const manualSyncAttemptLimitRef = useRef({ count: 0, lastWindowStart: 0 }); 
  
  const tForProvider = useMemo(() => getTranslator(language), [language]);
  const { showSuccess: showSuccessNotification, showError: showErrorNotification } = useNotification();


  const setCurrentUser = useCallback((user: UserProfile | null, tokenInfo?: { token: string; expires_in: number }) => {
    if (user) {
        const userWithDefaults: UserProfile = {
            ...user,
            bio: user.bio || null,
            quizCount: user.quizCount || 0,
            completionCount: user.completionCount || 0,
            averageScore: user.averageScore || null,
            accessToken: tokenInfo?.token || user.accessToken, 
        };
        setCurrentUserInternal(userWithDefaults);
        localStorage.setItem(LOCALSTORAGE_USER_KEY, JSON.stringify(userWithDefaults));
        if (tokenInfo) {
          localStorage.setItem(LOCALSTORAGE_AUTH_TOKEN_KEY, tokenInfo.token);
          const expiryTime = new Date().getTime() + (tokenInfo.expires_in * 1000); 
          localStorage.setItem(LOCALSTORAGE_AUTH_EXPIRY_KEY, expiryTime.toString());
        } else if (user.accessToken) { 
          localStorage.setItem(LOCALSTORAGE_AUTH_TOKEN_KEY, user.accessToken);
          const existingExpiry = localStorage.getItem(LOCALSTORAGE_AUTH_EXPIRY_KEY);
          if (!existingExpiry) { 
             const expiryTime = new Date().getTime() + (3600 * 1000);
             localStorage.setItem(LOCALSTORAGE_AUTH_EXPIRY_KEY, expiryTime.toString());
          }
        }
        logger.setUserId(userWithDefaults.id);
        logger.info('User logged in or updated', 'AuthContext', { userId: userWithDefaults.id, email: userWithDefaults.email, hasPhotoUrl: !!userWithDefaults.imageUrl });
    } else {
        setCurrentUserInternal(null);
        localStorage.removeItem(LOCALSTORAGE_USER_KEY);
        localStorage.removeItem(LOCALSTORAGE_AUTH_TOKEN_KEY);
        localStorage.removeItem(LOCALSTORAGE_AUTH_EXPIRY_KEY);
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

  // Drive sync settings callbacks
  const setDriveSyncEnabled = useCallback((enabled: boolean) => {
    setIsDriveSyncEnabled(enabled);
    localStorage.setItem('driveSyncEnabled', JSON.stringify(enabled));
    logger.info(`Drive sync ${enabled ? 'enabled' : 'disabled'}`, 'DriveSettings');
  }, []);

  const setDriveSyncMode = useCallback((mode: 'auto' | 'manual' | 'backup-only') => {
    setDriveSyncModeState(mode);
    localStorage.setItem('driveSyncMode', mode);
    logger.info(`Drive sync mode changed to: ${mode}`, 'DriveSettings');
  }, []);

  const isTokenStillValid = useCallback(() => {
    const expiryTimeStr = localStorage.getItem(LOCALSTORAGE_AUTH_EXPIRY_KEY);
    if (!expiryTimeStr) return false;
    const expiryTime = parseInt(expiryTimeStr, 10);
    return new Date().getTime() < expiryTime;
  }, []);


  useEffect(() => {
    const initializeApp = async () => {
        if (initializationStarted) {
            return; // Remove excessive logging
        }
        
        setInitializationStarted(true);
        
        const savedLanguage = localStorage.getItem(LOCALSTORAGE_LANGUAGE_KEY) as Language | null;
        if (savedLanguage && translations[savedLanguage]) {
            setLanguageState(savedLanguage);
        }

        const savedUserJson = localStorage.getItem(LOCALSTORAGE_USER_KEY);
        const savedToken = localStorage.getItem(LOCALSTORAGE_AUTH_TOKEN_KEY);

        if (savedToken && isTokenStillValid()) {
            try {
                const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${savedToken}` },
                });
                if (userInfoResponse.ok) {
                    const userInfo = await userInfoResponse.json();
                    const pictureUrl = userInfo.picture ? 
                      userInfo.picture.replace(/=s\d+-c$/, '=s256-c') : 
                      userInfo.picture;
                    
                    const googleUserInfo = {
                        sub: userInfo.sub,
                        email: userInfo.email,
                        name: userInfo.name,
                        picture: pictureUrl,
                        access_token: savedToken
                    };
                    
                    const authenticatedUser = await authService.signInWithGoogle(googleUserInfo);
                    
                    if (authenticatedUser) {
                        const locallyStoredUser = savedUserJson ? JSON.parse(savedUserJson) as Partial<UserProfile> : {};
                        const userWithToken = {
                            ...authenticatedUser,
                            accessToken: savedToken,
                            bio: authenticatedUser.bio || locallyStoredUser.bio || null,
                            quizCount: authenticatedUser.quizCount || locallyStoredUser.quizCount || 0,
                            completionCount: authenticatedUser.completionCount || locallyStoredUser.completionCount || 0,
                            averageScore: authenticatedUser.averageScore || locallyStoredUser.averageScore || null,
                        };
                        setCurrentUser(userWithToken);
                    } else {
                        setCurrentUser(null);
                    }
                } else {
                    setCurrentUser(null);
                }
            } catch (e) {
                logger.error("Error restoring session with token", 'AppInit', undefined, e as Error);
                setCurrentUser(null);
            }
        } else if (savedUserJson && !savedToken) {
            setCurrentUser(null);
        }

        const savedResultJson = localStorage.getItem(LOCALSTORAGE_QUIZ_RESULT_KEY);
        if (savedResultJson) {
            try { setQuizResult(JSON.parse(savedResultJson) as QuizResult); }
            catch (e) {
                logger.error("Failed to parse quiz result from localStorage", 'AppInit', undefined, e as Error);
                localStorage.removeItem(LOCALSTORAGE_QUIZ_RESULT_KEY);
            }
        }

        const lastSyncTimestamp = localStorage.getItem(LOCALSTORAGE_DRIVE_SYNC_KEY);
        if (lastSyncTimestamp) setLastDriveSync(new Date(lastSyncTimestamp));

        const migrateDriveSyncSettings = () => {
          const hasExistingDriveSync = !!lastSyncTimestamp;
          const hasSettingsConfigured = localStorage.getItem('driveSyncEnabled') !== null;
          
          if (hasExistingDriveSync && !hasSettingsConfigured) {
            setIsDriveSyncEnabled(true);
            setDriveSyncModeState('auto');
            localStorage.setItem('driveSyncEnabled', 'true');
            localStorage.setItem('driveSyncMode', 'auto');
          }
        };
        
        migrateDriveSyncSettings();

        setAppInitialized(true);
    };
    initializeApp();
  }, [setCurrentUser, isTokenStillValid]); 

  useEffect(() => {
    if (!appInitialized) return;

    const loadInitialQuizzesAndSync = async () => {
      setIsLoading(true);
      setDriveSyncError(null);
      
      try {
        const localQuizzes = await quizStorage.getAllQuizzes();
        setAllQuizzes(localQuizzes);
        setIsLoading(false);
        
        if (currentUser?.accessToken) {
          syncInBackground(localQuizzes);
        }
      } catch (error) {
        logger.error('Error loading initial quizzes', 'QuizLoading', undefined, error as Error);
        setIsLoading(false);
        setAllQuizzes([]);
      }
    };

    const syncInBackground = async (localQuizzes: Quiz[]) => {
      setIsDriveLoading(true);
      setSyncState('syncing');
      setCurrentSyncActivityMessage(tForProvider('initialSyncMessage'));
      
      try {
        const supabaseQuizzes = await supabaseService.getUserQuizzes(currentUser!.id);
        
        const mergedAfterSupabase = mergeQuizzes(localQuizzes, supabaseQuizzes);
        setAllQuizzes(mergedAfterSupabase);
        await quizStorage.saveQuizzes(mergedAfterSupabase);
        
        if (isDriveSyncEnabled) {
          try {
            const driveQuizzes = await loadQuizDataFromDrive(currentUser!.accessToken);
            
            if (driveQuizzes !== null) {
              const finalMerged = mergeQuizzes(mergedAfterSupabase, driveQuizzes);
              setAllQuizzes(finalMerged);
              await quizStorage.saveQuizzes(finalMerged);
              
              saveQuizDataToDrive(currentUser!.accessToken, finalMerged).catch(error => {
                logger.warn('Background Drive save failed', 'DriveSync', undefined, error as Error);
              });
              
              localStorage.setItem(LOCALSTORAGE_DRIVE_SYNC_KEY, new Date().toISOString());
              setLastDriveSync(new Date());
            }
          } catch (driveError) {
            logger.warn('Drive sync failed during background load', 'DriveSync', undefined, driveError as Error);
          }
        }
        
        setSyncState('idle');
        setCurrentSyncActivityMessage(null);
        
      } catch (error) {
        logger.error('Background sync failed', 'QuizLoading', undefined, error as Error);
        setSyncState('error');
        setDriveSyncError('driveErrorGeneric');
      } finally {
        setIsDriveLoading(false);
      }
    };

    loadInitialQuizzesAndSync();
  }, [appInitialized, currentUser?.id, currentUser?.accessToken, tForProvider, isDriveSyncEnabled]);


  const triggerSaveToDrive = useCallback((quizzesToSave: Quiz[]) => {
    if (!isDriveSyncEnabled || driveSyncMode === 'manual') {
      logger.debug("triggerSaveToDrive: Skipping - Drive sync disabled or manual mode", 'DriveSync', { 
        enabled: isDriveSyncEnabled, 
        mode: driveSyncMode 
      });
      return;
    }

    if (Date.now() - saveToDriveMinIntervalRef.current < SYNC_CONFIG.MIN_SYNC_INTERVAL_MS) {
      logger.debug("triggerSaveToDrive: Skipping schedule, too soon since last save.", 'DriveSync');
      return;
    }
  
    if (saveToDriveTimeoutRef.current) {
      clearTimeout(saveToDriveTimeoutRef.current);
    }
    
    saveToDriveTimeoutRef.current = setTimeout(async () => {
      saveToDriveMinIntervalRef.current = Date.now();
  
      const now = Date.now();
      if (now - autoSyncAttemptLimitRef.current.lastWindowStart < SYNC_CONFIG.AUTO_SYNC_ATTEMPT_WINDOW_MS) {
        autoSyncAttemptLimitRef.current.count++;
        if (autoSyncAttemptLimitRef.current.count > SYNC_CONFIG.AUTO_SYNC_ATTEMPT_LIMIT) {
          logger.warn("triggerSaveToDrive: Auto-sync rate limit reached", 'DriveSyncRateLimit');
          if (!SYNC_CONFIG.BACKGROUND_SYNC) {
            setIsDriveLoading(false);
            setSyncState('error');
            setDriveSyncError('driveErrorRateLimit');
          }
          return;
        }
      } else {
        autoSyncAttemptLimitRef.current.lastWindowStart = now;
        autoSyncAttemptLimitRef.current.count = 1;
      }
  
      if (currentUser?.accessToken) {
        let retries = 0;
        let success = false;
        
        if (!SYNC_CONFIG.BACKGROUND_SYNC) {
          setIsDriveLoading(true);
          setSyncState('syncing');
          setCurrentSyncActivityMessage(tForProvider('syncStatusInProgress'));
        }
        setDriveSyncError(null);
        logger.info(`${SYNC_CONFIG.BACKGROUND_SYNC ? 'Background' : 'Debounced'} sync: Attempting to save to Google Drive...`, 'DriveSync', { quizCount: quizzesToSave.length });

        while(retries < SYNC_CONFIG.MAX_RETRIES && !success) {
            try {
              await saveQuizDataToDrive(currentUser.accessToken, quizzesToSave);
              setLastDriveSync(new Date());
              localStorage.setItem(LOCALSTORAGE_DRIVE_SYNC_KEY, new Date().toISOString());
              logger.info(`${SYNC_CONFIG.BACKGROUND_SYNC ? 'Background' : 'Debounced'} sync: Successfully saved to Google Drive.`, 'DriveSync');
              setSyncState('success');
              success = true;
              
              if (!SYNC_CONFIG.BACKGROUND_SYNC || !SYNC_CONFIG.QUIET_SUCCESS) {
                setCurrentSyncActivityMessage(tForProvider('autoSyncCompleteMessage'));
              } else {
                setCurrentSyncActivityMessage(null); 
              }
              break; 
            } catch (error: any) {
              retries++;
              const errorKey = error.message as keyof typeof translations.en;
              const isSpecificError = translations.en[errorKey];
              const currentErrorToSet = isSpecificError ? errorKey : 'driveErrorSaving';

              logger.error(`${SYNC_CONFIG.BACKGROUND_SYNC ? 'Background' : 'Debounced'} sync: Failed attempt ${retries}/${SYNC_CONFIG.MAX_RETRIES}.`, 'DriveSync', { errorMsg: error.message }, error);

              if (retries >= SYNC_CONFIG.MAX_RETRIES) {
                logger.error(`${SYNC_CONFIG.BACKGROUND_SYNC ? 'Background' : 'Debounced'} sync: Max retries reached. Failed to save.`, 'DriveSync', { errorMsg: error.message });
                if (!SYNC_CONFIG.QUIET_ERRORS || !SYNC_CONFIG.BACKGROUND_SYNC) {
                  setSyncState('error');
                  setDriveSyncError(currentErrorToSet);
                }
              } else {
                if (currentErrorToSet === 'driveErrorUnauthorized' || currentErrorToSet === 'driveErrorForbidden') {
                   if (!SYNC_CONFIG.QUIET_ERRORS || !SYNC_CONFIG.BACKGROUND_SYNC) {
                     setSyncState('error');
                     setDriveSyncError(currentErrorToSet);
                   }
                   break; 
                }
                if (!SYNC_CONFIG.BACKGROUND_SYNC || !SYNC_CONFIG.QUIET_ERRORS) {
                  setCurrentSyncActivityMessage(tForProvider('retryingSync', { attempt: retries, maxAttempts: SYNC_CONFIG.MAX_RETRIES }));
                }
                await new Promise(r => setTimeout(r, SYNC_CONFIG.RETRY_DELAY_MS * Math.pow(2, retries -1) )); 
              }
            }
        } 
  
        if (!SYNC_CONFIG.BACKGROUND_SYNC || (!success && !SYNC_CONFIG.QUIET_ERRORS) ) {
          setTimeout(() => {
            if (syncState === 'success' || syncState === 'error') { 
              setCurrentSyncActivityMessage(null);
            }
          }, SYNC_CONFIG.MESSAGE_DISPLAY_DURATION_MS);
        }
        if (!SYNC_CONFIG.BACKGROUND_SYNC) {
          setIsDriveLoading(false); 
        }

      }
    }, SYNC_CONFIG.BACKGROUND_SYNC ? SYNC_CONFIG.DEBOUNCE_BACKGROUND_SYNC_MS : SYNC_CONFIG.DEBOUNCE_FOREGROUND_SYNC_MS);
  }, [currentUser?.accessToken, setDriveSyncError, tForProvider, syncState, isDriveSyncEnabled, driveSyncMode]);


  useEffect(() => {
    if (appInitialized && !isLoading && currentUser?.accessToken && allQuizzes.length >= 0) {
        triggerSaveToDrive(allQuizzes);
    }
  }, [allQuizzes, appInitialized, isLoading, currentUser?.accessToken, triggerSaveToDrive]);
  
  useEffect(() => {
    if (appInitialized) { 
      if (currentUser) {
      } else {
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
    if (!currentUser) {
      throw new Error('User must be logged in to create quizzes')
    }

    const now = new Date().toISOString();
    const quizWithOwnerAndTimestamp = { 
      ...quiz, 
      userId: currentUser.id,
      createdAt: quiz.createdAt || now, 
      lastModified: now,
    };

    // Save to Supabase
    const savedQuiz = await supabaseService.createQuiz(quizWithOwnerAndTimestamp, currentUser.id)
    
    if (savedQuiz) {
      setAllQuizzes(prev => [savedQuiz, ...prev.filter(q => q.id !== quiz.id)])
      logger.info('Quiz added to Supabase and context state', 'AppContext', { quizId: quiz.id, title: quiz.title })
      
      try {
        const allQuizzes = await supabaseService.getUserQuizzes(currentUser.id)
        await quizStorage.saveQuizzes(allQuizzes)
        logger.info('Quiz saved to local storage as backup', 'AppContext', { quizId: quiz.id })
      } catch (e) {
        logger.warn('Failed to save backup to localStorage', 'AppContext', { quizId: quiz.id }, e as Error)
      }
    } else {
      throw new Error('Failed to save quiz to database')
    }
  }, [currentUser]);

  const deleteQuiz = useCallback(async (quizId: string): Promise<void> => {
    if (!currentUser) {
      throw new Error('User must be logged in to delete quizzes')
    }

    const success = await supabaseService.deleteQuiz(quizId)
    
    if (success) {
      setAllQuizzes(prev => prev.filter(q => q.id !== quizId))
      logger.info('Quiz deleted from Supabase and context state', 'AppContext', { quizId })
      
      try {
        const remainingQuizzes = await supabaseService.getUserQuizzes(currentUser.id)
        await quizStorage.saveQuizzes(remainingQuizzes)
        logger.info('Local storage updated after quiz deletion', 'AppContext', { quizId })
      } catch (e) {
        logger.warn('Failed to update localStorage backup', 'AppContext', { quizId }, e as Error)
      }
    } else {
      throw new Error('Failed to delete quiz from database')
    }
  }, [currentUser]);

  const updateQuiz = useCallback(async (updatedQuiz: Quiz): Promise<void> => {
    if (!currentUser) {
      throw new Error('User must be logged in to update quizzes')
    }

    const now = new Date().toISOString();
    const quizWithTimestamp = {
      ...updatedQuiz,
      lastModified: now,
    };

    const updatedSupabaseQuiz = await supabaseService.updateQuiz(quizWithTimestamp)
    
    if (updatedSupabaseQuiz) {
      setAllQuizzes(prev => prev.map(q => q.id === quizWithTimestamp.id ? updatedSupabaseQuiz : q))
      logger.info('Quiz updated in Supabase and context state', 'AppContext', { quizId: updatedQuiz.id, title: updatedQuiz.title })
      
      try {
        const allQuizzes = await supabaseService.getUserQuizzes(currentUser.id)
        await quizStorage.saveQuizzes(allQuizzes)
        logger.info('Local storage updated after quiz update', 'AppContext', { quizId: updatedQuiz.id })
      } catch (e) {
        logger.warn('Failed to update localStorage backup', 'AppContext', { quizId: updatedQuiz.id }, e as Error)
      }
    } else {
      throw new Error('Failed to update quiz in database')
    }
  }, [currentUser]);

  const getQuizByIdFromAll = useCallback((id: string): Quiz | null => {
    return allQuizzes.find(q => q.id === id) || null;
  }, [allQuizzes]);

  const setQuizResultWithPersistence = useCallback((result: QuizResult | null) => {
    setQuizResult(result);
  }, []);

  const login = useCallback(async (user: UserProfile, tokenResponse?: TokenResponse): Promise<UserProfile | null> => { 
    logger.info('Login initiated with Supabase integration', 'AuthContext', { userId: user.id })
    
    try {
      // Sign in with Supabase using Google user info
      const googleUserInfo = {
        sub: user.id, // This is Google ID
        email: user.email,
        name: user.name,
        picture: user.imageUrl,
        access_token: tokenResponse?.access_token || user.accessToken
      }
      
      const authenticatedUser = await authService.signInWithGoogle(googleUserInfo)
      
      if (authenticatedUser) {
        // IMPORTANT: Use the Supabase UUID, not the Google ID
        let tokenInfo: { token: string; expires_in: number } | undefined = undefined;
        if (tokenResponse) {
            tokenInfo = {
                token: tokenResponse.access_token,
                expires_in: (typeof (tokenResponse as any).expires_in === 'number') ? (tokenResponse as any).expires_in : 3600,
            };
        }
        
        const userWithTokenAndDefaults: UserProfile = {
            ...authenticatedUser, // This includes the correct Supabase UUID as .id
            accessToken: tokenInfo?.token || authenticatedUser.accessToken || user.accessToken, 
            bio: authenticatedUser.bio || null,
            quizCount: authenticatedUser.quizCount || 0,
            completionCount: authenticatedUser.completionCount || 0,
            averageScore: authenticatedUser.averageScore || null,
        };
        
        setCurrentUser(userWithTokenAndDefaults, tokenInfo); 
        setDriveSyncError(null); 
        setSyncState('idle'); 
        setCurrentSyncActivityMessage(null);

        // Check if migration is needed and perform it
        try {
          const migrationNeeded = await checkMigrationNeeded(userWithTokenAndDefaults)
          if (migrationNeeded) {
            logger.info('Starting data migration from localStorage to Supabase', 'Migration')
            await migrateLocalDataToSupabase(userWithTokenAndDefaults)
            logger.info('Data migration completed successfully', 'Migration')
          }
        } catch (migrationError) {
          logger.error('Migration failed, but login continues', 'Migration', {}, migrationError as Error)
        }

        logger.info('User logged in successfully with Supabase', 'AuthContext', { userId: userWithTokenAndDefaults.id })
        return userWithTokenAndDefaults
      } else {
        throw new Error('Failed to authenticate with Supabase')
      }
    } catch (error) {
      logger.error('Login failed', 'AuthContext', {}, error as Error)
      throw error
    }
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
    
    try {
      const updatedUser = await supabaseService.updateUser(currentUser.id, updatedProfileData)
      
      if (updatedUser) {
        const userWithToken: UserProfile = {
          ...updatedUser,
          accessToken: currentUser.accessToken,
        }
        
        setCurrentUserInternal(userWithToken); 
        localStorage.setItem(LOCALSTORAGE_USER_KEY, JSON.stringify(userWithToken)); 
        showSuccessNotification(tForProvider('profileSaveSuccess'), 3000);
        logger.info("User profile updated successfully in Supabase and AppContext.", 'UserProfile', { userId: userWithToken.id });
        return true;
      } else {
        throw new Error('Failed to update user profile in Supabase')
      }
    } catch (error) {
      logger.error('Error updating profile in Supabase and AppContext:', 'UserProfile', { userId: currentUser.id }, error as Error);
      showErrorNotification(tForProvider('profileSaveError'), 5000);
      return false;
    }
  }, [currentUser, setCurrentUserInternal, showSuccessNotification, showErrorNotification, tForProvider]);


  const syncWithGoogleDrive = useCallback(async () => {
    if (!isDriveSyncEnabled) {
      logger.info('Manual sync skipped: Drive sync is disabled', 'DriveSync');
      showErrorNotification('Drive sync is currently disabled in settings');
      return;
    }

    const nowMs = Date.now();
    if (nowMs - manualSyncAttemptLimitRef.current.lastWindowStart < SYNC_CONFIG.MANUAL_SYNC_ATTEMPT_WINDOW_MS) { 
        manualSyncAttemptLimitRef.current.count++;
        if (manualSyncAttemptLimitRef.current.count > SYNC_CONFIG.MANUAL_SYNC_ATTEMPT_LIMIT) { 
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
      }, SYNC_CONFIG.MESSAGE_DISPLAY_DURATION_MS);
    }
  }, [currentUser?.accessToken, setDriveSyncError, tForProvider, syncState, isDriveSyncEnabled, showErrorNotification]);

  const quizzesForContext = useMemo(() => {
    return allQuizzes; 
  }, [allQuizzes]);
  
  const combinedIsLoading = Boolean(isLoading || (appInitialized && currentUser && !lastDriveSync && isDriveLoading));

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
    isLoading: combinedIsLoading,
    isDriveLoading,
    driveSyncError,
    lastDriveSync,
    syncWithGoogleDrive,
    setDriveSyncError,
    syncState,
    currentSyncActivityMessage,
    isDriveSyncEnabled,
    setDriveSyncEnabled,
    driveSyncMode,
    setDriveSyncMode,
    showSuccessNotification,
    showErrorNotification,
  }), [
    location.pathname, setCurrentView, language, setLanguage, quizzesForContext, 
    addQuiz, deleteQuiz, updateQuiz, getQuizByIdFromAll, activeQuiz, setActiveQuiz, quizResult, 
    setQuizResultWithPersistence, currentUser, login, handleLogout, updateUserProfile, combinedIsLoading,
    isDriveLoading, driveSyncError, lastDriveSync, syncWithGoogleDrive, setDriveSyncError, 
    syncState, currentSyncActivityMessage, isDriveSyncEnabled, setDriveSyncEnabled, driveSyncMode, setDriveSyncMode,
    showSuccessNotification, showErrorNotification,
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

const NavLink: React.FC<{ to: string; children: ReactNode; end?: boolean; className?: string; activeClassName?: string; inactiveClassName?: string; isMobile?: boolean; icon?: ReactNode; }> = 
({ to, children, end = false, className = '', activeClassName = '', inactiveClassName = '', isMobile = false, icon }) => {
  const baseDesktopStyle = `flex items-center px-4 py-2 rounded-lg text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-focus-ring-offset)] hover:bg-[var(--color-bg-surface-2)] transition-colors var(--duration-fast) var(--ease-ios)`;
  const activeDesktopStyle = `bg-[var(--color-primary-accent)]/10 text-[var(--color-primary-accent)] font-medium`;
  const inactiveDesktopStyle = `text-[var(--color-text-secondary)] hover:text-[var(--color-primary-accent)]`;

  const baseMobileStyle = `flex flex-col items-center justify-center w-full h-full focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-bg-body)] rounded-md hover:bg-[var(--color-bg-surface-2)] transition-colors var(--duration-fast) var(--ease-ios)`;
  const activeMobileStyle = `text-[var(--color-primary-accent)]`;
  const inactiveMobileStyle = `text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]`;

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
      {icon && <span className={`items-center ${isMobile ? 'mb-0.5' : 'mr-2'}`}>{icon}</span>}
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
                className={`flex items-center space-x-2 p-0.5 rounded-full hover:bg-[var(--color-bg-surface-2)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-body)] group transition-colors var(--duration-fast) var(--ease-ios)
                            ${isUserDropdownOpen ? 'bg-[var(--color-primary-accent)]/10 ring-1 ring-[var(--color-primary-accent)]' : ''}`}
                aria-label="User menu"
                aria-expanded={isUserDropdownOpen}
                aria-haspopup="true"
                aria-controls="user-dropdown-menu"
            >
                <UserAvatar 
                  user={currentUser}
                  size="sm" 
                  className={`border-2 ${isUserDropdownOpen ? 'border-[var(--color-primary-accent)]' : 'border-[var(--color-border-interactive)] group-hover:border-[var(--color-primary-accent)]'} transition-colors var(--duration-fast) var(--ease-ios)`}
                />
                <ChevronDownIcon className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform var(--duration-fast) var(--ease-ios) ${isUserDropdownOpen ? 'rotate-180' : ''} hidden sm:block`} />
            </button>
            <div
                id="user-dropdown-menu"
                role="menu"
                className={`absolute right-0 mt-3 w-64 sm:w-72 bg-[var(--color-bg-surface-1)] border border-[var(--color-border-default)] rounded-xl shadow-2xl py-1 z-50 origin-top-right
                            ${isUserDropdownOpen ? 'dropdown-animation-active pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}
            >
                <div className="px-5 py-4 border-b border-[var(--color-border-default)]">
                    <div className="flex items-center gap-3">
                        <UserAvatar 
                          user={currentUser}
                          size="md" 
                          className="border-2 border-[var(--color-border-interactive)]"
                        />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate mb-0.5" title={currentUser.name || undefined}>{currentUser.name || t('user')}</p>
                            <p className="text-xs text-[var(--color-text-secondary)] truncate" title={currentUser.email || undefined}>{currentUser.email}</p>
                        </div>
                    </div>
                </div>
                
                <div className="py-1.5">
                    <div className="px-5 pt-2 pb-1 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">{t('account')}</div>
                    <button
                        onClick={() => { setCurrentView('/profile'); setIsUserDropdownOpen(false); }}
                        className={`w-full text-left px-5 py-3 text-sm hover:bg-[var(--color-bg-surface-2)] active:bg-[var(--color-bg-surface-3)] flex items-center transition-colors var(--duration-fast) var(--ease-ios)
                                    ${isProfileActive ? 'bg-[var(--color-primary-accent)]/20 text-[var(--color-primary-accent)] font-medium' : 'text-[var(--color-text-body)] hover:text-[var(--color-primary-accent)]'}`}
                        role="menuitem"
                    >
                        <UserCircleIcon className="w-4 h-4 mr-3 flex-shrink-0" />
                        {t('profile')}
                    </button>
                    <button
                        onClick={() => { setCurrentView('/settings'); setIsUserDropdownOpen(false); }}
                        className={`w-full text-left px-5 py-3 text-sm hover:bg-[var(--color-bg-surface-2)] active:bg-[var(--color-bg-surface-3)] flex items-center transition-colors var(--duration-fast) var(--ease-ios) group
                                    ${isSettingsActive ? 'bg-[var(--color-primary-accent)]/20 text-[var(--color-primary-accent)] font-medium' : 'text-[var(--color-text-body)] hover:text-[var(--color-primary-accent)]'}`}
                        role="menuitem"
                    >
                        <img 
                            src={generalSettingsIconUrl} 
                            alt={t('navSettings')} 
                            className="w-4 h-4 mr-3 flex-shrink-0 group-hover:rotate-12 transition-transform var(--duration-normal) var(--ease-ios)" 
                        />
                        {t('navSettings')}
                    </button>
                </div>

                <div className="py-1.5 border-t border-[var(--color-border-default)]">
                     <div className="px-5 pt-2 pb-1 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">{t('themeSettings')}</div>
                    <ThemeToggleSwitch />
                </div>
                
                <div className="py-1.5 border-t border-[var(--color-border-default)]">
                    <button
                        onClick={() => { logout(); setIsUserDropdownOpen(false); }}
                        className="w-full text-left px-5 py-3 text-sm text-[var(--color-danger-accent)] hover:bg-[var(--color-danger-accent)]/15 active:bg-[var(--color-danger-accent)]/25 flex items-center hover:text-[var(--color-danger-accent)] transition-colors var(--duration-fast) var(--ease-ios)"
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
  const isVisible = useIntersectionObserver(ref as RefObject<Element>, { threshold: 0.1, freezeOnceVisible: true });
  
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
    language, setLanguage, currentUser, 
    isLoading: globalIsLoading, isDriveLoading, driveSyncError, 
    lastDriveSync, setDriveSyncError, syncState, currentSyncActivityMessage
  } = useAppContext(); 
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileProfileOpen, setIsMobileProfileOpen] = useState(false);
  const generalSettingsIconUrl = "https://img.icons8.com/?size=256&id=s5NUIabJrb4C&format=png"; 
  
  const apiKeyWarnings: string[] = [];
  
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
    const { logout, syncWithGoogleDrive, driveSyncError, showSuccessNotification } = useAppContext(); 

    let icon: ReactNode = null;
    let text: string = "";
    let tooltipText: string = "";
    let containerColorClass: string = "";
    let dotColorClass: string = "";
    let showIndicator: boolean = false;
    let isErrorClickable = false;

    const getFriendlyErrorMessage = (errorKey: string | null): string => {
      if (!errorKey) return t('driveErrorGeneric'); 
      
      const knownErrorKey = errorKey as keyof typeof translations.en; 
      if (translations.en[knownErrorKey] && knownErrorKey.endsWith('Friendly')) {
          return t(knownErrorKey);
      }
      if (translations.en[knownErrorKey]) { 
          const friendlyVersionKey = `${knownErrorKey}Friendly` as keyof typeof translations.en;
          if (translations.en[friendlyVersionKey]) return t(friendlyVersionKey);
          
          if (errorKey === 'driveErrorUnauthorized') return t('driveErrorUnauthorizedFriendly');
          if (errorKey === 'driveErrorNetwork') return t('driveErrorNetworkFriendly');
          if (errorKey === 'driveErrorRateLimit') return t('driveErrorRateLimitFriendly');
          return t('syncErrorGenericFriendly'); 
      }
      return t('syncErrorGenericFriendly'); 
    };

    const handleErrorClick = () => {
      if (driveSyncError === 'driveErrorUnauthorized' || driveSyncError === 'driveErrorForbidden') {
        showSuccessNotification(t('sessionExpiredNotification'), 5000);
        logout(); 
      } else {
        syncWithGoogleDrive(); 
      }
    };

    switch (syncState) {
        case 'syncing':
            showIndicator = true;
            icon = <RefreshIcon className="w-3 h-3 mr-1.5 animate-spin" />;
            text = currentSyncActivityMessage || t('syncStatusInProgressShort'); 
            containerColorClass = "bg-[var(--color-primary-accent)]/10 text-[var(--color-primary-accent)] border-[var(--color-primary-accent)]/20";
            dotColorClass = "bg-[var(--color-primary-accent)]";
            tooltipText = currentSyncActivityMessage || t('syncStatusInProgress');
            break;
        case 'success':
            showIndicator = true;
            icon = <CheckCircleIcon className="w-3 h-3 mr-1.5" />;
            containerColorClass = "bg-[var(--color-success-accent)]/10 text-[var(--color-success-accent)] border-[var(--color-success-accent)]/20";
            dotColorClass = "bg-[var(--color-success-accent)]";
             if (currentSyncActivityMessage && (!SYNC_CONFIG.QUIET_SUCCESS || !SYNC_CONFIG.BACKGROUND_SYNC)) { 
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
            isErrorClickable = true;
            icon = <XCircleIcon className="w-3 h-3 mr-1.5" />;
            containerColorClass = "bg-[var(--color-danger-accent)]/10 text-[var(--color-danger-accent)] border-[var(--color-danger-accent)]/20 cursor-pointer hover:!bg-[var(--color-danger-accent)]/20";
            dotColorClass = "bg-[var(--color-danger-accent)]";
            tooltipText = getFriendlyErrorMessage(driveSyncError);
            text = t('syncStatusErrorShort'); 
            break;
        case 'idle':
        default:
            if (currentUser && lastDriveSync) {
                 showIndicator = true;
                 icon = <CheckCircleIcon className="w-3 h-3 mr-1.5" />;
                 containerColorClass = "bg-[var(--color-success-accent)]/10 text-[var(--color-success-accent)] border-[var(--color-success-accent)]/20"; 
                 dotColorClass = "bg-[var(--color-success-accent)]";
                 text = t('syncStatusLastShort', { dateTime: lastDriveSync.toLocaleTimeString(currentLang, { hour: '2-digit', minute: '2-digit'}) });
                 tooltipText = t('syncStatusLast', { dateTime: lastDriveSync.toLocaleString(currentLang, { dateStyle: 'medium', timeStyle: 'short' }) });
            } else if (currentUser) { 
                showIndicator = true;
                icon = <InformationCircleIcon className="w-3 h-3 mr-1.5" />;
                containerColorClass = "bg-[var(--color-bg-surface-2)] text-[var(--color-text-muted)] border-[var(--color-border-default)]"; 
                dotColorClass = "bg-[var(--color-text-muted)]";
                text = t('syncStatusNeverShort');
                tooltipText = t('syncStatusNever');
            } else { 
                return null; 
            }
            break;
    }
    if (!currentUser) return null;

    const indicatorContent = (
      <div 
        className={`text-xs font-medium flex items-center px-3 py-1.5 rounded-full border sync-indicator-base ${containerColorClass} ${showIndicator ? 'sync-indicator-visible' : 'sync-indicator-hidden'} ${isErrorClickable ? 'cursor-pointer' : ''}`}
        onClick={isErrorClickable ? handleErrorClick : undefined}
        tabIndex={isErrorClickable ? 0 : -1}
        role={isErrorClickable ? "button" : undefined}
        onKeyDown={isErrorClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleErrorClick(); } : undefined}
      >
        <div className={`w-1.5 h-1.5 rounded-full mr-2 ${dotColorClass} ${syncState === 'syncing' ? '' : 'animate-pulse'}`}></div>
        {icon}
        <span>{text}</span>
      </div>
    );
    
    return (
        <Tooltip content={tooltipText} placement="bottom-end" disabled={!tooltipText}>
          {indicatorContent}
        </Tooltip>
    );
  };

  const MobileProfileSheet: React.FC = () => {
    const sheetId = useId(); 
    const { t } = useTranslation(); 
    const { logout, setCurrentView, currentUser } = useAppContext();
    const [avatarSize, setAvatarSize] = useState<'md' | 'lg'>('lg');

    useEffect(() => {
        const updateSize = () => {
            setAvatarSize(window.innerWidth < 375 ? 'md' : 'lg'); 
        };
        window.addEventListener('resize', updateSize);
        updateSize(); 
        return () => window.removeEventListener('resize', updateSize);
    }, []);


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
              user={currentUser}
              size={avatarSize}
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
      <header className="sticky top-0 z-50 glass-effect"> 
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16"> 
            <div className="flex items-center space-x-2 sm:space-x-3 cursor-pointer" onClick={() => navigate('/')}>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-[var(--color-primary-accent)] to-blue-400 bg-clip-text text-transparent">
                {APP_NAME} 
              </h1>
            </div>

            <div className="hidden md:flex items-center space-x-3">
              <nav className="flex items-center space-x-1">
                 <NavLink to="/" end icon={<HomeIcon className="w-4 h-4"/>}>{t('navHome')}</NavLink>
                <NavLink to="/dashboard" icon={<ChartBarIcon className="w-4 h-4"/>}>{t('navDashboard')}</NavLink>
                <NavLink to="/create" icon={<PlusCircleIcon className="w-4 h-4"/>}>{t('navCreateQuiz')}</NavLink>
              </nav>
              
              {currentUser && <SyncStatusIndicator />}

              {!currentUser && ( <ThemeToggle compact={true} /> )}

              <Tooltip content={t('languageSwitcherTooltip')} placement="bottom">
                <Button 
                    variant="ghost" 
                    onClick={() => setLanguage(language === 'en' ? 'vi' : 'en')}
                    aria-label={language === 'en' ? "Switch to Vietnamese" : "Switch to English"}
                    className="!p-2 !w-9 !h-9 !rounded-full bg-[var(--color-bg-surface-2)] hover:!bg-[var(--color-bg-surface-3)] !text-[var(--color-text-secondary)] hover:!text-[var(--color-primary-accent)]"
                >
                    <img src="https://img.icons8.com/?size=48&id=fs8AdHsHlO36&format=png" alt="Language" className="w-5 h-5" />
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

            <div className="md:hidden flex items-center space-x-2">
               <Tooltip content={t('languageSwitcherTooltip')} placement="bottom">
                <Button 
                    variant="ghost" 
                    onClick={() => setLanguage(language === 'en' ? 'vi' : 'en')}
                    aria-label={language === 'en' ? "Switch to Vietnamese" : "Switch to English"}
                    className="!p-1.5 !w-8 !h-8 !rounded-full bg-[var(--color-bg-surface-2)] hover:!bg-[var(--color-bg-surface-3)] !text-[var(--color-text-secondary)] hover:!text-[var(--color-primary-accent)]"
                >
                    <img src="https://img.icons8.com/?size=48&id=fs8AdHsHlO36&format=png" alt="Language" className="w-5 h-5" />
                </Button>
              </Tooltip>
              {currentUser && (
                <button 
                    onClick={() => setIsMobileProfileOpen(true)}
                    className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-[var(--color-bg-surface-2)] transition-colors"
                    aria-label={t('profile')}
                >
                    <UserAvatar user={currentUser} size="sm" className="border-2 border-[var(--color-primary-accent)]"/>
                </button>
              )}
              {!currentUser && <ThemeToggle compact={true} />}
            </div>
          </div>
        </div>
      </header>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-effect z-40 border-t border-[var(--color-glass-border)]">
          <div className="flex items-center justify-around h-16">
            <NavLink to="/" end isMobile icon={<HomeIcon className="w-5 h-5"/>}>
                <span className="text-xs mt-0.5">{t('navHome')}</span>
            </NavLink>
            <NavLink to="/dashboard" isMobile icon={<ChartBarIcon className="w-5 h-5"/>}>
                <span className="text-xs mt-0.5">{t('navDashboard')}</span>
            </NavLink>
            
            <div className="relative -mt-5">
                <RouterNavLink 
                    to="/create"
                    className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-r from-[var(--color-primary-accent)] to-blue-400 text-white shadow-lg gradient-shift-bg hover:scale-105 active:scale-95 transition-transform var(--duration-fast) var(--ease-ios)"
                    aria-label={t('navCreateQuiz')}
                >
                    <PlusIcon className="w-7 h-7" strokeWidth={2.5} />
                </RouterNavLink>
            </div>

            <NavLink to="/settings" isMobile icon={<SettingsIconMobileNav className="w-5 h-5"/>}>
                <span className="text-xs mt-0.5">{t('navSettings')}</span>
            </NavLink>
            <NavLink to="/profile" isMobile icon={<UserCircleIcon className="w-5 h-5"/>}>
                <span className="text-xs mt-0.5">{t('profile')}</span>
            </NavLink>
          </div>
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
            <Route path="/shared/:quizId" element={<SharedQuizPage />} /> 
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

      {driveSyncError && syncState === 'error' && !SYNC_CONFIG.QUIET_ERRORS && ( 
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

const AppContent: React.FC = () => {
  const { t } = useTranslation();
  return (
    <ErrorBoundary t={t as (key: string) => string}>
      <AppLayout />
    </ErrorBoundary>
  );
};
AppContent.displayName = "AppContent";

const App: React.FC = () => {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <HashRouter>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </HashRouter>
    </GoogleOAuthProvider>
  );
};
App.displayName = "App";

export default App;
