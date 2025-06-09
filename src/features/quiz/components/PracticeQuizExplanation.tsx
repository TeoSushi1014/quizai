import React from 'react';
import MathText from '../../../components/MathText';
import { useTranslation } from '../../../App';

interface PracticeQuizExplanationProps {
  explanation: string;
  className?: string;
}

const PracticeQuizExplanation: React.FC<PracticeQuizExplanationProps> = ({ explanation, className = '' }) => {
  const { t } = useTranslation();

  return (
    // Added animation and styling enhancements
    <div className={`animate-fadeInUp mt-5 p-5 rounded-lg bg-[var(--color-bg-surface-2)]/50 border border-[var(--color-border-default)] shadow-md ${className}`}>
      <div className="flex items-center gap-2 mb-3"> 
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--color-primary-accent)]" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <span className="font-semibold text-[var(--color-primary-accent)] text-base">{t('resultsExplanationTitle')}</span>
      </div>
      
      <div className="pl-1.5 border-l-2 border-[var(--color-primary-accent)]/20"> 
        <MathText 
          text={explanation} 
          markdownFormatting={true} 
          compact={true} 
          className="text-sm text-[var(--color-text-body)] leading-relaxed" 
        />
      </div>
    </div>
  );
};
PracticeQuizExplanation.displayName = "PracticeQuizExplanation";
export default PracticeQuizExplanation;
