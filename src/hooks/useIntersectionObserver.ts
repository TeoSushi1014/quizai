
import { useState, useEffect, RefObject } from 'react';

interface IntersectionObserverOptions extends IntersectionObserverInit {
  freezeOnceVisible?: boolean;
}

const useIntersectionObserver = (
  elementRef: RefObject<Element>,
  {
    threshold = 0.1, // Default to 10% visibility
    root = null,
    rootMargin = '0%',
    freezeOnceVisible = true, // Animate once and stop observing
  }: IntersectionObserverOptions = {}
): boolean => {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Ensure IntersectionObserver is available (it should be in modern browsers)
    if (!('IntersectionObserver' in window)) {
      console.warn('IntersectionObserver not supported, falling back to visible.');
      setIsIntersecting(true); // Fallback for older environments
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          if (freezeOnceVisible && element) { // Check element again for safety
            observer.unobserve(element);
          }
        } else {
          if (!freezeOnceVisible) {
            setIsIntersecting(false);
          }
        }
      },
      { threshold, root, rootMargin }
    );

    observer.observe(element);

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [elementRef, threshold, root, rootMargin, freezeOnceVisible]);

  return isIntersecting;
};

export default useIntersectionObserver;
