import React, { useState, useEffect, useRef } from 'react';
import { githubMarkdownService } from '../services/githubMarkdownService';
import 'katex/dist/katex.min.css';

// Preload KaTeX to avoid dynamic imports during rendering
import * as katex from 'katex';

interface GithubMarkdownContentProps {
  content: string | undefined | null;
  className?: string;
  compact?: boolean;
  isRawMode?: boolean;
}

const GithubMarkdownContent: React.FC<GithubMarkdownContentProps> = ({
  content,
  className = '',
  compact = false,
  isRawMode = false
}) => {
  const [renderedHtml, setRenderedHtml] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<string | null>(null);
  
  // Debounce content changes to avoid excessive API calls during typing
  useEffect(() => {
    // Skip if content is the same as the last processed content
    if (contentRef.current === content) {
      return;
    }
    
    contentRef.current = content || null;
    
    const renderMarkdown = async () => {
      if (!content || content.trim() === '') {
        setRenderedHtml('');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Check if content contains LaTeX formulas
        const containsLatex = /(\$\$.*?\$\$|\$.*?\$)/gs.test(content);
        
        if (containsLatex) {
          // Process LaTeX by first replacing formulas with placeholders
          const mathExpressions: Array<{
            type: 'block' | 'inline';
            formula: string;
            placeholder: string;
          }> = [];
          
          let processedContent = content;
          let matchIndex = 0;
          
          // Replace block math expressions
          processedContent = processedContent.replace(/\$\$(.*?)\$\$/gs, (match, formula) => {
            const placeholder = `BLOCK_MATH_PLACEHOLDER_${matchIndex++}`;
            mathExpressions.push({
              type: 'block',
              formula,
              placeholder
            });
            return placeholder;
          });
          
          // Replace inline math expressions
          processedContent = processedContent.replace(/\$([^\$]+)\$/g, (match, formula) => {
            const placeholder = `INLINE_MATH_PLACEHOLDER_${matchIndex++}`;
            mathExpressions.push({
              type: 'inline',
              formula,
              placeholder
            });
            return placeholder;
          });
          
          // Render the content without LaTeX using GitHub API
          let html = isRawMode
            ? await githubMarkdownService.renderMarkdownRaw(processedContent)
            : await githubMarkdownService.renderMarkdown(processedContent, 'gfm');
            
          // Put math expressions back
          mathExpressions.forEach(({ type, formula, placeholder }) => {
            const mathHtml = type === 'block'
              ? `<div class="block-math" data-math="${encodeURIComponent(formula)}"></div>`
              : `<span class="inline-math" data-math="${encodeURIComponent(formula)}"></span>`;
              
            // Replace all occurrences of the placeholder
            html = html.split(placeholder).join(mathHtml);
          });
          
          setRenderedHtml(html);
        } else {
          // No LaTeX, just render with GitHub API
          const html = isRawMode
            ? await githubMarkdownService.renderMarkdownRaw(content)
            : await githubMarkdownService.renderMarkdown(content, 'gfm');
          
          setRenderedHtml(html);
        }
      } catch (err) {
        console.error('Error rendering markdown:', err);
        setError(err instanceof Error ? err.message : 'Failed to render markdown');
      } finally {
        setIsLoading(false);
      }
    };

    // Use a short timeout to debounce frequent changes
    const timerId = setTimeout(renderMarkdown, 50);
    return () => clearTimeout(timerId);
  }, [content, isRawMode]);

  useEffect(() => {
    if (!renderedHtml) return;

    // Process any LaTeX elements after rendering
    const processLatexElements = () => {
      // Process block math elements
      document.querySelectorAll('.block-math').forEach((element) => {
        const math = decodeURIComponent(element.getAttribute('data-math') || '');
        if (!math) return;
        
        try {
          // Create a container for KaTeX
          const katexContainer = document.createElement('div');
          katexContainer.className = 'katex-block';
          
          // Render KaTeX
          katex.render(math, katexContainer, {
            displayMode: true,
            throwOnError: false
          });
          
          // Replace the original element
          element.innerHTML = '';
          element.appendChild(katexContainer);
        } catch (error) {
          console.error('Error rendering block math:', error);
          element.textContent = `Error in KaTeX block: ${math}`;
          element.className = 'text-red-500';
        }
      });

      // Process inline math elements
      document.querySelectorAll('.inline-math').forEach((element) => {
        const math = decodeURIComponent(element.getAttribute('data-math') || '');
        if (!math) return;
        
        try {
          // Create a container for KaTeX
          const katexContainer = document.createElement('span');
          katexContainer.className = 'katex-inline';
          
          // Render KaTeX
          katex.render(math, katexContainer, {
            displayMode: false,
            throwOnError: false
          });
          
          // Replace the original element
          element.innerHTML = '';
          element.appendChild(katexContainer);
        } catch (error) {
          console.error('Error rendering inline math:', error);
          element.textContent = `Error in KaTeX inline: ${math}`;
          element.className = 'text-red-500';
        }
      });
    };

    // Use requestAnimationFrame to ensure DOM is fully updated
    requestAnimationFrame(processLatexElements);
  }, [renderedHtml]);

  // Early return for empty content - but after all hooks have been called
  if (content === null || typeof content === 'undefined' || content.trim() === "") {
    return null;
  }

  if (isLoading) {
    return <div className="animate-pulse p-4 bg-[var(--color-bg-surface-2)] rounded">Loading markdown...</div>;
  }

  if (error) {
    return (
      <div className="text-red-500 p-2 border border-red-300 rounded bg-red-50 dark:bg-red-900/20">
        Error rendering markdown: {error}
      </div>
    );
  }

  return (
    <div 
      className={`github-markdown ${compact ? 'compact-markdown' : ''} ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
};

export default GithubMarkdownContent; 