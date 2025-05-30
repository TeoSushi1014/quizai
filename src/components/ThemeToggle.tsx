
import React from 'react';
import { useTheme, ThemeType } from '../contexts/ThemeContext';
import { useTranslation } from '../App'; 
import { SunIcon, MoonIcon } from '../constants';
import { Tooltip, Toggle, Button } from './ui'; 

interface ThemeToggleProps {
  showLabel?: boolean;
  compact?: boolean; 
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  showLabel = false, 
  compact = false,
  className = '',
}) => {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  
  const labelText = theme === 'dark' ? t('switchToLightTheme') : t('switchToDarkTheme');
  const iconAltText = theme === 'dark' ? t('lightMode') : t('darkMode');

  if (compact) {
    return (
      <Tooltip 
        content={labelText}
        placement="bottom"
      >
        <Button
          variant="ghost"
          size="sm" 
          onClick={toggleTheme}
          className={`!p-2 sm:!p-2.5 !text-[var(--color-text-secondary)] hover:!text-[var(--color-primary-accent)] hover:!bg-[var(--color-primary-accent)]/10 rounded-lg ${className}`}
          aria-label={labelText}
        >
          {theme === 'dark' ? 
            <SunIcon className="w-5 h-5" /> : 
            <MoonIcon className="w-5 h-5" /> 
          }
        </Button>
      </Tooltip>
    );
  }
  
  
  return (
    <Button
      onClick={toggleTheme}
      variant="ghost" 
      size="md"
      className={`flex items-center space-x-2 !text-[var(--color-text-secondary)] hover:!text-[var(--color-primary-accent)] hover:!bg-[var(--color-primary-accent)]/10 ${className}`}
      aria-label={showLabel ? undefined : labelText}
    >
      {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
      {showLabel && (
        <span>{labelText}</span>
      )}
    </Button>
  );
};
ThemeToggle.displayName = "ThemeToggle";


export const ThemeToggleSwitch: React.FC<{className?: string}> = ({ className }) => {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  
  const accessibilityLabel = theme === 'dark' ? t('switchToLightTheme') : t('switchToDarkTheme');
  const currentModeText = theme === 'dark' ? t('darkMode') : t('lightMode');
  const isDarkMode = theme === 'dark';

  return (
    <button
        onClick={toggleTheme} // Main button handles the click
        className={`w-full text-left px-5 py-3.5 text-sm text-[var(--color-text-body)] hover:bg-[var(--color-bg-surface-2)] active:bg-[var(--color-bg-surface-3)] flex items-center justify-between hover:text-[var(--color-primary-accent)] transition-colors var(--duration-fast) var(--ease-ios) ${className}`}
        role="menuitemcheckbox"
        aria-checked={isDarkMode}
        aria-label={accessibilityLabel} // Accessibility label for the whole button
    >
      <div className="flex items-center">
        {isDarkMode ? 
            <SunIcon className="w-4 h-4 mr-3 flex-shrink-0"/> : 
            <MoonIcon className="w-4 h-4 mr-3 flex-shrink-0"/>}
        {currentModeText} {/* Dynamic text: "Dark Mode" or "Light Mode" */}
      </div>
      {/* The Toggle component is now more of a visual indicator, click handled by parent */}
      <Toggle 
        checked={isDarkMode} 
        onChange={toggleTheme} // Also allow clicking the switch itself
        label="" // No separate label for the inner toggle
        disabled={false} 
        size="sm" // Smaller toggle switch
      />
    </button>
  );
};
ThemeToggleSwitch.displayName = "ThemeToggleSwitch";
