import React from 'react';
import { useAppContext, useTranslation } from '../../../App';
import MathText from '../../../components/MathText'; 
import { Button, ProgressBar } from '../../../components/ui';

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
          <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
            {progress.toFixed(0)}%
          </span>
        </div>
        <ProgressBar 
          progress={progress} 
          size="md" 
          className="mb-5" 
        />
      </div>

      {/* Show feedback banner when answer is checked */}
      {isAnswerChecked && (
        <div className={`mb-4 p-3 rounded-lg flex items-center feedback-banner ${
          isAnswerCorrect 
            ? 'bg-green-100 dark:bg-green-900/30 border-l-4 border-green-500' 
            : 'bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500'
        }`}>
          <div className={`mr-2.5 ${isAnswerCorrect ? 'text-green-500' : 'text-red-500'}`}>
            {isAnswerCorrect ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <div>
            <p className={`font-medium ${isAnswerCorrect ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
              {isAnswerCorrect ? t('answerCorrect') : t('answerIncorrect')}
            </p>
            {!isAnswerCorrect && (
              <p className="text-sm text-red-600 dark:text-red-300 mt-0.5">
                {t('resultsCorrectAnswerMC')} <span className="font-medium">{correctAnswer}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Use MathText for the question text */}
      <div className="question-content mb-4"> 
        <MathText text={question} markdownFormatting={true} />
      </div>

      <div className="space-y-3"> {/* Replaced quiz-options with space-y for Tailwind consistency */}
        {options.map((option, index) => {
          // Determine the button style based on check state and correctness
          const isSelected = selectedOption === option;
          const isThisOptionCorrect = correctAnswer === option;
          
          let buttonStyle = '';
          let indicatorStyle = '';
          let animationStyle = '';
          
          if (isAnswerChecked) {
            if (isSelected && isAnswerCorrect) {
              // Correct answer - green
              buttonStyle = 'answer-option-correct bg-green-100 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-300 font-semibold scale-[1.01]';
              indicatorStyle = 'border-green-500 bg-green-500';
              animationStyle = 'correct-answer-pulse';
            } else if (isSelected && !isAnswerCorrect) {
              // Wrong answer - red
              buttonStyle = 'answer-option-incorrect bg-red-100 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-300 font-semibold scale-[1.01]';
              indicatorStyle = 'border-red-500 bg-red-500';
              animationStyle = 'incorrect-answer-pulse';
            } else if (isThisOptionCorrect) {
              // Show the correct answer - highlighted in green
              buttonStyle = 'answer-option-correct bg-green-100 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-300 font-semibold';
              indicatorStyle = 'border-green-500 bg-green-500';
            } else {
              // Unselected, incorrect options - dimmed
              buttonStyle = 'bg-[var(--color-bg-surface-3)]/70 border-[var(--color-border-interactive)] text-[var(--color-text-secondary)]';
              indicatorStyle = 'border-[var(--color-text-muted)] bg-[var(--color-bg-surface-2)]';
            }
          } else {
            // Not checked yet - default styling
            buttonStyle = isSelected 
              ? 'bg-[var(--color-primary-accent)]/50 border-[var(--color-primary-accent)] text-[var(--color-primary-accent-text)] font-semibold scale-[1.01]'
              : 'bg-[var(--color-bg-surface-3)]/70 hover:bg-[var(--color-bg-surface-3)]/40 border-[var(--color-border-interactive)] hover:border-[var(--color-primary-accent)] text-[var(--color-text-primary)]';
            indicatorStyle = isSelected 
              ? 'border-[var(--color-primary-accent-text)] bg-[var(--color-primary-accent)]'
              : 'border-[var(--color-text-muted)] bg-[var(--color-bg-surface-2)] group-hover:border-[var(--color-primary-accent)]';
          }
          
          return (
            <button
              key={index}
              type="button"
              className={`w-full flex items-center text-left p-3.5 sm:p-4 rounded-xl border-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-primary-accent)]/50 focus-visible:ring-offset-2 shadow-lg 
                          transition-all var(--duration-fast) var(--ease-ios) will-change-transform, border, background-color
                          ${buttonStyle} ${animationStyle}`}
              onClick={() => onSelectOption(option)}
              disabled={isSubmitting || isAnswerChecked}
              aria-pressed={isSelected}
              aria-checked={isAnswerChecked && isThisOptionCorrect ? "true" : "false"}
            >
              <span className={`option-indicator mr-3.5 flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${indicatorStyle}`}>
                {(isSelected || (isAnswerChecked && isThisOptionCorrect)) && <div className="w-3 h-3 bg-white rounded-full"></div>}
              </span>
              {/* Use MathText for option text with letter prefix stripping */}
              <div className="option-content flex-grow text-sm sm:text-base flex items-center"> 
                <MathText text={option} markdownFormatting={true} compact={true} stripPrefix={true}/>
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

      <div className="flex flex-col sm:flex-row justify-between items-center mt-5 pt-5 border-t border-[var(--color-border-default)] gap-3">
        {!isAnswerChecked ? (
          <>
            <Button
              variant="subtle" 
              onClick={onSkipQuestion}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              {t('skipQuestion')}
            </Button>
            <Button
              variant="primary"
              onClick={onCheckAnswer}
              disabled={isSubmitting || !selectedOption}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? t('loading') : t('checkAnswer')}
            </Button>
          </>
        ) : (
          <div className="w-full flex justify-end items-center">
            {/* Feedback moved to banner at top */}
          </div>
        )}
      </div>
    </div>
  );
};
PracticeQuizQuestion.displayName = "PracticeQuizQuestion";
export default PracticeQuizQuestion;
