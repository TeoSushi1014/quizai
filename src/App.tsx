
import React, { useState, useCallback, useEffect, createContext, useContext, ReactNode, useMemo, useRef } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation, NavLink as RouterNavLink } from 'react-router-dom';
import { GoogleOAuthProvider, googleLogout } from '@react-oauth/google';
import { Quiz, AppContextType, Language, QuizResult, UserProfile } from './types';
import { APP_NAME, UserCircleIcon, KeyIcon, LogoutIcon, HomeIcon, PlusCircleIcon, ChartBarIcon } from './constants'; 
import { Button, LoadingSpinner, Tooltip } from './components/ui';
import HomePage from './features/quiz/HomePage';
import DashboardPage from './features/quiz/DashboardPage';
import QuizCreatePage from './features/quiz/QuizCreatePage';
import { QuizTakingPage } from './features/quiz/QuizTakingPage';
import ResultsPage from './features/quiz/ResultsPage';
import QuizReviewPage from './features/quiz/QuizReviewPage';
import SignInPage from './features/auth/SignInPage';
import QuizPracticePage from './features/quiz/QuizPracticePage';
import PracticeSummaryPage from './features/quiz/PracticeSummaryPage';
import { getTranslator, translations } from './i18n';

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

const AppProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [allQuizzes, setAllQuizzes] = useState<Quiz[]>(() => {
    const savedQuizzes = localStorage.getItem('quizzes');
    return savedQuizzes ? JSON.parse(savedQuizzes) : [];
  });
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('appLanguage') as Language) || 'en';
  });
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const savedUser = localStorage.getItem('currentUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [isLoading, setIsLoading] = useState(false); // Kept for potential non-Supabase async ops
  const [isGeminiKeyAvailable, setIsGeminiKeyAvailable] = useState(false);

  useEffect(() => {
    setIsGeminiKeyAvailable(typeof process.env.API_KEY === 'string' && !!process.env.API_KEY);
  }, []);

  useEffect(() => {
    localStorage.setItem('quizzes', JSON.stringify(allQuizzes));
  }, [allQuizzes]);
  
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('currentUser');
    }
  }, [currentUser]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('appLanguage', lang);
    document.documentElement.lang = lang; 
  };
  
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const navigate = useNavigate(); 
  const location = useLocation();

  const setCurrentView = useCallback((viewPath: string, _params?: Record<string, string | number>) => {
    navigate(viewPath);
  }, [navigate]);

  const addQuiz = (quiz: Quiz) => {
    const quizWithOwner = currentUser ? { ...quiz, userId: currentUser.id } : quiz;
    setAllQuizzes(prev => [quizWithOwner, ...prev]);
  };

  const deleteQuiz = (quizId: string) => {
    setAllQuizzes(prev => prev.filter(q => q.id !== quizId));
  };

  const updateQuiz = (updatedQuiz: Quiz) => {
    setAllQuizzes(prev => prev.map(q => q.id === updatedQuiz.id ? updatedQuiz : q));
  };

  const setQuizResultWithPersistence = (result: QuizResult | null) => {
    setQuizResult(result);
    // If needed, persist quiz result to localStorage or other client-side storage
    // For now, it's just in component state.
  };

  const login = (user: UserProfile) => {
    setCurrentUser(user);
    setIsLoading(true);
    // Simulate loading or perform other non-Supabase async tasks if any
    setTimeout(() => {
      // Merge local anonymous quizzes with the logged-in user
      const localQuizzes = [...allQuizzes];
      const updatedQuizzes = localQuizzes.map(q => {
        if (!q.userId) { // If quiz is anonymous
          return { ...q, userId: user.id }; // Associate with logged-in user
        }
        return q;
      });
      setAllQuizzes(updatedQuizzes);
      localStorage.setItem('quizzes', JSON.stringify(updatedQuizzes));
      setIsLoading(false);
    }, 500); // Simulate some delay
  };

  const handleLogout = () => { 
    googleLogout();
    setCurrentUser(null);
    setActiveQuiz(null); 
    setQuizResult(null); 
    // Clear user-specific quizzes from allQuizzes or re-filter for anonymous
    // For simplicity, we'll just clear active quiz and result.
    // Quizzes will be filtered by quizzesForContext.
    navigate('/'); 
  };

  const quizzesForContext = useMemo(() => {
    if (currentUser) {
      // Show quizzes belonging to the current user OR quizzes that became theirs upon login
      return allQuizzes.filter(q => q.userId === currentUser.id);
    }
    // If not logged in, show only quizzes that are truly anonymous (no userId)
    return allQuizzes.filter(q => !q.userId);
  }, [allQuizzes, currentUser]);
  
  const contextValue: AppContextType = {
    currentView: (location.pathname.substring(1) || 'home') as any, 
    setCurrentView, 
    language,
    setLanguage,
    quizzes: quizzesForContext,
    addQuiz,
    deleteQuiz,
    updateQuiz,
    activeQuiz,
    setActiveQuiz,
    quizResult,
    setQuizResult: setQuizResultWithPersistence,
    currentUser,
    login,
    logout: handleLogout, 
    isGeminiKeyAvailable,
    isLoading
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

const NavLink: React.FC<{ to: string; children: ReactNode; end?: boolean; className?: string; activeClassName?: string; inactiveClassName?: string; isMobile?: boolean; }> = 
({ to, children, end = false, className = '', activeClassName = '', inactiveClassName = '', isMobile = false }) => {

  const baseDesktopStyle = "px-3.5 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ease-out hover:bg-sky-400/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900";
  const activeDesktopStyle = "bg-sky-400/20 text-sky-300 font-semibold";
  const inactiveDesktopStyle = "text-slate-300 hover:text-sky-300";

  const baseMobileStyle = "flex flex-col items-center justify-center h-full w-full text-xs transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400/70 rounded-lg";
  const activeMobileStyle = "text-sky-300 font-semibold bg-sky-400/15";
  const inactiveMobileStyle = "text-slate-400 hover:text-sky-300 hover:bg-slate-500/10";


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
    const { currentUser, logout } = useAppContext();
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
                className="flex items-center p-1 rounded-full focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800"
                aria-label="User menu"
                aria-expanded={isUserDropdownOpen}
                aria-haspopup="true"
            >
                {currentUser.imageUrl ? (
                    <img src={currentUser.imageUrl} alt={currentUser.name || "User"} className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 border-slate-600 hover:border-sky-300 transition-all duration-150" />
                ) : (
                    <UserCircleIcon className="w-8 h-8 sm:w-9 sm:h-9 text-slate-400 hover:text-sky-300 transition-colors" />
                )}
            </button>
            <div
                className={`absolute right-0 mt-2.5 w-60 sm:w-64 glass-effect rounded-xl shadow-2xl py-2 z-50 transition-opacity duration-200 ease-out
                            ${isUserDropdownOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
            >
                <div className="px-4 py-3 border-b border-slate-700/70">
                    <p className="text-sm font-semibold text-slate-100 truncate" title={currentUser.name || undefined}>{currentUser.name || t('untitledQuiz')}</p>
                    <p className="text-xs text-slate-400 truncate" title={currentUser.email || undefined}>{currentUser.email}</p>
                </div>
                <button
                    onClick={() => { logout(); setIsUserDropdownOpen(false); }}
                    className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-400/15 flex items-center transition-colors hover:text-red-300"
                >
                    <LogoutIcon className="w-4 h-4 mr-2.5 flex-shrink-0" />
                    {t('logout')}
                </button>
            </div>
        </div>
    );
};
UserDropdownMenu.displayName = "UserDropdownMenu";

const AppLayout: React.FC = () => {
  const { language, setLanguage, currentUser, isGeminiKeyAvailable } = useAppContext(); 
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const apiKeyWarnings = [];
  if (!isGeminiKeyAvailable) apiKeyWarnings.push("Google Gemini API Key (API_KEY)");
  
  return (
    <div className={`min-h-screen flex flex-col bg-slate-900 selection:bg-sky-500/20 selection:text-sky-300 pb-16 md:pb-0`}>
      <header className="glass-effect sticky top-0 z-50 border-b border-slate-700/60 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-[72px]">
            <div className="flex items-center space-x-2 sm:space-x-3 cursor-pointer group" onClick={() => navigate('/')}>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-50 group-hover:text-sky-400 transition-colors duration-150 tracking-tight">
                {APP_NAME} 
              </h1>
            </div>
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <nav className="hidden md:flex items-center space-x-1">
                 <NavLink to="/" end>{t('navHome')}</NavLink>
                <NavLink to="/dashboard">{t('navDashboard')}</NavLink>
                <NavLink to="/create">{t('navCreateQuiz')}</NavLink>
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
            <HomeIcon className="w-5 h-5 mb-0.5"/> <span className="mt-px text-[0.7rem] font-medium">{t('navHome')}</span>
          </NavLink>
          <NavLink to="/dashboard" isMobile>
            <ChartBarIcon className="w-5 h-5 mb-0.5"/> <span className="mt-px text-[0.7rem] font-medium">{t('navDashboard')}</span>
          </NavLink>
          <NavLink to="/create" isMobile>
            <PlusCircleIcon className="w-5 h-5 mb-0.5"/> <span className="mt-px text-[0.7rem] font-medium">{t('navCreateQuiz')}</span>
          </NavLink>
        </nav>

      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 md:py-10 mb-20 md:mb-0"> 
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/create" element={<QuizCreatePage />} />
          <Route path="/review" element={<QuizReviewPage />} /> 
          <Route path="/review/:quizId" element={<QuizReviewPage />} />
          <Route path="/quiz/:quizId" element={<QuizTakingPage />} />
          <Route path="/practice/:quizId" element={<QuizPracticePage />} />
          <Route path="/practice-summary/:quizId" element={<PracticeSummaryPage />} />
          <Route path="/results/:quizId" element={<ResultsPage />} />
          <Route path="*" element={<HomePage />} /> 
        </Routes>
      </main>

      <footer className="bg-transparent py-4 md:py-6 mt-auto">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-4 md:mb-5 space-x-3 sm:space-x-4 text-center">
            <a href="#" className="text-xs text-slate-400 hover:text-sky-300 transition-colors duration-150">{t('footerTerms')}</a>
            <a href="#" className="text-xs text-slate-400 hover:text-sky-300 transition-colors duration-150">{t('footerPrivacy')}</a>
            <a href="#" className="text-xs text-slate-400 hover:text-sky-300 transition-colors duration-150">{t('footerFAQ')}</a>
          </div>

          <div className="pt-4 md:pt-5 border-t border-slate-700/50">
            <p className="text-sm font-semibold text-slate-300 mb-3 sm:mb-3 text-center">{t('footerContactUs')}</p> 
            <div className="flex justify-center items-center space-x-3 sm:space-x-4">
              <Tooltip content="Facebook" placement="top">
                <a href="https://www.facebook.com/boboiboy.gala.7/" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-slate-400 hover:text-sky-400 transition-colors duration-150">
                  <img src="https://img.icons8.com/?size=256&id=uLWV5A9vXIPu&format=png" alt="Facebook" className="w-5 h-5"/>
                </a>
              </Tooltip>
              <Tooltip content="TikTok" placement="top">
                <a href="https://www.tiktok.com/@teosushi1014" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="text-slate-400 hover:text-sky-400 transition-colors duration-150">
                   <img src="https://img.icons8.com/?size=256&id=118640&format=png" alt="TikTok" className="w-5 h-5"/>
                </a>
              </Tooltip>
              <Tooltip content="YouTube" placement="top">
                <a href="https://www.youtube.com/@TeoSushi1014" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="text-slate-400 hover:text-sky-400 transition-colors duration-150">
                   <img src="https://img.icons8.com/?size=256&id=19318&format=png" alt="YouTube" className="w-5 h-5"/>
                </a>
              </Tooltip>
              <Tooltip content={t('footerGmail')} placement="top">
                <a href="mailto:teosushi1014@gmail.com" aria-label={t('footerGmail')} className="text-slate-400 hover:text-sky-400 transition-colors duration-150">
                  <img src="https://img.icons8.com/?size=256&id=P7UIlhbpWzZm&format=png" alt="Gmail" className="w-5 h-5"/>
                </a>
              </Tooltip>
            </div>
          </div>
          
          <p className="text-xs text-slate-400/70 mt-6 md:mt-8 text-center">{t('footerRights', {year: new Date().getFullYear(), appName: APP_NAME})}</p>
        </div>
      </footer>
      
      {apiKeyWarnings.length > 0 && (
         <div role="alert" className="fixed bottom-4 left-1/2 -translate-x-1/2 w-auto max-w-[calc(100%-2rem)] bg-amber-500 text-amber-50 p-3 sm:p-3.5 text-xs sm:text-sm shadow-2xl z-[200] flex items-center justify-center gap-2.5 border border-amber-400/50 rounded-xl">
            <KeyIcon className="w-4 h-4 sm:w-5 sm:h-5 text-amber-950 flex-shrink-0" strokeWidth={2}/>
            <strong className="font-semibold">{t('apiKeyWarningTitle')}:</strong> 
            <span className="text-amber-950/90">{t('apiKeyWarningMissing', {keys: apiKeyWarnings.join(', ')})} {t('apiKeyWarningFunctionality')}</span>
        </div>
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
          <AppLayout />
        </AppProvider>
      </HashRouter>
    </GoogleOAuthProvider>
  );
};
App.displayName = "App";

export default App;
