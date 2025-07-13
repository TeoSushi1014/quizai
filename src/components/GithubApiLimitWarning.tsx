import React from 'react';
import useGithubApiStatus from '../hooks/useGithubApiStatus';

interface GithubApiLimitWarningProps {
  className?: string;
}

const GithubApiLimitWarning: React.FC<GithubApiLimitWarningProps> = ({ 
  className = '' 
}) => {
  const apiStatus = useGithubApiStatus();
  
  // Only show warning if we're limited or near the limit
  if (!apiStatus.isLimited && !apiStatus.isNearLimit) {
    return null;
  }
  
  const resetTimeString = apiStatus.resetTime 
    ? apiStatus.resetTime.toLocaleTimeString() 
    : 'unknown time';
  
  return (
    <div className={`p-2 rounded-md text-sm ${apiStatus.isLimited ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'} ${className}`}>
      <div className="flex items-center gap-2">
        {apiStatus.isLimited ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )}
        <div>
          {apiStatus.isLimited ? (
            <span>GitHub API rate limit reached. Markdown rendering may be limited until {resetTimeString}.</span>
          ) : (
            <span>GitHub API rate limit approaching ({apiStatus.remaining} left). Resets at {resetTimeString}.</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default GithubApiLimitWarning; 