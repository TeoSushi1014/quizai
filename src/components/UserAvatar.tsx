import React from 'react';

// Note: UserCircleIcon was in the user's original import example but commented out,
// and the fallback implemented uses initials. If UserCircleIcon were needed, it would be:
// import { UserCircleIcon } from '../constants';


type UserAvatarProps = {
  photoUrl?: string | null;
  userName?: string | null; // Allow userName to be null
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

export const UserAvatar: React.FC<UserAvatarProps> = ({ 
  photoUrl, 
  userName, 
  size = 'md',
  className = ''
}) => {
  const [imageError, setImageError] = React.useState(false);
  
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  };
  
  const sizeClass = sizeClasses[size];
  const initials = userName?.charAt(0).toUpperCase() || '?';

  if (!photoUrl || imageError) {
    return (
      <div 
        className={`${sizeClass} rounded-full bg-sky-600 flex items-center justify-center text-white font-semibold text-lg ${className}`}
        aria-label={userName || 'User avatar fallback'} // Accessibility
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={photoUrl}
      alt={userName ? `${userName}'s avatar` : "User avatar"}
      className={`${sizeClass} rounded-full object-cover ${className}`}
      onError={() => setImageError(true)}
    />
  );
};

UserAvatar.displayName = "UserAvatar";
