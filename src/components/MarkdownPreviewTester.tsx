import React, { useState } from 'react';
import GithubMarkdownContent from './GithubMarkdownContent';

interface MarkdownPreviewTesterProps {
  initialMarkdown?: string;
}

const MarkdownPreviewTester: React.FC<MarkdownPreviewTesterProps> = ({ initialMarkdown = '# Test Markdown\n\nThis is a **test** of GitHub API markdown rendering.\n\n- List item 1\n- List item 2\n\n```js\nconsole.log("Hello world!");\n```\n\nMath: $E = mc^2$' }) => {
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [isRawMode, setIsRawMode] = useState(false);
  
  return (
    <div className="flex flex-col md:flex-row gap-4 w-full">
      <div className="w-full md:w-1/2">
        <div className="mb-2 flex justify-between items-center">
          <h3 className="text-lg font-medium">Markdown Input</h3>
          <div>
            <label className="inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={isRawMode}
                onChange={() => setIsRawMode(!isRawMode)}
                className="sr-only peer"
              />
              <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              <span className="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">Raw Mode</span>
            </label>
          </div>
        </div>
        <textarea
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          className="w-full h-[500px] p-4 border border-gray-300 rounded-md font-mono text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
          placeholder="Enter markdown here..."
        />
      </div>
      
      <div className="w-full md:w-1/2">
        <h3 className="text-lg font-medium mb-2">Preview (GitHub API)</h3>
        <div className="border border-gray-300 rounded-md p-4 h-[500px] overflow-auto dark:border-gray-700">
          <GithubMarkdownContent content={markdown} isRawMode={isRawMode} />
        </div>
      </div>
    </div>
  );
};

export default MarkdownPreviewTester; 