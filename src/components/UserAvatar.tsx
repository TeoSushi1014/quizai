
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../App';
import { LoadingSpinner } from './ui';

type UserAvatarProps = {
  photoUrl?: string | null;
  userName?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const IMAGE_LOAD_TIMEOUT_MS = 10000; // 10 seconds

export const UserAvatar: React.FC<UserAvatarProps> = ({
  photoUrl,
  userName,
  size = 'md',
  className = ''
}) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(!!photoUrl); // Start loading only if photoUrl is initially present
  const [hasError, setHasError] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear any existing timeout when photoUrl changes or component unmounts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (photoUrl) {
      setIsLoading(true);
      setHasError(false);

      timeoutRef.current = setTimeout(() => {
        if (isLoading) { // Check if still loading when timeout fires
          console.warn('UserAvatar: Image loading timed out for URL:', photoUrl);
          setIsLoading(false);
          setHasError(true);
        }
      }, IMAGE_LOAD_TIMEOUT_MS);

    } else {
      setIsLoading(false);
      setHasError(false);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [photoUrl]); // isLoading is intentionally not in dependencies here to avoid resetting timeout on its change

  const clearLoadTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handleImageLoad = () => {
    clearLoadTimeout();
    setIsLoading(false);
    setHasError(false);
  };

  const handleImageError = () => {
    clearLoadTimeout();
    console.error('UserAvatar: Failed to load image from URL:', photoUrl);
    setIsLoading(false);
    setHasError(true);
  };

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  };
  const initialsFontSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };
  const spinnerSizeMapping = {
    sm: 'xs',
    md: 'sm',
    lg: 'sm'
  } as const;

  const sizeClass = sizeClasses[size];
  const initialsFontSizeClass = initialsFontSizeClasses[size];
  const currentSpinnerSize = spinnerSizeMapping[size];
  
  const initials = userName?.charAt(0).toUpperCase() || '?';
  const avatarGenericAlt = t('userAvatarGeneric');
  const avatarWithNameAlt = userName ? t('userAvatarAlt', { name: userName }) : avatarGenericAlt;
  const avatarFallbackAriaLabel = userName ? t('userAvatarWithName', { name: userName }) : t('userAvatar');

  // Fallback 1: No photo URL provided at all OR error occurred
  if (!photoUrl || hasError) {
    return (
      <div
        className={`${sizeClass} rounded-full bg-[var(--color-primary-accent)] flex items-center justify-center text-[var(--color-primary-accent-text)] font-semibold ${initialsFontSizeClass} ${className}`}
        aria-label={avatarFallbackAriaLabel}
        role="img" // Indicate it's an image replacement
      >
        {initials}
      </div>
    );
  }

  // Attempt to load and display the image
  return (
    <div className={`${sizeClass} rounded-full bg-[var(--color-bg-surface-2)] flex items-center justify-center text-[var(--color-text-primary)] relative overflow-hidden ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-bg-surface-2)]">
          <LoadingSpinner size={currentSpinnerSize} />
        </div>
      )}
      <img
        key={photoUrl} 
        src={photoUrl}
        alt={avatarWithNameAlt}
        className={`${sizeClass} rounded-full object-cover transition-opacity duration-300 ${isLoading || hasError ? 'opacity-0' : 'opacity-100'}`}
        onLoad={handleImageLoad}
        onError={handleImageError}
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

UserAvatar.displayName = "UserAvatar";
