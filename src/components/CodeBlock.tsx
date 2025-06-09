
import React, { useState } from 'react';
import styled from 'styled-components';
import { useTranslation } from '../App'; // Correct path for useTranslation

// Close icon removed

// Copy and Check icons for the copy functionality
const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" className="w-4 h-4">
    <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
  </svg>
);

const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" className="w-4 h-4">
    <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
    <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
  </svg>
);

interface CodeBlockProps {
  language: string;
  code: string;
  className?: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, code, className = '' }) => {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  // Format code to show syntax highlighting similar to the example
  const formatCode = () => {
    if (!code) return null;
    
    // This is a simplified approach - for real syntax highlighting you might want to use a library
    const formattedCode = code
      .split('\n')
      .map((line, index) => {
        // Apply different styling based on content patterns
        // This is a basic example - you would enhance this based on your language
        let formattedLine = line;
        
        // Match CSS selectors
        formattedLine = formattedLine.replace(/([.#][a-zA-Z0-9_-]+)/g, '<span class="color-0">$1</span>');
        
        // Match CSS properties
        formattedLine = formattedLine.replace(/([a-zA-Z-]+)(?=:)/g, '<span class="color-2">$1</span>');
        
        // Match CSS values
        formattedLine = formattedLine.replace(/:(.*);/g, ':<span class="color-1">$1</span>;');
        
        return (
          <p key={index} className={line.includes(':') ? 'property' : ''} 
             dangerouslySetInnerHTML={{ __html: formattedLine }} />
        );
      });
    
    return formattedCode;
  };

  return (
    <StyledWrapper className={className}>
      <div className="code-editor">
        <div className="header">
          <span className="title">{language.toUpperCase()}</span>
          <div className="actions">
            <button
              onClick={copyToClipboard}
              className="copy-button"
              aria-label={copied ? t('copied') : t('copy')}
              title={copied ? t('copied') : t('copy')}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
          </div>
        </div>
        <div className="editor-content">
          <code className="code">
            {formatCode()}
          </code>
        </div>
      </div>
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div`
  .code-editor {
    max-width: 100%;
    background-color: #1d1e22;
    box-shadow: 0px 4px 30px rgba(0, 0, 0, 0.5);
    border-radius: 8px;
    padding: 2px;
    overflow: auto;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 10px;
  }

  .title {
    font-family: Lato, sans-serif;
    font-weight: 900;
    font-size: 14px;
    letter-spacing: 1.57px;
    color: rgb(212 212 212);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .copy-button {
    background: none;
    border: none;
    cursor: pointer;
    color: #6e7281;
  }

  /* Icon styles removed */

  .editor-content {
    margin: 0 10px 10px;
    color: white;
    overflow-x: auto;
  }

  .property {
    margin-left: 30px;
  }

  .property:hover {
    cursor: text;
  }

  .editor-content .color-0 {
    color: rgb(86 156 214);
  }

  .editor-content .color-1 {
    color: rgb(182 206 168);
  }

  .editor-content .color-2 {
    color: rgb(156 220 254);
  }

  .editor-content .color-3 {
    color: rgb(207 146 120);
  }

  .code {
    white-space: pre-wrap;
    font-family: monospace;
  }

  .color-preview-1,.color-preview-2 {
    height: 8px;
    width: 8px;
    border: 1px solid #fff;
    display: inline-block;
    margin-right: 3px;
  }

  .color-preview-1 {
    background-color: #1d1e22;
  }

  .color-preview-2 {
    background-color: rgba(0, 0, 0, 0.5);
  }
`;

CodeBlock.displayName = "CodeBlockStylish";
export default CodeBlock;