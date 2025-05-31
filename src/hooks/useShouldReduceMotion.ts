
import { useState, useEffect } from 'react';

function useShouldReduceMotion(): boolean {
  const [shouldReduceMotion, setShouldReduceMotion] = useState(false);
  
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        setShouldReduceMotion(mediaQuery.matches);
        
        const listener = (e: MediaQueryListEvent) => {
        setShouldReduceMotion(e.matches);
        };
        
        mediaQuery.addEventListener('change', listener);
        return () => mediaQuery.removeEventListener('change', listener);
    }
    // Default to false if matchMedia is not available (e.g., older browsers or server-side)
    setShouldReduceMotion(false);
  }, []);
  
  return shouldReduceMotion;
}

export default useShouldReduceMotion;
