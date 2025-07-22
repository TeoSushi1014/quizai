import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; 
// Import primary CSS first for faster initial render
import './index.css';

// Group and load non-critical CSS asynchronously
const loadNonCriticalStyles = () => {
  // Use dynamic imports for CSS files that aren't critical for initial render
  Promise.all([
    import('./styles/theme-fixes.css'),
    import('./styles/text-fix.css'),
    import('./styles/quiz-feedback.css'),
    import('./styles/avatar-fix.css'),
    import('./styles/option-alignment-fix.css'),
    import('./styles/numeric-answer-fix.css'),
    import('./styles/link-fix.css'),
    import('./styles/question-layout-fix.css'),
    import('./styles/question-title-fix.css'),
    import('./styles/github-fonts.css'),
    import('./styles/accordion-question-fix.css')
  ]).catch(error => {
    console.error('Failed to load non-critical styles:', error);
  });
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Load non-critical styles after the app has rendered
// This ensures the critical parts of the app load first
if (document.readyState === 'complete') {
  loadNonCriticalStyles();
} else {
  window.addEventListener('load', loadNonCriticalStyles);
}
