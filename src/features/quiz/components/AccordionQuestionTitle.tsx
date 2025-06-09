import React from 'react';
import { useTranslation } from '../../../App';
import { CheckCircleIcon, XCircleIcon } from '../../../constants';
import { Question } from '../../../types';
import { extractQuestionText } from '../../../utils/textUtils';

interface AccordionQuestionTitleProps {
  question: Question;
  index: number;
  isCorrect: boolean;
}

/**
 * A specialized component for rendering question titles in accordions
 * that combines the question number and text on the same line
 */
const AccordionQuestionTitle: React.FC<AccordionQuestionTitleProps> = ({
  question,
  index,
  isCorrect
}) => {
  const { t } = useTranslation();
  
  // Get the question number (like "Q1.")
  const questionNumber = t('resultsQuestionItem', { index: index + 1 });
  // Get the actual question text, removing markdown formatting and extracting the main question
  const questionText = extractQuestionText(question.questionText);

  return (
    <div className="flex items-start w-full gap-3">
      <div
        className={`flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex-shrink-0 mt-0.5 ${
          isCorrect
            ? "bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-300"
            : "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-300"
        }`}
      >
        {isCorrect ? (
          <CheckCircleIcon className="w-5 h-5" />
        ) : (
          <XCircleIcon className="w-5 h-5" />
        )}
      </div>
        <div className="ml-1 flex-grow min-w-0 inline-flex items-baseline">
        <span className="text-[var(--color-text-secondary)] text-xs font-semibold mr-1.5">
          {questionNumber}
        </span>
        <span className="text-[var(--color-text-primary)] font-medium text-sm md:text-base leading-relaxed whitespace-pre-line">
          {questionText}
        </span>
      </div>
    </div>
  );
};

export default AccordionQuestionTitle;
