import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; 
import { ThemeProvider } from './contexts/ThemeContext';
import './styles/theme-fixes.css';
import './styles/text-fix.css'; // Fix for bold text rendering as links
import './styles/quiz-feedback.css'; // Quiz feedback animations and styles
import './styles/avatar-fix.css'; // Fix for Google avatar display issues
import './styles/option-alignment-fix.css'; // Fix for quiz option vertical alignment
import './styles/numeric-answer-fix.css'; // Special fix for numeric answers alignment
import './styles/link-fix.css'; // Hide unnecessary question links
import './styles/question-layout-fix.css'; // Fix for question title and content spacing
import './styles/question-title-fix.css'; // Fix for combined question titles
import './styles/accordion-question-fix.css'; // Direct fix for accordion question display

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
