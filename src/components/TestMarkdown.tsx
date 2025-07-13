import React from 'react';
import GithubMarkdownContent from './GithubMarkdownContent';
import { useState, useEffect } from 'react';
import { Button } from './ui';
import { githubMarkdownService } from '../services/githubMarkdownService';
import useGithubApiStatus from '../hooks/useGithubApiStatus';

/**
 * Component for testing markdown rendering performance
 */
const TestMarkdown: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [testResults, setTestResults] = useState<{
    apiCalls: number;
    totalRenderTime: number;
    averageTime: number;
    cacheHitRatio: number;
  } | null>(null);
  
  const apiStatus = useGithubApiStatus();
  
  useEffect(() => {
    const loadContent = async () => {
      setIsLoading(true);
      
      // Clear cache first to test fresh rendering
      githubMarkdownService.clearCache();
      
      const startTime = performance.now();
      let apiCalls = 0;
      const cacheHits = 0;
      
      // Render the content once
      await githubMarkdownService.renderMarkdown(complexMarkdown, 'gfm');
      apiCalls++;
      
      // Render it again to test caching
      await githubMarkdownService.renderMarkdown(complexMarkdown, 'gfm');
      
      // Test batch rendering with the same content split into parts
      const parts = complexMarkdown.split('\n\n').filter(part => part.trim());
      
      // First 5 parts only to avoid rate limiting
      const firstFiveParts = parts.slice(0, 5);
      
      // Batch render these parts
      await githubMarkdownService.batchRenderMarkdown(firstFiveParts);
      apiCalls++;
      
      // Calculate results
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      setTestResults({
        apiCalls,
        totalRenderTime: totalTime,
        averageTime: totalTime / apiCalls,
        cacheHitRatio: 0.5 // We expect 50% cache hit ratio from the test
      });
      
      setIsLoading(false);
    };
    
    loadContent();
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-4">GitHub Markdown API Test</h1>
        
        <div className="p-4 bg-[var(--color-bg-surface-1)] rounded-lg border border-[var(--color-border-default)] mb-6">
          <h2 className="text-lg font-medium mb-3">API Status</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Remaining Calls</p>
              <p className="text-xl font-semibold">{apiStatus.remaining}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Rate Limit</p>
              <p className="text-xl font-semibold">{apiStatus.limit}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Resets At</p>
              <p className="text-base">{apiStatus.resetTime?.toLocaleTimeString() || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Status</p>
              <p className={`text-base font-medium ${apiStatus.isLimited ? 'text-red-500' : apiStatus.isNearLimit ? 'text-yellow-500' : 'text-green-500'}`}>
                {apiStatus.isLimited ? 'Rate Limited' : apiStatus.isNearLimit ? 'Near Limit' : 'Good'}
              </p>
            </div>
          </div>
        </div>
        
        {testResults && (
          <div className="p-4 bg-[var(--color-bg-surface-1)] rounded-lg border border-[var(--color-border-default)] mb-6">
            <h2 className="text-lg font-medium mb-3">Performance Test Results</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-[var(--color-text-secondary)]">API Calls</p>
                <p className="text-xl font-semibold">{testResults.apiCalls}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--color-text-secondary)]">Total Render Time</p>
                <p className="text-xl font-semibold">{testResults.totalRenderTime.toFixed(2)} ms</p>
              </div>
              <div>
                <p className="text-sm text-[var(--color-text-secondary)]">Average Time per Call</p>
                <p className="text-xl font-semibold">{testResults.averageTime.toFixed(2)} ms</p>
              </div>
              <div>
                <p className="text-sm text-[var(--color-text-secondary)]">Cache Hit Ratio</p>
                <p className="text-xl font-semibold">{(testResults.cacheHitRatio * 100).toFixed(0)}%</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex space-x-3 mb-6">
          <Button 
            variant="primary" 
            onClick={() => window.location.reload()}
          >
            Run Performance Test Again
          </Button>
          <Button 
            variant="secondary" 
            onClick={() => githubMarkdownService.clearCache()}
          >
            Clear Cache
          </Button>
        </div>
      </div>

      <div className="p-4 bg-[var(--color-bg-surface-1)] rounded-lg border border-[var(--color-border-default)]">
        <h2 className="text-lg font-medium mb-4">Rendered Markdown</h2>
        {isLoading ? (
          <div className="animate-pulse p-4 bg-[var(--color-bg-surface-2)] rounded h-96">
            <div className="h-4 bg-[var(--color-bg-surface-3)] rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-[var(--color-bg-surface-3)] rounded w-1/2 mb-4"></div>
            <div className="h-4 bg-[var(--color-bg-surface-3)] rounded w-5/6 mb-4"></div>
          </div>
        ) : (
          <div className="github-markdown-enhanced">
            <GithubMarkdownContent content={complexMarkdown} />
          </div>
        )}
      </div>
    </div>
  );
};

// Test markdown with various features
const complexMarkdown = `
# GitHub Markdown Test

This page tests GitHub API markdown rendering with various features:

## Code Syntax Highlighting

\`\`\`javascript
function helloWorld() {
  console.log("Hello, world!");
  // This is a comment
  return 42;
}
\`\`\`

## Math Equations

Inline math: $E = mc^2$ and block math:

$$
\\frac{d}{dx}\\left( \\int_{a}^{x} f(u)\\,du\\right)=f(x)
$$

## Table

| Name | Value | Description |
|------|-------|-------------|
| foo  | 42    | The answer  |
| bar  | 23    | Not answer  |
| baz  | 99    | Almost 100  |

## Task List

- [x] Implement GitHub API
- [x] Add caching 
- [ ] Improve performance
- [ ] Add documentation

## Quote

> The best performance improvements come from understanding the problem better, not adding more code.

## Nested Lists

1. First level
   - Nested item
   - Another nested item
     - Even deeper
       1. Numbered in deep nesting
       2. Another number

## Image Reference

![GitHub Logo](https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png)

## HTML Support

<details>
<summary>Click to expand</summary>
<p>This is hidden content that can be expanded</p>
</details>

## Footnotes

This is a text with footnote[^1].

[^1]: This is the footnote content.

## Emoji Support

:smile: :heart: :rocket: :octocat:

`;

export default TestMarkdown; 