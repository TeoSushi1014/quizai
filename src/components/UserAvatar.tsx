
import React, { useState, useEffect } from 'react';
import { useTranslation } from '../App'; 
import { LoadingSpinner } from './ui';

type UserAvatarProps = {
  photoUrl?: string | null;
  userName?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  photoUrl,
  userName,
  size = 'md',
  className = ''
}) => {
  const { t } = useTranslation();
  const [currentImageUrl, setCurrentImageUrl] = useState(photoUrl || '');
  const [imageError, setImageError] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(true); // True if photoUrl exists

  useEffect(() => {
    if (photoUrl) {
      setCurrentImageUrl(photoUrl);
      setImageError(false);
      setIsLoadingImage(true); // Start loading new image
    } else {
      setCurrentImageUrl('');
      setImageError(false); // Reset error if photoUrl is removed
      setIsLoadingImage(false); // No image to load
    }
  }, [photoUrl]);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  };

  const sizeClass = sizeClasses[size];
  const initials = userName?.charAt(0).toUpperCase() || '?';
  const avatarGenericAlt = t('userAvatarGeneric');
  const avatarWithNameAlt = userName ? t('userAvatarAlt', { name: userName }) : avatarGenericAlt;
  const avatarFallbackAriaLabel = userName ? t('userAvatarWithName', { name: userName }) : t('userAvatar');

  if (currentImageUrl && !imageError && isLoadingImage) {
    return (
      <div
        className={`${sizeClass} rounded-full bg-[var(--color-bg-surface-2)] flex items-center justify-center text-[var(--color-text-primary)] ${className}`}
        aria-label={avatarFallbackAriaLabel} // Still provide label for spinner container
      >
        <LoadingSpinner size={size === 'lg' ? 'sm' : 'sm'} /> 
        {/* Hidden image to trigger load/error */}
        <img
          src={currentImageUrl}
          alt="" // Decorative for this hidden image
          className="hidden"
          onLoad={() => setIsLoadingImage(false)}
          onError={() => {
            console.error('Failed to load avatar image from URL:', currentImageUrl);
            setImageError(true);
            setIsLoadingImage(false);
          }}
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }
  
  if (!currentImageUrl || imageError) {
    return (
      <div
        className={`${sizeClass} rounded-full bg-[var(--color-primary-accent)] flex items-center justify-center text-[var(--color-primary-accent-text)] font-semibold text-lg ${className}`}
        aria-label={avatarFallbackAriaLabel}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={currentImageUrl}
      alt={avatarWithNameAlt}
      className={`${sizeClass} rounded-full object-cover ${className}`}
      onLoad={() => setIsLoadingImage(false)} // Should already be false if we reach here, but good practice
      onError={() => { // Fallback again if it somehow reaches here and errors
        console.error('Failed to load avatar image from URL (direct render):', currentImageUrl);
        setImageError(true);
        setIsLoadingImage(false);
      }}
      referrerPolicy="no-referrer" 
    />
  );
};

UserAvatar.displayName = "UserAvatar";
