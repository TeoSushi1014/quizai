import React, { useState, useCallback, useEffect, createContext, useContext, ReactNode, useMemo, useRef, lazy, Suspense, useId, RefObject } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation, NavLink as RouterNavLink, Navigate } from 'react-router-dom'; 
import { GoogleOAuthProvider, googleLogout, TokenResponse } from '@react-oauth/google';
import { useSwipeable } from 'react-swipeable';
import { Quiz, AppContextType, Language, QuizResult, UserProfile } from './types';
import { APP_NAME, KeyIcon, LogoutIcon, HomeIcon, PlusCircleIcon, ChartBarIcon, HistoryIcon, SettingsIconMobileNav, ChevronDownIcon, UserCircleIcon, PlusIcon } from './constants'; 
import { Button, LoadingSpinner, Tooltip, NotificationDisplay } from './components/ui';
import { UserAvatar } from './components/UserAvatar'; 
import ErrorBoundary from './components/ErrorBoundary'; 
import { getTranslator, translations } from './i18n';
import useIntersectionObserver from './hooks/useIntersectionObserver';
import useMarkdownPreloader from './hooks/useMarkdownPreloader';
import { authService } from './services/authService'; 
import { ThemeToggle, ThemeToggleSwitch } from './components/ThemeToggle'; 
import { useNotification } from './hooks/useNotification';
import { supabaseService } from './services/supabaseService';
import { supabase } from './services/supabaseClient';
import { logger } from './services/logService';
import { runMigrations } from './utils/migrationUtils';
import { secureConfig } from './services/secureConfigService';
import { maintenanceService } from './services/maintenanceService';
import { MaintenancePage } from './components/MaintenancePage';
import { adminService } from './services/adminService';
import GithubApiLimitWarning from './components/GithubApiLimitWarning';
import MarkdownPreviewTester from './components/MarkdownPreviewTester';
import TestMarkdown from './components/TestMarkdown';
import './styles/markdown.css';
import 'github-markdown-css/github-markdown.css';
import './styles/markdown-custom.css';
import './styles/markdown-github.css';
import { ThemeProvider } from './contexts/ThemeContext';

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
const SharedQuizPage = lazy(() => import(/* webpackChunkName: "shared-quiz" */ './features/quiz/SharedQuizPage')); 
const QuizHistoryPage = lazy(() => import('./features/quiz/QuizHistoryPage'));
const MyQuizzesPage = lazy(() => import('./features/quiz/MyQuizzesPage'));
const QuizAnalyticsPage = lazy(() => import('./features/quiz/QuizAnalyticsPage')); 
const MaintenanceAdmin = lazy(() => import('./components/admin/MaintenanceAdmin')); 

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

const LOCALSTORAGE_USER_KEY = 'quizai_currentUser_v2';
const LOCALSTORAGE_LANGUAGE_KEY = 'appLanguage';
const LOCALSTORAGE_QUIZ_RESULT_KEY = 'quizResult';
const LOCALSTORAGE_AUTH_TOKEN_KEY = 'quizai_accessToken_v2';
const LOCALSTORAGE_AUTH_EXPIRY_KEY = 'quizai_accessTokenExpiry_v2';


const mergeQuizzes = (localQuizzes: Quiz[], supabaseQuizzes: Quiz[]): Quiz[] => {
  const quizMap = new Map<string, Quiz>();

  [...localQuizzes, ...supabaseQuizzes].forEach(quiz => {
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
  return Array.from(quizMap.values());
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
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const authInProgressRef = useRef(false);
  
  const tForProvider = useMemo(() => getTranslator(language), [language]);
  const { 
    showSuccess: showSuccessNotification, 
    showError: showErrorNotification,
    notification,
    clearNotification
  } = useNotification();


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
        
        if (tokenInfo && !user.supabaseId) {
          localStorage.setItem(LOCALSTORAGE_AUTH_TOKEN_KEY, tokenInfo.token);
          const expiryTime = new Date().getTime() + (tokenInfo.expires_in * 1000); 
          localStorage.setItem(LOCALSTORAGE_AUTH_EXPIRY_KEY, expiryTime.toString());
        } else if (user.accessToken && !user.supabaseId) { 
          localStorage.setItem(LOCALSTORAGE_AUTH_TOKEN_KEY, user.accessToken);
          const existingExpiry = localStorage.getItem(LOCALSTORAGE_AUTH_EXPIRY_KEY);
          if (!existingExpiry) { 
             const expiryTime = new Date().getTime() + (3600 * 1000);
             localStorage.setItem(LOCALSTORAGE_AUTH_EXPIRY_KEY, expiryTime.toString());
          }
        } else if (user.supabaseId) {
          localStorage.removeItem(LOCALSTORAGE_AUTH_TOKEN_KEY);
          localStorage.removeItem(LOCALSTORAGE_AUTH_EXPIRY_KEY);
        }
        
        logger.setUserId(userWithDefaults.id);
    } else {
        setCurrentUserInternal(null);
        localStorage.removeItem(LOCALSTORAGE_USER_KEY);
        localStorage.removeItem(LOCALSTORAGE_AUTH_TOKEN_KEY);
        localStorage.removeItem(LOCALSTORAGE_AUTH_EXPIRY_KEY);
        logger.setUserId(null);
    }
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
            return;
        }
        
        setInitializationStarted(true);
        
        const initTimeout = setTimeout(() => {
          logger.error('App initialization timed out after 10 seconds', 'AppInit');
          setAppInitialized(true);
          setIsLoading(false);
        }, 10000);
        
        try {
          const savedLanguage = localStorage.getItem(LOCALSTORAGE_LANGUAGE_KEY) as Language | null;
          if (savedLanguage && translations[savedLanguage]) {
              setLanguageState(savedLanguage);
          }

          const maintenanceSettings = await maintenanceService.getMaintenanceSettings();
          if (maintenanceSettings?.isEnabled) {
            const userEmail = currentUser?.email || undefined;
            const isAllowed = await maintenanceService.isUserAllowed(userEmail);
            
            if (!isAllowed) {
              setMaintenanceMode(true);
              setMaintenanceMessage(maintenanceSettings.message);
              setAppInitialized(true);
              setIsLoading(false);
              return;
            }
          }

          if (currentUser?.email) {
            const adminStatus = await adminService.isAdmin(currentUser.email);
            const role = await adminService.getAdminRole(currentUser.email);
            setIsAdmin(adminStatus);
            setAdminRole(role);
          }

          try {
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session?.user) {
              try {
                const userProfile = await supabaseService.getUserByEmail(session.user.email!);
                if (userProfile) {
                  setCurrentUser({
                    ...userProfile,
                    supabaseId: session.user.id
                  });
                }
              } catch (profileError) {
                logger.error('Failed to get user profile from Supabase', 'AppInit', {}, profileError as Error);
              }
            }
          } catch (supabaseError) {
            logger.error('Failed to check Supabase session', 'AppInit', {}, supabaseError as Error);
          }

          const savedUserJson = localStorage.getItem(LOCALSTORAGE_USER_KEY);
          if (savedUserJson) {
            try {
              const savedUser = JSON.parse(savedUserJson) as UserProfile;
              if (!currentUser && savedUser.accessToken && isTokenStillValid()) {
                setCurrentUser(savedUser);
              }
            } catch (e) {
              logger.error('Failed to parse saved user data', 'AppInit', {}, e as Error);
              localStorage.removeItem(LOCALSTORAGE_USER_KEY);
            }
          }

          const savedResultJson = localStorage.getItem(LOCALSTORAGE_QUIZ_RESULT_KEY);
          if (savedResultJson) {
            try { 
              setQuizResult(JSON.parse(savedResultJson) as QuizResult); 
            } catch (e) {
              logger.error('Failed to parse quiz result from localStorage', 'AppInit', undefined, e as Error);
              localStorage.removeItem(LOCALSTORAGE_QUIZ_RESULT_KEY);
            }
          }
        } catch (error) {
          logger.error('Error during app initialization', 'AppInit', {}, error as Error);
        } finally {
          clearTimeout(initTimeout);
          setAppInitialized(true);
        }
    };
    
    initializeApp();
  }, []);

  // Emergency initialization timeout - force initialize after 15 seconds
  useEffect(() => {
    const emergencyTimeout = setTimeout(() => {
      if (!appInitialized) {
        logger.error('Emergency timeout: App failed to initialize within 15 seconds', 'EmergencyInit');
        setAppInitialized(true);
        setIsLoading(false);
      }
    }, 15000);

    return () => clearTimeout(emergencyTimeout);
  }, [appInitialized]);

  useEffect(() => {
    if (!appInitialized) return;

    const loadInitialQuizzes = async () => {
      setIsLoading(true);
      
      try {
        const localQuizzes = await quizStorage.getAllQuizzes();
        setAllQuizzes(localQuizzes);
        
        if (currentUser?.id) {
          const isSupabaseUser = currentUser.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
          
          if (isSupabaseUser) {
            try {
              const supabaseQuizzes = await supabaseService.getUserQuizzes(currentUser.id);
              const mergedQuizzes = mergeQuizzes(localQuizzes, supabaseQuizzes);
              
              if (mergedQuizzes.length !== localQuizzes.length || 
                  JSON.stringify(mergedQuizzes) !== JSON.stringify(localQuizzes)) {
                setAllQuizzes(mergedQuizzes);
                await quizStorage.saveQuizzes(mergedQuizzes);
              }
            } catch (error) {
              logger.warn('Failed to sync with Supabase, using local quizzes only', 'QuizLoading', {}, error as Error);
            }
          }
        }
      } catch (error) {
        logger.error('Error loading initial quizzes', 'QuizLoading', {}, error as Error);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialQuizzes();
  }, [appInitialized, currentUser?.id]);


  useEffect(() => {
    // Only set up auth listener after app is initialized to avoid conflicts
    if (!appInitialized) return;

    // Set up Supabase auth state listener for ongoing session changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Only handle explicit auth events, not initial session
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // Session is automatically maintained, no need to update user
      }
      // Ignore SIGNED_IN events during initialization to prevent conflicts
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [appInitialized, setCurrentUser]);

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

    // Always save to localStorage first as backup
    try {
      const currentQuizzes = await quizStorage.getAllQuizzes()
      const updatedQuizzes = [quizWithOwnerAndTimestamp, ...currentQuizzes.filter(q => q.id !== quiz.id)]
      await quizStorage.saveQuizzes(updatedQuizzes)
      setAllQuizzes(updatedQuizzes)
      logger.info('Quiz saved to localStorage successfully', 'AppContext', { quizId: quiz.id })
    } catch (localError) {
      logger.error('Failed to save quiz to localStorage', 'AppContext', { quizId: quiz.id }, localError as Error)
    }

    // Try to save to Supabase if user has a Supabase UUID (not Google ID)
    const isSupabaseUser = currentUser.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    
    if (isSupabaseUser) {
      try {
        const savedQuiz = await supabaseService.createQuiz(quizWithOwnerAndTimestamp, currentUser.id)
        
        if (savedQuiz) {
          // Update state with the Supabase version
          setAllQuizzes(prev => [savedQuiz, ...prev.filter(q => q.id !== quiz.id)])
          logger.info('Quiz added to Supabase successfully', 'AppContext', { quizId: quiz.id, title: quiz.title })
          
          // Update localStorage with Supabase version
          try {
            const allQuizzes = await supabaseService.getUserQuizzes(currentUser.id)
            await quizStorage.saveQuizzes(allQuizzes)
            logger.info('Quiz saved to local storage as backup', 'AppContext', { quizId: quiz.id })
          } catch (e) {
            logger.warn('Failed to update localStorage backup after Supabase save', 'AppContext', { quizId: quiz.id }, e as Error)
          }
        } else {
          logger.warn('Supabase save failed, quiz is only saved locally', 'AppContext', { quizId: quiz.id })
        }
      } catch (supabaseError) {
        logger.warn('Failed to save quiz to Supabase, quiz is saved locally', 'AppContext', { quizId: quiz.id }, supabaseError as Error)
      }
    } else {
      logger.info('User has Google ID, quiz saved locally only', 'AppContext', { quizId: quiz.id, userId: currentUser.id })
    }
  }, [currentUser]);

  const deleteQuiz = useCallback(async (quizId: string): Promise<void> => {
    if (!currentUser) {
      throw new Error('User must be logged in to delete quizzes')
    }

    // Always update local state first
    setAllQuizzes(prev => prev.filter(q => q.id !== quizId))
    
    try {
      // Update localStorage
      const currentQuizzes = await quizStorage.getAllQuizzes()
      const updatedQuizzes = currentQuizzes.filter(q => q.id !== quizId)
      await quizStorage.saveQuizzes(updatedQuizzes)
      logger.info('Quiz removed from localStorage', 'AppContext', { quizId })
    } catch (localError) {
      logger.error('Failed to remove quiz from localStorage', 'AppContext', { quizId }, localError as Error)
    }

    // Try to delete from Supabase if user has a Supabase UUID
    const isSupabaseUser = currentUser.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    const isValidUUID = quizId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    
    if (isSupabaseUser && isValidUUID) {
      try {
        const success = await supabaseService.deleteQuiz(quizId)
        
        if (success) {
          logger.info('Quiz deleted from Supabase successfully', 'AppContext', { quizId })
          
          // Update localStorage with remaining Supabase quizzes
          try {
            const remainingQuizzes = await supabaseService.getUserQuizzes(currentUser.id)
            await quizStorage.saveQuizzes(remainingQuizzes)
            logger.info('Local storage updated after Supabase quiz deletion', 'AppContext', { quizId })
          } catch (e) {
            logger.warn('Failed to update localStorage after Supabase deletion', 'AppContext', { quizId }, e as Error)
          }
        } else {
          logger.warn('Failed to delete quiz from Supabase, but removed locally', 'AppContext', { quizId })
        }
      } catch (supabaseError) {
        logger.warn('Error deleting quiz from Supabase, but removed locally', 'AppContext', { quizId }, supabaseError as Error)
      }
    } else {
      if (!isValidUUID) {
        logger.info('Legacy quiz removed (invalid UUID format)', 'AppContext', { quizId })
      } else {
        logger.info('Quiz removed locally (user has Google ID)', 'AppContext', { quizId, userId: currentUser.id })
      }
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

    // Always update local state first
    setAllQuizzes(prev => prev.map(q => q.id === quizWithTimestamp.id ? quizWithTimestamp : q))
    
    try {
      // Update localStorage
      const currentQuizzes = await quizStorage.getAllQuizzes()
      const updatedQuizzes = currentQuizzes.map(q => q.id === quizWithTimestamp.id ? quizWithTimestamp : q)
      await quizStorage.saveQuizzes(updatedQuizzes)
      logger.info('Quiz updated in localStorage', 'AppContext', { quizId: updatedQuiz.id })
    } catch (localError) {
      logger.error('Failed to update quiz in localStorage', 'AppContext', { quizId: updatedQuiz.id }, localError as Error)
    }

    // Try to update in Supabase if user has a Supabase UUID
    const isSupabaseUser = currentUser.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    
    if (isSupabaseUser) {
      try {
        const updatedSupabaseQuiz = await supabaseService.updateQuiz(quizWithTimestamp)
        
        if (updatedSupabaseQuiz) {
          // Update state with the Supabase version
          setAllQuizzes(prev => prev.map(q => q.id === quizWithTimestamp.id ? updatedSupabaseQuiz : q))
          logger.info('Quiz updated in Supabase successfully', 'AppContext', { quizId: updatedQuiz.id, title: updatedQuiz.title })
          
          // Update localStorage with Supabase version
          try {
            const allQuizzes = await supabaseService.getUserQuizzes(currentUser.id)
            await quizStorage.saveQuizzes(allQuizzes)
            logger.info('Local storage updated after Supabase quiz update', 'AppContext', { quizId: updatedQuiz.id })
          } catch (e) {
            logger.warn('Failed to update localStorage backup after Supabase update', 'AppContext', { quizId: updatedQuiz.id }, e as Error)
          }
        } else {
          logger.warn('Supabase update failed, quiz is updated locally only', 'AppContext', { quizId: updatedQuiz.id })
        }
      } catch (supabaseError) {
        logger.warn('Failed to update quiz in Supabase, quiz is updated locally', 'AppContext', { quizId: updatedQuiz.id }, supabaseError as Error)
      }
    } else {
      logger.info('User has Google ID, quiz updated locally only', 'AppContext', { quizId: updatedQuiz.id, userId: currentUser.id })
    }
  }, [currentUser]);

  const getQuizByIdFromAll = useCallback((id: string): Quiz | null => {
    // First, try to find in user's own quizzes
    const userQuiz = allQuizzes.find(q => q.id === id);
    if (userQuiz) {
      return userQuiz;
    }
    
    // If not found in user's quizzes, try to find in shared quiz cache
    try {
      const sharedQuizzes = JSON.parse(localStorage.getItem('quizai_shared_quizzes_v2') || '{}');
      const sharedQuiz = sharedQuizzes[id];
      if (sharedQuiz) {
        logger.info('Found quiz in shared quiz cache', 'AppContext', { quizId: id });
        return sharedQuiz;
      }
      
      // Also check legacy shared quiz storage
      const legacySharedQuizzes = JSON.parse(localStorage.getItem('quizai_shared_quizzes') || '{}');
      const legacySharedQuiz = legacySharedQuizzes[id];
      if (legacySharedQuiz) {
        logger.info('Found quiz in legacy shared quiz cache', 'AppContext', { quizId: id });
        return legacySharedQuiz;
      }
    } catch (error) {
      logger.error('Error checking shared quiz cache', 'AppContext', { quizId: id }, error as Error);
    }
    
    return null;
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
        access_token: tokenResponse?.access_token || user.accessToken,
        credential: user.idToken, // Pass the ID token as credential if available
        idToken: user.idToken // Also pass as idToken for fallback
      }
      
      try {
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

          // Run database migrations if needed
          try {
            const migrationSuccess = await runMigrations();
            if (migrationSuccess) {
              logger.info('Database migrations completed successfully', 'App');
            } else {
              logger.warn('Database migrations failed or were not needed', 'App');
            }
          } catch (migrationError) {
            logger.error('Migration failed, but login continues', 'App', {}, migrationError as Error)
          }

          logger.info('User logged in successfully with Supabase', 'AuthContext', { userId: userWithTokenAndDefaults.id })
          return userWithTokenAndDefaults
        } else {
          throw new Error('Failed to authenticate with Supabase - will use fallback')
        }
      } catch (supabaseError) {
        logger.warn('Supabase authentication failed, falling back to Google profile', 'AuthContext', {}, supabaseError as Error)
        
        // Fallback to Google profile if Supabase fails
        let tokenInfo: { token: string; expires_in: number } | undefined = undefined;
        if (tokenResponse) {
            tokenInfo = {
                token: tokenResponse.access_token,
                expires_in: (typeof (tokenResponse as any).expires_in === 'number') ? (tokenResponse as any).expires_in : 3600,
            };
        }
        
        const fallbackUser: UserProfile = {
            id: user.id, // Use Google ID as fallback
            email: user.email,
            name: user.name,
            imageUrl: user.imageUrl,
            accessToken: tokenInfo?.token || user.accessToken, 
            bio: null,
            quizCount: 0,
            completionCount: 0,
            averageScore: null,
        };
        
        setCurrentUser(fallbackUser, tokenInfo);
        return fallbackUser
      }
    } catch (error) {
      logger.error('Login failed completely', 'AuthContext', {}, error as Error)
      throw error
    }
  }, [setCurrentUser]); 

  const handleLogout = useCallback(async () => {
    
    // Sign out from Google
    googleLogout();
    
    // Sign out from Supabase
    try {
      await supabase.auth.signOut();
      logger.info('Signed out from Supabase', 'AuthContext');
    } catch (error) {
      logger.warn('Error signing out from Supabase', 'AuthContext', {}, error as Error);
    }
    
    // Clear application state
    setCurrentUser(null); 
    setActiveQuiz(null); 
    setQuizResult(null);
    setAllQuizzes([]); 
    await quizStorage.saveQuizzes([]); 
    localStorage.removeItem(LOCALSTORAGE_QUIZ_RESULT_KEY);
    
    navigate('/'); 
    logger.info('Logout complete', 'AuthContext');
  }, [navigate, setCurrentUser]); 
  
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


  const quizzesForContext = useMemo(() => {
    return allQuizzes; 
  }, [allQuizzes]);
  
  const combinedIsLoading = Boolean(isLoading);

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
    showSuccessNotification,
    showErrorNotification,
    notification,
    clearNotification,
    isAdmin,
    adminRole,
  }), [
    location.pathname, setCurrentView, language, setLanguage, quizzesForContext, 
    addQuiz, deleteQuiz, updateQuiz, getQuizByIdFromAll, activeQuiz, setActiveQuiz, quizResult, 
    setQuizResultWithPersistence, currentUser, login, handleLogout, updateUserProfile, combinedIsLoading,
    showSuccessNotification, showErrorNotification, notification, clearNotification, isAdmin, adminRole,
  ]);

  if (maintenanceMode) {
    return <MaintenancePage message={maintenanceMessage} />;
  }

  if (!appInitialized) {
    return (
        <div style={{
            position: 'fixed', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'var(--color-bg-body)'
        }}>
            <div className="flex flex-col items-center space-y-4">
              <svg className="animate-spin text-[var(--color-primary-accent)] w-14 h-14" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-sm text-[var(--color-text-secondary)]">Loading QuizAI...</p>
              <button 
                onClick={() => {
                  logger.warn('Emergency initialization triggered by user', 'AppInit');
                  setAppInitialized(true);
                }}
                className="mt-4 px-4 py-2 text-xs bg-[var(--color-primary-accent)] text-white rounded hover:opacity-80 transition-opacity"
                style={{ display: 'block' }}
              >
                Click if stuck loading
              </button>
            </div>
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
    const { currentUser, logout, setCurrentView, isAdmin, adminRole } = useAppContext();
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

                {isAdmin && (
                  <div className="py-1.5 border-t border-[var(--color-border-default)]">
                    <div className="px-5 pt-2 pb-1 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Admin</div>
                    <button
                        onClick={() => { setCurrentView('/admin/maintenance'); setIsUserDropdownOpen(false); }}
                        className="w-full text-left px-5 py-3 text-sm text-[var(--color-text-body)] hover:bg-[var(--color-bg-surface-2)] active:bg-[var(--color-bg-surface-3)] flex items-center hover:text-[var(--color-primary-accent)] transition-colors var(--duration-fast) var(--ease-ios)"
                        role="menuitem"
                    >
                        <svg className="w-4 h-4 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Quản Lý Bảo Trì
                        {adminRole === 'super_admin' && (
                          <span className="ml-auto bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded-full">Super</span>
                        )}
                    </button>
                  </div>
                )}

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
    isLoading: globalIsLoading,
    notification, clearNotification
  } = useAppContext(); 
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileProfileOpen, setIsMobileProfileOpen] = useState(false);
  const generalSettingsIconUrl = "https://img.icons8.com/?size=256&id=s5NUIabJrb4C&format=png"; 
  
  // Preload markdown content for better performance - this will happen in the background
  useMarkdownPreloader();
  
  const apiKeyWarnings: string[] = [];
  
  const appInitialized = true; 
  if (globalIsLoading && !appInitialized) { 
    return (
      <div className="fixed inset-0 bg-[var(--color-bg-body)] flex items-center justify-center z-[200]">
        <LoadingSpinner text={t('loading')} size="xl" />
      </div>
    );
  }

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
                {currentUser && <NavLink to="/history" icon={<HistoryIcon className="w-4 h-4"/>}>History</NavLink>}
              </nav>

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
            <Route path="/history" element={currentUser ? <QuizHistoryPage /> : <Navigate to="/signin" state={{ from: location }} replace />} />
            <Route path="/my-quizzes" element={currentUser ? <MyQuizzesPage /> : <Navigate to="/signin" state={{ from: location }} replace />} />
            <Route path="/quiz-analytics/:quizId" element={currentUser ? <QuizAnalyticsPage /> : <Navigate to="/signin" state={{ from: location }} replace />} />
            <Route path="/admin/maintenance" element={currentUser ? <MaintenanceAdmin /> : <Navigate to="/signin" state={{ from: location }} replace />} />
            <Route path="/shared/:quizId" element={<SharedQuizPage />} /> 
            <Route path="/markdown-test" element={<MarkdownPreviewTester />} />
            <Route path="/test-markdown" element={<TestMarkdown />} />
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
      
      {/* GitHub API rate limit warning - positioned for better visibility */}
      <div className="fixed bottom-20 md:bottom-4 right-4 z-50">
        <GithubApiLimitWarning />
      </div>

      {currentUser && isMobileProfileOpen && <MobileProfileSheet /> } 

      {/* Toast Notification Display - Always render with conditional content inside */}
      <NotificationDisplay 
        notification={notification} 
        onClose={clearNotification} 
      />
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
  const [googleClientId, setGoogleClientId] = useState<string>('');
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [configError, setConfigError] = useState<string>('');

  useEffect(() => {
    const loadGoogleClientId = async () => {
      try {
        const clientId = await secureConfig.getApiKey('GOOGLE_CLIENT_ID');
        if (clientId) {
          setGoogleClientId(clientId);
        } else {
          setConfigError('Missing Google Client ID configuration');
          logger.error('No Google Client ID found in database', 'App');
        }
      } catch (error) {
        setConfigError('Failed to load Google Client ID');
        logger.error('Error loading Google Client ID', 'App', {}, error as Error);
      } finally {
        setIsLoadingConfig(false);
      }
    };

    loadGoogleClientId();
  }, []);

  // Show loading state while fetching configuration
  if (isLoadingConfig) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        backgroundColor: 'var(--color-bg-body)',
        color: 'var(--color-text-primary)',
        fontSize: '16px',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div>
          <LoadingSpinner size="lg" />
          <p style={{ marginTop: '20px' }}>Loading configuration...</p>
        </div>
      </div>
    );
  }

  // Show error state if configuration failed to load
  if (configError || !googleClientId) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        backgroundColor: 'var(--color-bg-body)',
        color: 'var(--color-text-primary)',
        fontSize: '16px',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div>
          <h2>Configuration Error</h2>
          <p>{configError || 'Missing Google Client ID configuration'}</p>
          <p style={{ fontSize: '14px', marginTop: '10px', opacity: 0.7 }}>
            Please ensure your API keys are properly configured in the database.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <GoogleOAuthProvider clientId={googleClientId}>
        <HashRouter>
          <AppProvider>
            <AppContent />
          </AppProvider>
        </HashRouter>
      </GoogleOAuthProvider>
    </ThemeProvider>
  );
};
App.displayName = "App";

export default App;
