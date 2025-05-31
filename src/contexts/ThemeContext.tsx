
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { logger } from '../services/logService'; // Import logger

export type ThemeType = 'dark' | 'light';

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeType>(() => {
    let initialTheme: ThemeType = 'dark'; // Default to dark
    if (typeof window !== 'undefined') {
      try {
        const savedTheme = localStorage.getItem('quizai-theme') as ThemeType | null;
        if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
          initialTheme = savedTheme;
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
          // Respect user's OS preference if no localStorage item is set AND no savedTheme
          initialTheme = 'light';
        }
      } catch (error) {
        logger.warn('Error accessing localStorage for theme preference', 'ThemeContext', undefined, error as Error);
        // Fallback to OS preference if localStorage fails
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
          initialTheme = 'light';
        }
      }
    }
    return initialTheme;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.className = theme;
    
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('quizai-theme', theme);
      } catch (error) {
        logger.warn('Error saving theme to localStorage', 'ThemeContext', { theme }, error as Error);
      }
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      let noThemeStored = false;
      try {
        if (!localStorage.getItem('quizai-theme')) {
          noThemeStored = true;
        }
      } catch (error) {
        logger.warn('Error checking localStorage for theme preference during OS listener setup', 'ThemeContext', undefined, error as Error);
        noThemeStored = true; // Assume not stored if access fails, to allow OS preference
      }

      if (noThemeStored) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
        const handleChange = (e: MediaQueryListEvent) => {
          let stillNoThemeStored = false;
          try {
            if (!localStorage.getItem('quizai-theme')) {
              stillNoThemeStored = true;
            }
          } catch (error) { /* ignore */ }

          if (stillNoThemeStored) {
            setThemeState(e.matches ? 'light' : 'dark');
          }
        };
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
      }
    }
  }, []);


  const setTheme = useCallback((newTheme: ThemeType) => {
    setThemeState(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
