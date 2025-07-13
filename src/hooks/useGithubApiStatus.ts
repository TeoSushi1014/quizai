import { useState, useEffect } from 'react';

interface GithubApiStatus {
  remaining: number;
  limit: number;
  resetTime: Date | null;
  isLimited: boolean;
  isNearLimit: boolean;
}

const defaultStatus: GithubApiStatus = {
  remaining: Infinity,
  limit: 60, // GitHub API has a default limit of 60 requests per hour for unauthenticated requests
  resetTime: null,
  isLimited: false,
  isNearLimit: false
};

/**
 * Hook to track GitHub API rate limits
 * @returns GitHub API status information
 */
export function useGithubApiStatus(): GithubApiStatus {
  const [status, setStatus] = useState<GithubApiStatus>(defaultStatus);

  useEffect(() => {
    async function checkRateLimit() {
      try {
        const response = await fetch('https://api.github.com/rate_limit', {
          headers: {
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
          }
        });

        if (response.ok) {
          const data = await response.json();
          const core = data.resources.core;
          
          const resetDate = new Date(core.reset * 1000);
          
          setStatus({
            remaining: core.remaining,
            limit: core.limit,
            resetTime: resetDate,
            isLimited: core.remaining === 0,
            isNearLimit: core.remaining < 10 // Consider it "near limit" if fewer than 10 requests remaining
          });
        } else {
          console.warn('Could not check GitHub API rate limit:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('Error checking GitHub API rate limit:', error);
      }
    }

    // Check rate limit on mount
    checkRateLimit();

    // Set up interval to check periodically
    const intervalId = setInterval(checkRateLimit, 60000); // Check every minute

    return () => clearInterval(intervalId);
  }, []);

  return status;
}

export default useGithubApiStatus; 