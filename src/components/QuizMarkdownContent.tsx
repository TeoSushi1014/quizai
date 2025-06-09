
import React from 'react';
import MathText from './MathText'; // Uses the updated MathText for GitHub style

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

  // MathText will apply the 'github-markdown' class internally
  // and use its custom renderers to achieve GitHub style.
  // The className passed here will be appended to the 'github-markdown ...' classes in MathText.
  return (
    <MathText 
      text={content} 
      markdownFormatting={true} // This is key for enabling full Markdown rendering
      className={className} 
      compact={compact} 
    />
  );
};

QuizMarkdownContent.displayName = "QuizMarkdownContentGitHub";
export default QuizMarkdownContent;
