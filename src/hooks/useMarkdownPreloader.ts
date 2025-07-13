import { useEffect, useState } from 'react';
import { githubMarkdownService } from '../services/githubMarkdownService';

/**
 * Common markdown elements that can be preloaded
 */
const COMMON_MARKDOWN_ELEMENTS = [
  '# Heading 1',
  '## Heading 2',
  '### Heading 3',
  'This is a paragraph with **bold** and *italic* text.',
  '- List item 1\n- List item 2\n- List item 3',
  '1. Numbered item 1\n2. Numbered item 2\n3. Numbered item 3',
  '> This is a blockquote',
  '`inline code`',
  '```javascript\nconsole.log("Hello World");\n```',
  '| Header | Header |\n| ------ | ------ |\n| Cell   | Cell   |',
  '![image](https://example.com/image.jpg)',
  '[link](https://example.com)'
];

/**
 * Hook to preload common markdown elements for better performance
 * @param shouldPreload - Whether to preload markdown (default: true)
 * @returns Object with preloading status
 */
const useMarkdownPreloader = (shouldPreload = true): { 
  isPreloading: boolean; 
  preloadedCount: number;
  totalToPreload: number;
} => {
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadedCount, setPreloadedCount] = useState(0);
  const totalToPreload = COMMON_MARKDOWN_ELEMENTS.length;
  
  useEffect(() => {
    if (!shouldPreload) return;
    
    let isMounted = true;
    
    const preloadMarkdown = async () => {
      setIsPreloading(true);
      
      // Create a single batch request for all common elements
      try {
        await githubMarkdownService.batchRenderMarkdown(COMMON_MARKDOWN_ELEMENTS);
        
        if (isMounted) {
          setPreloadedCount(COMMON_MARKDOWN_ELEMENTS.length);
          setIsPreloading(false);
        }
      } catch (error) {
        console.error('Error preloading markdown:', error);
        
        // Fallback to individual requests with delay if batch fails
        let completedCount = 0;
        
        for (const markdown of COMMON_MARKDOWN_ELEMENTS) {
          try {
            await githubMarkdownService.renderMarkdown(markdown, 'gfm');
            completedCount++;
            
            if (isMounted) {
              setPreloadedCount(completedCount);
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch (e) {
            console.warn('Failed to preload markdown element:', e);
          }
          
          // If component unmounted, stop preloading
          if (!isMounted) break;
        }
        
        if (isMounted) {
          setIsPreloading(false);
        }
      }
    };
    
    // Delay preloading to avoid blocking initial render
    const timer = setTimeout(() => {
      preloadMarkdown();
    }, 2000);
    
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [shouldPreload]);
  
  return { isPreloading, preloadedCount, totalToPreload };
};

export default useMarkdownPreloader; 