import React from 'react';
import { useTranslation } from '../../../App';
import GithubMarkdownContent from '../../../components/GithubMarkdownContent';

interface CombinedQuestionTitleProps {
  questionIndex: number;
  questionText: string;
}

/**
 * A component that combines the question number and text on one line
 */
const CombinedQuestionTitle: React.FC<CombinedQuestionTitleProps> = ({ 
  questionIndex, 
  questionText 
}) => {
  const { t } = useTranslation();
  
  // Get the question number (like "Q1.")
  const questionNumber = t('resultsQuestionItem', { index: questionIndex + 1 });
  // Get the first paragraph of actual content from the question
  let actualQuestionText = questionText;
  
  // Extract the first real sentence or paragraph from the markdown
  const firstParagraphMatch = questionText.match(/(?:<p[^>]*>)?([^<].+?)(?:<\/p>|$)/);
  if (firstParagraphMatch && firstParagraphMatch[1]) {
    actualQuestionText = firstParagraphMatch[1].trim();
  }

  // We'll use these separately in the component
  return (
    <div className="text-[var(--color-text-primary)] font-medium text-sm md:text-base leading-relaxed combined-question-title">
      <span className="question-number">{questionNumber}</span>
      <span className="question-text">
        <GithubMarkdownContent content={actualQuestionText} />
      </span>
    </div>
  );
};

export default CombinedQuestionTitle;
