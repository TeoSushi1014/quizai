import React from 'react';
import { useTranslation } from '../../../App';
import { Button, ProgressBar } from '../../../components/ui';
import GithubMarkdownContent from '../../../components/GithubMarkdownContent';

interface QuestionProps {
  question: string;
  options: string[];
  currentIndex: number;
  totalQuestions: number;
  selectedOption: string | null;
  onSelectOption: (option: string) => void;
  onCheckAnswer: () => void;
  onSkipQuestion: () => void;
  isSubmitting: boolean;
  isAnswerChecked?: boolean;
  isAnswerCorrect?: boolean | null;
  correctAnswer?: string;
}

const PracticeQuizQuestion: React.FC<QuestionProps> = ({
  question,
  options,
  currentIndex,
  totalQuestions,
  selectedOption,
  onSelectOption,
  onCheckAnswer,
  onSkipQuestion,
  isSubmitting,
  isAnswerChecked = false,
  isAnswerCorrect = null,
  correctAnswer = "",
}) => {
  const { t } = useTranslation();
  const progress = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;

  return (
    <div className="quiz-question-container">
      <div className="quiz-progress">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {t('quizTakingQuestionProgress', { current: currentIndex + 1, total: totalQuestions })}
          </span>
        </div>
        <ProgressBar 
          progress={progress} 
          size="md" 
          className="mb-5" 
        />
      </div>

      {/* Use GithubMarkdownContent for the question text */}
      <div className="question-content mb-4"> 
        <GithubMarkdownContent content={question} />
      </div>

      <div className="question-options space-y-2.5">
        {options.map((option, index) => {
          const isSelected = selectedOption === option;
          const isThisOptionCorrect = isAnswerChecked && option === correctAnswer;
          
          // Define dynamic classes based on state
          let optionClasses = "flex w-full p-3.5 rounded-lg border transition-all duration-300 ease-in-out";
          let textClasses = "text-[var(--color-text-body)]";
          
          if (isSelected) {
            if (isAnswerChecked) {
              if (isAnswerCorrect) {
                // Correct answer selected
                optionClasses += " border-green-500 bg-green-500/10";
                textClasses = "text-green-700 dark:text-green-300 font-medium";
              } else {
                // Incorrect answer selected
                optionClasses += " border-red-500 bg-red-500/10";
                textClasses = "text-red-700 dark:text-red-300";
              }
            } else {
              // Selected but not checked yet
              optionClasses += " border-[var(--color-primary-accent)] bg-[var(--color-primary-accent)]/10";
              textClasses = "text-[var(--color-primary-accent)] font-medium";
            }
          } else if (isAnswerChecked && option === correctAnswer) {
            // Correct answer wasn't selected
            optionClasses += " border-blue-500 bg-blue-500/10";
            textClasses = "text-blue-700 dark:text-blue-300 font-medium";
          } else {
            // Default unselected state
            optionClasses += " border-[var(--color-border-default)] bg-[var(--color-bg-surface-2)]/50 hover:bg-[var(--color-bg-surface-2)]";
          }
          
          return (
            <button
              key={index}
              className={optionClasses}
              onClick={() => onSelectOption(option)}
              disabled={isAnswerChecked || isSubmitting}
              aria-checked={isSelected}
              role="radio"
              aria-disabled={isAnswerChecked || isSubmitting}
            >
              {/* Option letter indicator */}
              <div className="option-index mr-3 min-w-[1.5rem] h-6 flex items-center justify-center rounded-full text-xs font-bold">
                {String.fromCharCode(65 + index)}
              </div>
              
              {/* Option content with GitHub-style markdown */}
              <div className="option-content flex-grow text-sm sm:text-base flex items-center"> 
                <GithubMarkdownContent content={option} compact={true} />
              </div>
              
              {/* Show check/x mark for checked answers */}
              {isAnswerChecked && (
                <span className="ml-2">
                  {isThisOptionCorrect ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (isSelected && !isAnswerCorrect) ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  ) : null}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="quiz-actions flex gap-3 mt-6">
        {!isAnswerChecked ? (
          <>
            <Button
              variant="primary"
              onClick={onCheckAnswer}
              disabled={!selectedOption || isSubmitting}
              className="flex-1"
              isLoading={isSubmitting}
            >
              {t('checkAnswer')}
            </Button>
            <Button
              variant="outline"
              onClick={onSkipQuestion}
              disabled={isSubmitting}
              className="flex-grow-0 px-4"
            >
              {t('skipQuestion')}
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            onClick={onSkipQuestion}
            className="w-full"
          >
            {t('nextQuestion')}
          </Button>
        )}
      </div>
    </div>
  );
};

export default PracticeQuizQuestion;
