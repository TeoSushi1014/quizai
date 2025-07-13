// src/services/githubMarkdownService.ts
// Service to handle GitHub Markdown API rendering

// Simple in-memory cache for rendered markdown
interface CacheEntry {
  html: string;
  timestamp: number;
}

const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hour cache TTL (increased from 1 hour)
const markdownCache = new Map<string, CacheEntry>();

// Queue for API calls to avoid rate limit issues
let apiQueue: Array<() => Promise<any>> = [];
let isProcessingQueue = false;
const RATE_LIMIT_DELAY = 1000; // 1 second between API calls

// Track API limit
let remainingApiCalls = 60; // Default GitHub API limit
let apiResetTime: number | null = null;

/**
 * Process the API queue with rate limiting
 */
async function processQueue(): Promise<void> {
  if (isProcessingQueue || apiQueue.length === 0) return;
  
  isProcessingQueue = true;
  
  while (apiQueue.length > 0) {
    // Check if we're near rate limit
    if (remainingApiCalls < 5) {
      const now = Date.now();
      if (apiResetTime && apiResetTime > now) {
        // Wait until reset time if it's within 5 minutes
        const waitTime = apiResetTime - now;
        if (waitTime < 5 * 60 * 1000) { // 5 minutes
          console.warn(`Near GitHub API rate limit. Waiting ${Math.round(waitTime/1000)} seconds until reset.`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          console.warn(`GitHub API rate limit nearly reached. Only ${remainingApiCalls} calls remaining.`);
        }
      }
    }
    
    const apiCall = apiQueue.shift();
    if (apiCall) {
      try {
        await apiCall();
      } catch (error) {
        console.error('Error in GitHub API queue:', error);
      }
      
      // Wait before processing the next request to avoid rate limits
      if (apiQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
      }
    }
  }
  
  isProcessingQueue = false;
}

/**
 * Add an API call to the queue and start processing
 */
function queueApiCall<T>(apiCallFn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    apiQueue.push(async () => {
      try {
        const result = await apiCallFn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
    
    processQueue();
  });
}

/**
 * Batch multiple markdown strings together to reduce API calls
 * @param markdownPieces - Array of markdown strings
 * @param separator - HTML separator to use between pieces
 * @returns - Promise with the rendered HTML
 */
async function batchRenderMarkdown(markdownPieces: string[], separator = '<hr class="markdown-separator" />'): Promise<string[]> {
  // Check if all pieces are in cache
  const allCached = markdownPieces.every(piece => {
    const cacheKey = `markdown_${piece}`;
    const cachedResult = markdownCache.get(cacheKey);
    return cachedResult && (Date.now() - cachedResult.timestamp) < CACHE_TTL;
  });
  
  // If all pieces are cached, return from cache
  if (allCached) {
    return markdownPieces.map(piece => {
      const cacheKey = `markdown_${piece}`;
      return markdownCache.get(cacheKey)?.html || '';
    });
  }
  
  // Filter out cached pieces
  const uncachedPieces = markdownPieces.filter(piece => {
    const cacheKey = `markdown_${piece}`;
    const cachedResult = markdownCache.get(cacheKey);
    return !cachedResult || (Date.now() - cachedResult.timestamp) >= CACHE_TTL;
  });
  
  // If we have uncached pieces, batch them together
  if (uncachedPieces.length > 0) {
    // Create a separator that's unlikely to appear in content
    const uniqueSeparator = `<!-- MARKDOWN_PIECE_SEPARATOR_${Date.now()} -->`;
    
    // Join all pieces with the unique separator
    const batchedContent = uncachedPieces.join(`\n${uniqueSeparator}\n`);
    
    // Render the batched content
    const batchedHtml = await githubMarkdownService.renderMarkdown(batchedContent, 'gfm');
    
    // Split the result back into pieces
    const htmlPieces = batchedHtml.split(uniqueSeparator);
    
    // Cache each piece
    uncachedPieces.forEach((piece, index) => {
      if (index < htmlPieces.length) {
        const cacheKey = `markdown_${piece}`;
        markdownCache.set(cacheKey, {
          html: htmlPieces[index],
          timestamp: Date.now()
        });
      }
    });
  }
  
  // Return all pieces (some from cache, some newly rendered)
  return markdownPieces.map(piece => {
    const cacheKey = `markdown_${piece}`;
    const cachedResult = markdownCache.get(cacheKey);
    return cachedResult?.html || ''; // Should be cached now
  });
}

/**
 * Renders markdown content using GitHub's Markdown API
 * @see https://docs.github.com/en/rest/markdown?apiVersion=2022-11-28
 */
export const githubMarkdownService = {
  /**
   * Renders markdown content as HTML using GitHub's Markdown API
   * 
   * @param content - The Markdown content to render
   * @param mode - The rendering mode (optional, defaults to 'markdown')
   * @param context - Repository context for GitHub Flavored Markdown (optional)
   * @returns Promise with the rendered HTML
   */
  async renderMarkdown(content: string, mode: 'markdown' | 'gfm' = 'markdown', context?: string): Promise<string> {
    // Generate cache key based on content, mode and context
    const cacheKey = `${content}_${mode}_${context || ''}`;
    
    // Check cache first
    const cachedResult = markdownCache.get(cacheKey);
    if (cachedResult && (Date.now() - cachedResult.timestamp) < CACHE_TTL) {
      return cachedResult.html;
    }
    
    // Not in cache or expired, make API call
    return queueApiCall(async () => {
      try {
        const url = 'https://api.github.com/markdown';
        
        const payload = {
          text: content,
          mode,
          context
        };
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28'
          },
          body: JSON.stringify(payload)
        });
        
        // Update rate limit tracking
        if (response.headers.has('X-RateLimit-Remaining')) {
          remainingApiCalls = parseInt(response.headers.get('X-RateLimit-Remaining') || '60');
        }
        
        if (response.headers.has('X-RateLimit-Reset')) {
          apiResetTime = parseInt(response.headers.get('X-RateLimit-Reset') || '0') * 1000;
        }
        
        // Handle rate limiting
        if (response.status === 403) {
          const resetTime = response.headers.get('X-RateLimit-Reset');
          if (resetTime) {
            const waitTime = parseInt(resetTime) * 1000 - Date.now();
            console.warn(`GitHub API rate limit reached. Reset at ${new Date(parseInt(resetTime) * 1000).toLocaleString()}`);
            
            // If the wait time is reasonable (less than 10 minutes), we could wait
            if (waitTime > 0 && waitTime < 600000) {
              await new Promise(resolve => setTimeout(resolve, waitTime));
              // Try again after waiting
              return this.renderMarkdown(content, mode, context);
            }
          }
          throw new Error('GitHub API rate limit exceeded');
        }
        
        if (!response.ok) {
          throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }
        
        const html = await response.text();
        
        // Cache the result
        markdownCache.set(cacheKey, {
          html,
          timestamp: Date.now()
        });
        
        return html;
      } catch (error) {
        console.error('Error rendering markdown with GitHub API:', error);
        
        // In case of error, we can fallback to a basic HTML transformation
        const fallbackHtml = `<div class="github-markdown-error">
          <p>${content.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>
          <small class="text-red-500">Error rendering markdown with GitHub API</small>
        </div>`;
        
        return fallbackHtml;
      }
    });
  },
  
  /**
   * Batch render multiple markdown pieces in a single API call when possible
   * 
   * @param contentPieces - Array of markdown content pieces to render
   * @returns Promise with array of rendered HTML for each piece
   */
  batchRenderMarkdown: async (contentPieces: string[]): Promise<string[]> => {
    // Filter out empty content
    const validPieces = contentPieces.filter(piece => piece && piece.trim() !== '');
    
    if (validPieces.length === 0) {
      return [];
    }
    
    if (validPieces.length === 1) {
      const html = await githubMarkdownService.renderMarkdown(validPieces[0], 'gfm');
      return [html];
    }
    
    return batchRenderMarkdown(validPieces);
  },
  
  /**
   * Renders markdown content as raw HTML using GitHub's Markdown API
   * 
   * @param content - The Markdown content to render
   * @returns Promise with the rendered HTML
   */
  async renderMarkdownRaw(content: string): Promise<string> {
    // Generate cache key
    const cacheKey = `raw_${content}`;
    
    // Check cache first
    const cachedResult = markdownCache.get(cacheKey);
    if (cachedResult && (Date.now() - cachedResult.timestamp) < CACHE_TTL) {
      return cachedResult.html;
    }
    
    // Not in cache or expired, make API call
    return queueApiCall(async () => {
      try {
        const url = 'https://api.github.com/markdown/raw';
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'text/plain',
            'X-GitHub-Api-Version': '2022-11-28'
          },
          body: content
        });
        
        // Update rate limit tracking
        if (response.headers.has('X-RateLimit-Remaining')) {
          remainingApiCalls = parseInt(response.headers.get('X-RateLimit-Remaining') || '60');
        }
        
        if (response.headers.has('X-RateLimit-Reset')) {
          apiResetTime = parseInt(response.headers.get('X-RateLimit-Reset') || '0') * 1000;
        }
        
        // Handle rate limiting
        if (response.status === 403) {
          const resetTime = response.headers.get('X-RateLimit-Reset');
          if (resetTime) {
            const waitTime = parseInt(resetTime) * 1000 - Date.now();
            console.warn(`GitHub API rate limit reached. Reset at ${new Date(parseInt(resetTime) * 1000).toLocaleString()}`);
            
            // If the wait time is reasonable (less than 10 minutes), we could wait
            if (waitTime > 0 && waitTime < 600000) {
              await new Promise(resolve => setTimeout(resolve, waitTime));
              // Try again after waiting
              return this.renderMarkdownRaw(content);
            }
          }
          throw new Error('GitHub API rate limit exceeded');
        }
        
        if (!response.ok) {
          throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }
        
        const html = await response.text();
        
        // Cache the result
        markdownCache.set(cacheKey, {
          html,
          timestamp: Date.now()
        });
        
        return html;
      } catch (error) {
        console.error('Error rendering raw markdown with GitHub API:', error);
        
        // In case of error, we can fallback to a basic HTML transformation
        const fallbackHtml = `<div class="github-markdown-error">
          <p>${content.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>
          <small class="text-red-500">Error rendering markdown with GitHub API</small>
        </div>`;
        
        return fallbackHtml;
      }
    });
  },
  
  /**
   * Get current API status
   */
  getApiStatus: () => ({
    remainingCalls: remainingApiCalls,
    resetTime: apiResetTime ? new Date(apiResetTime) : null,
    isNearLimit: remainingApiCalls < 10
  }),
  
  /**
   * Clear the markdown cache
   */
  clearCache(): void {
    markdownCache.clear();
  }
}; 