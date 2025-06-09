
import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  
  // Process Google profile URLs to ensure high resolution and proper loading
  const processedPhotoUrl = useMemo(() => {
    if (!photoUrl) return null;
    
    // Handle Google profile pictures specifically
    if (photoUrl.includes('googleusercontent.com')) {
      // Start with the base URL
      let processedUrl = photoUrl;
      
      // Remove any existing size parameters
      processedUrl = processedUrl.replace(/=s\d+(-c)?/, '');
      
      // Remove any existing parameters but keep the base URL
      processedUrl = processedUrl.split('?')[0];
      
      // Add our size parameter
      processedUrl = `${processedUrl}=s256-c`;
      
      return processedUrl;
    }
    
    return photoUrl;
  }, [photoUrl]);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (processedPhotoUrl) {
      // processedPhotoUrl is already processed in the useMemo hook above
        
      setImageError(false);
      setIsLoading(true);
      
      const img = new Image();
      
      // Set crossOrigin before setting src to handle CORS properly
      img.crossOrigin = "anonymous";
      
      // For Google photos, we don't need cache busting as it can cause CORS issues
      if (processedPhotoUrl.includes('googleusercontent.com')) {
        img.src = processedPhotoUrl;
      } else {
        // For other images, we can still use cache busting
        img.src = `${processedPhotoUrl}${processedPhotoUrl.includes('?') ? '&' : '?'}t=${new Date().getTime()}`;
      }
      
      img.onload = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsLoading(false);
        setImageError(false);
      };
      img.onerror = (e) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        console.error('UserAvatar: Failed to load image from URL:', processedPhotoUrl || 'unknown', e);
        setIsLoading(false);
        setImageError(true);
      };

      timeoutRef.current = setTimeout(() => {
        if (img.complete && img.naturalHeight !== 0) { // Already loaded
            setIsLoading(false);
            setImageError(false);
        } else if (!img.complete || img.naturalHeight === 0) { // Not loaded or broken
            console.warn('UserAvatar: Image loading timed out for URL:', processedPhotoUrl || 'unknown');
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
  }, [processedPhotoUrl]); // Use processedPhotoUrl as dependency since it's memoized
  
  const sizeClasses = {
    xs: 'w-6 h-6 text-[8px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  };
  
  const avatarBaseClasses = `relative rounded-full flex items-center justify-center overflow-hidden shadow-lg user-avatar`;
  const avatarClasses = `${avatarBaseClasses} ${sizeClasses[size]} ${className}`;
  const initials = userName ? userName.charAt(0).toUpperCase() : '?';
  const altText = userName ? t('userAvatarWithName', { name: userName }) : t('userAvatarGeneric');
  const spinnerSizeMapping = {
    xs: 'xs', sm: 'sm', md: 'sm', lg: 'md', xl: 'lg'
  } as const;
  
  return (
    <div className={avatarClasses} {...props}>
      {processedPhotoUrl && !imageError && !isLoading && (
        <img 
          src={processedPhotoUrl.includes('googleusercontent.com') 
            ? processedPhotoUrl 
            : `${processedPhotoUrl}${processedPhotoUrl.includes('?') ? '&' : '?'}t=${new Date().getTime()}`}
          alt={altText}
          className={`rounded-full w-full h-full object-cover transition-opacity duration-300 opacity-100 bg-[var(--color-bg-surface-2)]`}
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          onError={(e) => {
            console.error('Image load error in render:', e);
            setImageError(true);
          }}
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
