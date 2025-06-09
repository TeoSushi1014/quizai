import React from 'react';
import { useTranslation } from '../App'; // Use project's useTranslation

const sizes = [
  { value: 'sm', labelKey: 'textSizeSmall' },   // Assuming you'll add 'textSizeSmall' etc. to i18n
  { value: 'md', labelKey: 'textSizeMedium' },
  { value: 'lg', labelKey: 'textSizeLarge' },
  { value: 'xl', labelKey: 'textSizeExtraLarge' },
];

interface TextSizeSelectorProps {
  className?: string;
}

const TextSizeSelector: React.FC<TextSizeSelectorProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  
  const handleSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const size = e.target.value;
    const htmlEl = document.documentElement;
    
    // Remove old size classes
    sizes.forEach(s => htmlEl.classList.remove(`text-size-${s.value}`));
    
    // Add new size class
    htmlEl.classList.add(`text-size-${size}`);
    localStorage.setItem('quizai-preferredTextSize', size);
  };
  
  React.useEffect(() => {
    const savedSize = typeof window !== 'undefined' ? localStorage.getItem('quizai-preferredTextSize') || 'md' : 'md';
    const htmlEl = document.documentElement;
    sizes.forEach(s => htmlEl.classList.remove(`text-size-${s.value}`)); // Clean up first
    htmlEl.classList.add(`text-size-${savedSize}`);
  }, []);

  return (
    <div className={`flex items-center ${className}`}>
      <label htmlFor="text-size-selector" className="text-sm font-medium text-[var(--color-text-secondary)] mr-2">
        {t('textSizeSelector')}:
      </label>
      <select
        id="text-size-selector"
        className="bg-[var(--color-bg-surface-2)]/60 text-[var(--color-text-secondary)] text-sm rounded-lg focus:ring-[var(--color-primary-accent)] focus:border-[var(--color-primary-accent)] p-1.5 border border-[var(--color-border-interactive)]"
        onChange={handleSizeChange}
        defaultValue={typeof window !== 'undefined' ? localStorage.getItem('quizai-preferredTextSize') || 'md' : 'md'}
        aria-label={t('textSizeSelector')}
      >
        {sizes.map((size) => (
          <option key={size.value} value={size.value}>{t(size.labelKey as any)}</option>
        ))}
      </select>
    </div>
  );
};
TextSizeSelector.displayName = "TextSizeSelector";
export default TextSizeSelector;
