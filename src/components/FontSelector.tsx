import React from 'react';
import { useTranslation } from '../App'; // Use project's useTranslation

const fonts = [
  { value: "'Inter', 'Roboto', 'Noto Sans Vietnamese', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'", label: 'Inter (Default)' },
  { value: "'Roboto', 'Noto Sans Vietnamese', Arial, sans-serif", label: 'Roboto' },
  { value: "'Noto Sans Vietnamese', 'Inter', system-ui, sans-serif", label: 'Noto Sans Vietnamese' },
  { value: "Arial, Helvetica, sans-serif", label: 'Arial' },
  { value: "'Times New Roman', Times, serif", label: 'Times New Roman' },
];

interface FontSelectorProps {
  className?: string;
}

const FontSelector: React.FC<FontSelectorProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  
  const handleFontChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    document.documentElement.style.setProperty('--font-primary', e.target.value);
    localStorage.setItem('quizai-preferredFont', e.target.value);
  };
  
  React.useEffect(() => {
    const savedFont = localStorage.getItem('quizai-preferredFont');
    if (savedFont) {
      document.documentElement.style.setProperty('--font-primary', savedFont);
    }
  }, []);

  return (
    <div className={`flex items-center ${className}`}>
      <label htmlFor="font-selector" className="text-sm font-medium text-[var(--color-text-secondary)] mr-2">
        {t('fontSelector')}:
      </label>
      <select
        id="font-selector"
        className="bg-[var(--color-bg-surface-2)]/60 text-[var(--color-text-secondary)] text-sm rounded-lg focus:ring-[var(--color-primary-accent)] focus:border-[var(--color-primary-accent)] p-1.5 border border-[var(--color-border-interactive)]"
        onChange={handleFontChange}
        defaultValue={typeof window !== 'undefined' ? localStorage.getItem('quizai-preferredFont') || fonts[0].value : fonts[0].value}
        aria-label={t('fontSelector')}
      >
        {fonts.map((font) => (
          <option key={font.value} value={font.value}>{font.label}</option>
        ))}
      </select>
    </div>
  );
};
FontSelector.displayName = "FontSelector";
export default FontSelector;
