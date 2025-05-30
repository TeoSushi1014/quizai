
import React from 'react';
import { useTheme, ThemeType } from '../contexts/ThemeContext';
import { useTranslation } from '../App'; // Assuming useTranslation is from App context setup
import { SunIcon, MoonIcon } from '../constants';
import { Tooltip, Toggle, Button } from './ui'; // Assuming Button is also from ui

interface ThemeToggleProps {
  showLabel?: boolean;
  compact?: boolean; // For icon-only button
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
          size="sm" // Consistent small size for icon buttons
          onClick={toggleTheme}
          className={`!p-2 sm:!p-2.5 !text-[var(--color-text-secondary)] hover:!text-[var(--color-primary-accent)] hover:!bg-[var(--color-primary-accent)]/10 rounded-lg ${className}`}
          aria-label={labelText}
        >
          {theme === 'dark' ? 
            <SunIcon className="w-5 h-5" /> : // SunIcon now displays light mode icon
            <MoonIcon className="w-5 h-5" /> // MoonIcon now displays dark mode icon
          }
        </Button>
      </Tooltip>
    );
  }
  
  // Full button with label and icon (not typically used directly in header like this, but available)
  return (
    <Button
      onClick={toggleTheme}
      variant="ghost" // Default to ghost, can be changed by className
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

  return (
    <button
        onClick={toggleTheme}
        className={`w-full text-left px-5 py-3.5 text-sm text-[var(--color-text-body)] hover:bg-[var(--color-bg-surface-2)] active:bg-[var(--color-bg-surface-3)] flex items-center justify-between hover:text-[var(--color-primary-accent)] transition-colors var(--duration-fast) var(--ease-ios) ${className}`}
        role="menuitemcheckbox"
        aria-checked={theme === 'dark'}
        aria-label={accessibilityLabel}
    >
      <div className="flex items-center">
        {theme === 'dark' ? 
            <MoonIcon className="w-4 h-4 mr-3 flex-shrink-0"/> : 
            <SunIcon className="w-4 h-4 mr-3 flex-shrink-0"/>}
        {currentModeText}
      </div>
      <Toggle checked={theme === 'dark'} onChange={() => {}} label="" disabled={false} />
    </button>
  );
};
ThemeToggleSwitch.displayName = "ThemeToggleSwitch";