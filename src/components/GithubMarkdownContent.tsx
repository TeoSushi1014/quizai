import React, { useState, useEffect } from 'react';
import { githubMarkdownService } from '../services/githubMarkdownService';
import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

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

  useEffect(() => {
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
          // Process LaTeX manually before sending to GitHub API
          const parts = content.split(/(\$\$.*?\$\$|\$.*?\$)/gs).filter(Boolean);
          
          // Process each part separately
          const processedParts = await Promise.all(parts.map(async (part) => {
            if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
              // It's a block math expression, don't send to GitHub API
              return `<div class="block-math" data-math="${encodeURIComponent(part.slice(2, -2))}"></div>`;
            } else if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
              // It's an inline math expression, don't send to GitHub API
              return `<span class="inline-math" data-math="${encodeURIComponent(part.slice(1, -1))}"></span>`;
            } else {
              // Regular markdown content, render with GitHub API
              return isRawMode 
                ? await githubMarkdownService.renderMarkdownRaw(part)
                : await githubMarkdownService.renderMarkdown(part, 'gfm');
            }
          }));
          
          // Join the processed parts
          setRenderedHtml(processedParts.join(''));
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

    renderMarkdown();
  }, [content, isRawMode]);

  useEffect(() => {
    if (!renderedHtml) return;

    // Process any LaTeX elements after rendering
    const processLatexElements = () => {
      // Process block math elements
      document.querySelectorAll('.block-math').forEach((element) => {
        const math = decodeURIComponent(element.getAttribute('data-math') || '');
        try {
          // Create a React element for BlockMath
          const reactElement = document.createElement('div');
          element.replaceWith(reactElement);
          
          // Render BlockMath into the element
          const katexContainer = document.createElement('div');
          katexContainer.className = 'katex-block';
          reactElement.appendChild(katexContainer);
          
          import('katex').then((katex) => {
            katex.default.render(math, katexContainer, {
              displayMode: true,
              throwOnError: false
            });
          });
        } catch (error) {
          console.error('Error rendering block math:', error);
          element.textContent = `Error in KaTeX block: ${math}`;
          element.className = 'text-red-500';
        }
      });

      // Process inline math elements
      document.querySelectorAll('.inline-math').forEach((element) => {
        const math = decodeURIComponent(element.getAttribute('data-math') || '');
        try {
          // Create a React element for InlineMath
          const reactElement = document.createElement('span');
          element.replaceWith(reactElement);
          
          // Render InlineMath into the element
          const katexContainer = document.createElement('span');
          katexContainer.className = 'katex-inline';
          reactElement.appendChild(katexContainer);
          
          import('katex').then((katex) => {
            katex.default.render(math, katexContainer, {
              displayMode: false,
              throwOnError: false
            });
          });
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