import React from 'react';
import { createRoot } from 'react-dom/client';
import CodeBlock from './components/CodeBlock';

// Example CSS code to display
const cssCode = `.button {
  background-color: #4CAF50;
  border: none;
  color: white;
  padding: 15px 32px;
  text-align: center;
  text-decoration: none;
  display: inline-block;
  font-size: 16px;
  margin: 4px 2px;
  cursor: pointer;
}`;

// Function to render the CodeBlock component for testing
function TestCodeBlock() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>CodeBlock Component Test</h1>
      <CodeBlock language="css" code={cssCode} />
    </div>
  );
}

// Mount the test component to the DOM
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<TestCodeBlock />);
}
