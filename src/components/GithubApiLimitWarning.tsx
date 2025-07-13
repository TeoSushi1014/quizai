import React, { useEffect, useState } from 'react';
import useGithubApiStatus from '../hooks/useGithubApiStatus';
import { githubMarkdownService } from '../services/githubMarkdownService';

/**
 * Component to display warnings about GitHub API rate limits
 */
const GithubApiLimitWarning: React.FC = () => {
  const apiStatus = useGithubApiStatus();
  const [showWarning, setShowWarning] = useState(false);
  
  // Check API status directly from service as a backup
  useEffect(() => {
    // Only check if we don't have data from the hook
    if (apiStatus.remaining === Infinity) {
      const serviceStatus = githubMarkdownService.getApiStatus();
      if (serviceStatus.isNearLimit) {
        setShowWarning(true);
      }
    }
  }, [apiStatus.remaining]);
  
  // Set warning visibility based on API status
  useEffect(() => {
    if (apiStatus.isLimited || apiStatus.isNearLimit) {
      setShowWarning(true);
    } else if (apiStatus.remaining > 10) {
      setShowWarning(false);
    }
  }, [apiStatus]);
  
  // Don't render anything if we don't need to show a warning
  if (!showWarning) {
    return null;
  }
  
  // Calculate minutes until reset
  const minutesUntilReset = apiStatus.resetTime 
    ? Math.max(0, Math.ceil((apiStatus.resetTime.getTime() - Date.now()) / (60 * 1000)))
    : 0;
  
  // Show a full blocking message if we're rate limited
  if (apiStatus.isLimited) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-md mx-4 shadow-xl">
          <h2 className="text-xl font-bold mb-4 text-red-600 dark:text-red-400">
            GitHub API Rate Limit Reached
          </h2>
          <p className="mb-4">
            The GitHub API rate limit has been reached. Markdown rendering will be unavailable for {minutesUntilReset} minutes.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Please wait for the rate limit to reset or use the application with limited markdown functionality.
          </p>
        </div>
      </div>
    );
  }
  
  // Show a warning banner if we're near the limit
  return (
    <div className="bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-yellow-500 p-2 fixed bottom-4 right-4 max-w-xs rounded shadow-md z-40">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            GitHub API rate limit is low ({apiStatus.remaining} remaining). 
            <br />Resets in {minutesUntilReset} minutes.
          </p>
          <button
            className="mt-1 text-xs text-yellow-600 dark:text-yellow-400 underline"
            onClick={() => setShowWarning(false)}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default GithubApiLimitWarning; 