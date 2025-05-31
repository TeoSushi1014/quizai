
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile } from '../types';
import { useTranslation } from '../App';
import { LoadingSpinner } from './ui'; // Changed Spinner to LoadingSpinner

interface UserAvatarProps {
  user: UserProfile | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  [key: string]: any; // Allow other props
}

const IMAGE_LOAD_TIMEOUT_MS = 10000; // 10 seconds

const UserAvatar = ({ user, size = 'md', className = '', ...props }: UserAvatarProps) => {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Start with true if photoURL might exist
  const { t } = useTranslation();
  const photoUrl = user?.imageUrl; // Use imageUrl from UserProfile
  const userName = user?.name;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (photoUrl) {
      setImageError(false);
      setIsLoading(true);
      
      const img = new Image();
      img.src = photoUrl;
      
      img.onload = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsLoading(false);
        setImageError(false);
      };
      img.onerror = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        console.error('UserAvatar: Failed to load image from URL:', photoUrl);
        setIsLoading(false);
        setImageError(true);
      };

      timeoutRef.current = setTimeout(() => {
        if (img.complete && img.naturalHeight !== 0) { // Already loaded
            setIsLoading(false);
            setImageError(false);
        } else if (!img.complete || img.naturalHeight === 0) { // Not loaded or broken
            console.warn('UserAvatar: Image loading timed out for URL:', photoUrl);
            setIsLoading(false);
            setImageError(true);
        }
      }, IMAGE_LOAD_TIMEOUT_MS);

    } else {
      setIsLoading(false); // No URL, so not loading
      setImageError(false); // No URL, so no error
    }
     return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [photoUrl]); // photoUrl is the direct dependency
  
  const sizeClasses = {
    xs: 'w-6 h-6 text-[8px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  };
  
  const avatarBaseClasses = `relative rounded-full flex items-center justify-center overflow-hidden`;
  const avatarClasses = `${avatarBaseClasses} ${sizeClasses[size]} ${className}`;
  const initials = userName ? userName.charAt(0).toUpperCase() : '?';
  const altText = userName ? t('userAvatarWithName', { name: userName }) : t('userAvatarGeneric');
  const spinnerSizeMapping = {
    xs: 'xs', sm: 'sm', md: 'sm', lg: 'md', xl: 'lg'
  } as const;
  
  return (
    <div className={avatarClasses} {...props}>
      {photoUrl && !imageError && !isLoading && (
        <img 
          src={photoUrl} 
          alt={altText}
          className={`rounded-full w-full h-full object-cover transition-opacity duration-300 opacity-100`}
        />
      )}
      {isLoading && photoUrl && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-bg-surface-2)] dark:bg-[var(--color-bg-surface-2)] rounded-full">
          <LoadingSpinner size={spinnerSizeMapping[size]} />
        </div>
      )}
      {(!photoUrl || imageError) && !isLoading && (
        <div className="w-full h-full rounded-full flex items-center justify-center bg-[var(--color-primary-accent)]/80 text-[var(--color-primary-accent-text)] font-medium">
          {initials}
        </div>
      )}
    </div>
  );
};
UserAvatar.displayName = "UserAvatar";
export { UserAvatar };
