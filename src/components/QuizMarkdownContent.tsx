
import React from 'react';
import GithubMarkdownContent from './GithubMarkdownContent';

interface QuizMarkdownContentProps {
  content: string | undefined | null;
  className?: string;
  compact?: boolean;
}

const QuizMarkdownContent: React.FC<QuizMarkdownContentProps> = ({ 
  content, 
  className = '', 
  compact = false 
}) => {
  if (content === null || typeof content === 'undefined' || content.trim() === "") {
    return null;
  }

  // Use the GitHub API powered markdown renderer
  return (
    <GithubMarkdownContent 
      content={content} 
      className={className} 
      compact={compact} 
      isRawMode={false} // Use standard mode, not raw mode
    />
  );
};

export default QuizMarkdownContent;
