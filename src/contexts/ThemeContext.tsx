
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
    const currentTheme = theme; // Theme before toggle
    
    // Visual feedback flash
    const feedbackEl = document.createElement('div');
    feedbackEl.className = 'theme-change-feedback-flash';
    feedbackEl.style.position = 'fixed';
    feedbackEl.style.inset = '0';
    feedbackEl.style.backgroundColor = currentTheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'; // Subtle flash color
    feedbackEl.style.opacity = '0';
    feedbackEl.style.pointerEvents = 'none';
    feedbackEl.style.zIndex = '99999'; // Ensure it's on top
    feedbackEl.style.transition = 'opacity 150ms ease-out';
    document.body.appendChild(feedbackEl);

    requestAnimationFrame(() => {
        feedbackEl.style.opacity = '1';
        setTimeout(() => {
            feedbackEl.style.opacity = '0';
            setTimeout(() => {
                if (document.body.contains(feedbackEl)) {
                    document.body.removeChild(feedbackEl);
                }
            }, 150); // Match transition duration
        }, 150); // Duration of flash visibility
    });
    
    // Actual theme change
    setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, [theme]); // Depend on current theme to determine flash color

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

