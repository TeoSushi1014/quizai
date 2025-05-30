
import React, { useState, useEffect } from 'react';

// Note: UserCircleIcon was in the user's original import example but commented out,
// and the fallback implemented uses initials. If UserCircleIcon were needed, it would be:
// import { UserCircleIcon } from '../constants';


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
  const [currentImageUrl, setCurrentImageUrl] = useState(photoUrl || '');
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (photoUrl) {
      setCurrentImageUrl(photoUrl);
      setImageError(false); // Reset error if new photoUrl is provided
    } else {
      setCurrentImageUrl(''); // Clear if photoUrl becomes null/undefined
      setImageError(false); // No error if there's no URL to load
    }
  }, [photoUrl]);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  };

  const sizeClass = sizeClasses[size];
  const initials = userName?.charAt(0).toUpperCase() || '?';

  if (!currentImageUrl || imageError) {
    return (
      <div
        className={`${sizeClass} rounded-full bg-sky-600 flex items-center justify-center text-white font-semibold text-lg ${className}`}
        aria-label={userName ? `${userName}'s avatar fallback` : 'User avatar fallback'}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={currentImageUrl}
      alt={userName ? `${userName}'s avatar` : "User avatar"}
      className={`${sizeClass} rounded-full object-cover ${className}`}
      onError={() => {
        console.error('Failed to load avatar image from URL:', currentImageUrl);
        setImageError(true);
      }}
      referrerPolicy="no-referrer" // Added for Google images
    />
  );
};

UserAvatar.displayName = "UserAvatar";
