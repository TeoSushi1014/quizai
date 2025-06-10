
import React, { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import { BlockMath, InlineMath } from 'react-katex';
import { useTranslation } from '../App'; 
import CodeBlock from './CodeBlock';
import MarkdownImage from './MarkdownImage';
import type {CodeProps as ReactMarkdownCodeProps} from 'react-markdown/lib/ast-to-react';

interface MathTextProps {
  text: string | undefined | null;
  markdownFormatting?: boolean;
  className?: string;
  compact?: boolean;
  isPlainText?: boolean; // Added prop for explicit plain text
  stripPrefix?: boolean; // Whether to strip letter prefixes like "A. "
}

// Helper to check and remove letter prefixes like "A. " from text
const stripLetterPrefix = (text: string): string => {
  // Match patterns like "A. ", "B. ", etc. at the beginning of text
  const prefixMatch = text.match(/^([A-Z]\.)\s+/);
  if (prefixMatch) {
    // Return text without the prefix
    return text.substring(prefixMatch[0].length);
  }
  return text;
};

const MathText: React.FC<MathTextProps> = ({ 
  text, 
  markdownFormatting = false, 
  className = '', 
  compact = false,
  isPlainText = false, // Default to false
  stripPrefix = false  // Whether to strip letter prefixes
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  // Effect to remove unnecessary links and fix layout issues
  useEffect(() => {
    if (containerRef.current) {
      // 1. Find and remove links with href="#cu-hi-*"
      const unnecessaryLinks = containerRef.current.querySelectorAll('a[href^="#cu-hi"]');
      unnecessaryLinks.forEach(link => {
        link.parentNode?.removeChild(link);
      });

      // 2. Find and remove links with text "Câu hỏi X"
      const allLinks = containerRef.current.querySelectorAll('a');
      allLinks.forEach(link => {
        if (link.textContent?.trim().match(/^Câu hỏi \d+$/)) {
          link.parentNode?.removeChild(link);
        }
      });
      
      // 3. Find and remove empty headings with id="cu-hi-*" that create unwanted space
      const emptyHeadings = containerRef.current.querySelectorAll('h1[id^="cu-hi"], h2[id^="cu-hi"], h3[id^="cu-hi"]');
      emptyHeadings.forEach(heading => {
        if (heading.textContent?.trim() === '') {
          // Instead of removing, we'll set it to zero height to maintain any ID references
          heading.style.display = 'none';
          heading.style.margin = '0';
          heading.style.padding = '0';
          heading.style.height = '0';
          heading.style.overflow = 'hidden';
        }
      });
      
      // 4. Ensure paragraphs after empty headings have proper spacing
      const paragraphsAfterHeadings = containerRef.current.querySelectorAll('h1[id^="cu-hi"] + p, h2[id^="cu-hi"] + p, h3[id^="cu-hi"] + p');
      paragraphsAfterHeadings.forEach(paragraph => {
        paragraph.style.marginTop = '0';
      });
    }
  }, [text]); // Re-run when text changes

  if (text === null || typeof text === 'undefined' || text.trim() === "") {
    return null;
  }
  
  // Apply prefix stripping if needed
  const processedText = stripPrefix ? stripLetterPrefix(text) : text;

  // If isPlainText is true, render directly as a span
  if (isPlainText) {
    return <span className={`text-[var(--color-text-body)] ${className}`}>{processedText}</span>;
  }

  if (!markdownFormatting) {
    // Handle KaTeX math when not using full markdown
    const parts = processedText.split(/(\$\$.*?\$\$|\$.*?\$)/gs).filter(Boolean);
    
    return (
      <span className={className}>
        {parts.map((part, index) => {
          if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
            const math = part.slice(2, -2);
            try {
              return <BlockMath key={index} math={math} />;
            } catch (error) {
              return <span key={index} className="text-red-500">{`Error in KaTeX block: ${math}`}</span>;
            }
          } else if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
            const math = part.slice(1, -1);
            try {
              return <InlineMath key={index} math={math} />;
            } catch (error) {
              return <span key={index} className="text-red-500">{`Error in KaTeX inline: ${math}`}</span>;
            }
          }
          return <span key={index}>{part}</span>;
        })}
      </span>
    );
  }

  // If the entire text prop is a single fenced code block, render it with CodeBlock directly
  const fencedCodeBlockRegex = /^```(\w+)?\s*\n?([\s\S]*?)\n?```$/;
  const fencedMatch = processedText.match(fencedCodeBlockRegex);
  
  if (fencedMatch) {
    const language = fencedMatch[1] || 'text';
    const codeContent = fencedMatch[2].trim(); // Trim content from regex
    return <CodeBlock language={language} code={codeContent} className={className} />;
  }

  // Otherwise, use ReactMarkdown for full Markdown parsing
  return (
    <div ref={containerRef} className={`markdown-github ${compact ? 'compact-markdown' : ''} ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeRaw]}
        components={{
          h1: ({node, children, ...props}) => {
            const id = children?.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '') || '';
            return (
              <h1 id={id} className="mt-6 mb-4 pb-1 text-2xl font-semibold border-b border-[var(--color-border-default)]" {...props}>
                <a href={`#${id}`} className="no-underline text-[var(--color-text-primary)] hover:underline">{children}</a>
              </h1>
            );
          },
          h2: ({node, children, ...props}) => {
            const id = children?.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '') || '';
            return (
              <h2 id={id} className="mt-5 mb-4 pb-1 text-xl font-semibold border-b border-[var(--color-border-default)]" {...props}>
                <a href={`#${id}`} className="no-underline text-[var(--color-text-primary)] hover:underline">{children}</a>
              </h2>
            );
          },
          h3: ({node, children, ...props}) => {
            // Check for cu-hi pattern in the ID attribute
            if (props.id && props.id.startsWith('cu-hi') && (!children || children.toString().trim() === '')) {
              // Skip rendering empty headings with cu-hi IDs
              return null;
            }
            
            const id = children?.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '') || '';
            return (
              <h3 id={id} className="mt-4 mb-3 text-lg font-semibold text-[var(--color-text-primary)]" {...props}>
                <a href={`#${id}`} className="no-underline text-[var(--color-text-primary)] hover:underline">{children}</a>
              </h3>
            );
          },
          
          code: ({node, inline, className: langClass, children, ...props}: ReactMarkdownCodeProps) => {
            const matchLang = /language-(\w+)/.exec(langClass || '');
            const content = String(children).replace(/\n$/, '');
            
            if (inline) {
              return (
                <code 
                  className={`px-1.5 py-0.5 mx-0.5 rounded-md bg-[var(--color-bg-surface-2)] font-mono text-sm ${langClass || ''}`}
                  {...props}
                >
                  {children}
                </code>
              );
            }
            
            // For block code identified by ReactMarkdown
            const language = matchLang?.[1] || 'text';
            
            // Heuristic: if language is 'text' and content is simple (single line, no special markdown/html chars), render as plain text.
            const isSimpleText = (language === 'text') && 
                                 !content.includes('\n') && 
                                 content.length < 200 && // Arbitrary length check for "simple"
                                 !/[*#_~`<>\[\]{}]|\$.*\$/.test(content); // Check for common markdown and LaTeX delimiters

            if (isSimpleText) {
              return <span className="text-[var(--color-text-body)]">{content}</span>;
            }
            
            return <CodeBlock language={language} code={content} />;
          },

          strong: ({node, children, ...props}) => {
            // Make sure strong text never gets href attributes and inherits proper text color
            return <strong className="font-bold text-current no-href-style inline align-baseline" style={{display: 'inline', lineHeight: 'inherit'}} {...props}>{children}</strong>;
          },
          em: ({node, ...props}) => <em className="italic" {...props} />,
          
          ul: ({node, children, ...props}) => {
             const isTaskList = React.Children.toArray(children).some(child =>
                React.isValidElement(child) && 
                (child.props as any).className?.includes('task-list-item')
            );
            return <ul className={`list-disc pl-6 mb-4 text-[var(--color-text-body)] ${isTaskList ? 'contains-task-list' : ''}`} {...props}>{children}</ul>;
          },
          ol: ({node, children, ...props}) => <ol className="list-decimal pl-6 mb-4 text-[var(--color-text-body)]" {...props}>{children}</ol>,
          li: ({node, children, ...props}) => {
            const classNameProp = node?.properties?.className;
            const isTaskListItem = typeof classNameProp === 'string' && classNameProp.includes('task-list-item');
            
            const liClassName = `mb-1 text-[var(--color-text-body)] ${isTaskListItem ? 'task-list-item' : ''}`;
            
            if (isTaskListItem && Array.isArray(children)) {
              const checkboxNode = children.find(child => {
                if (React.isValidElement(child) && child.type === 'input') {
                  const inputProps = child.props as React.InputHTMLAttributes<HTMLInputElement>;
                  return inputProps.type === 'checkbox';
                }
                return false;
              });

              const textChildren = children.filter(child => {
                if (React.isValidElement(child) && child.type === 'input') {
                  const inputProps = child.props as React.InputHTMLAttributes<HTMLInputElement>;
                  return inputProps.type !== 'checkbox';
                }
                return true;
              });
              
              return (
                <li className={liClassName} {...props}>
                  {checkboxNode}
                  {textChildren.length > 0 && <span className="task-list-item-label">{textChildren}</span>}
                </li>
              );
            }
            return <li className={liClassName} {...props}>{children}</li>;
          },
          
          a: ({node, children, ...props}) => {
            // Check if this is a text that shouldn't be a link (based on href pattern)
            const href = props.href || '';
            const isSpecialText = /^#(van-de|text|trong|cu-hi)/.test(href) ||
                                 (typeof children === 'string' && 
                                  /^(text|trong|van-de|Câu hỏi)/i.test(children as string));
            
            if (isSpecialText) {
              // Render as normal text instead of a link, or filter out completely if it's a "Câu hỏi" link
              if (typeof children === 'string' && /^Câu hỏi \d+$/i.test(children as string)) {
                // Don't render "Câu hỏi" links at all
                return null;
              }
              return <span className="text-[var(--color-text-body)]">{children}</span>;
            }
            
            // Normal link rendering
            return (
              <a 
                className="text-[var(--color-primary-accent)] hover:underline" 
                target={href.startsWith('#') ? undefined : (href.startsWith('http') ? "_blank" : undefined)}
                rel={href.startsWith('http') ? "noopener noreferrer" : undefined}
                {...props} 
              />
            );
          },
          
          img: ({node, ...imgProps}) => <MarkdownImage src={imgProps.src} alt={imgProps.alt || ''} />,
          
          table: ({node, ...props}) => (
            <div className="overflow-x-auto my-4 border border-[var(--color-border-default)] rounded-md">
              <table className="min-w-full border-collapse" {...props} />
            </div>
          ),
          thead: ({node, ...props}) => <thead className="bg-[var(--color-bg-surface-2)]" {...props} />,
          tbody: ({node, ...props}) => <tbody {...props} />,
          tr: ({node, ...props}) => <tr className="border-b border-[var(--color-border-default)] last:border-b-0" {...props} />,
          th: ({node, ...props}) => <th className="px-4 py-3 text-left font-semibold text-[var(--color-text-primary)] border-r last:border-r-0 border-[var(--color-border-default)]" {...props} />,
          td: ({node, ...props}) => <td className="px-4 py-2 border-r last:border-r-0 border-[var(--color-border-default)] text-[var(--color-text-body)]" {...props} />,
          
          blockquote: ({node, ...props}) => (
            <blockquote className="border-l-4 border-[var(--color-border-default)] pl-4 my-4 text-[var(--color-text-secondary)] italic" {...props} />
          ),
          
          hr: ({node, ...props}) => <hr className="my-6 border-t border-[var(--color-border-default)]" {...props} />,
          
          p: ({node, ...props}) => {
            // Special case for short content (like "3.80")
            const isShortContent = React.Children.count(props.children) === 1 && 
              typeof props.children === 'string' && 
              props.children.length < 10;
            
            // Do not use text-[var(--color-text-body)] directly in paragraphs
            // This can cause style conflicts with nested elements
            const contentClasses = [
              compact || isShortContent ? 'my-0' : 'mb-4',
              // Add special class for number-only content to improve vertical alignment
              typeof props.children === 'string' && /^\d+(\.\d+)?$/.test(props.children as string) ? 'flex items-center h-full' : ''
            ].filter(Boolean).join(' ');
            
            return (
              <p className={contentClasses} {...props} />
            );
          },
           
          input: ({node, disabled, checked, ...props}) => {
            if (props.type === 'checkbox') {
              return (
                <input
                  type="checkbox"
                  checked={Boolean(checked)} 
                  disabled={Boolean(disabled)} 
                  readOnly 
                  className="mr-2 mt-0.5 task-list-item-checkbox" 
                />
              );
            }
            return <input {...props} />;
          },
        }}
      >
        {processedText}
      </ReactMarkdown>
    </div>
  );
};
MathText.displayName = "MathTextGitHubFinalFix";
export default MathText;
