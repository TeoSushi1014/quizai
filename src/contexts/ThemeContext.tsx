
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

export type ThemeType = 'dark' | 'light';

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeType>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('quizai-theme') as ThemeType | null;
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
        return savedTheme;
      }
      // Respect user's OS preference if no localStorage item is set
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
      }
    }
    return 'dark'; // Default to dark
  });

  useEffect(() => {
    const root = window.document.documentElement;
    // Set the class directly
    root.className = theme;
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('quizai-theme', theme);
    }
    // Removed direct input styling. This is now handled by global CSS variables in index.html
    // and specific !important overrides in theme-fixes.css.
  }, [theme]);

  // Listen for OS theme changes if no theme is explicitly set in localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('quizai-theme')) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
      const handleChange = (e: MediaQueryListEvent) => {
        // Only update if no theme is in localStorage (respect explicit user choice)
        if (!localStorage.getItem('quizai-theme')) {
          setThemeState(e.matches ? 'light' : 'dark');
        }
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
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
