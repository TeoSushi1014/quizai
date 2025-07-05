import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; 
import { ThemeProvider } from './contexts/ThemeContext';
import './index.css';
import './styles/theme-fixes.css';
import './styles/text-fix.css';
import './styles/quiz-feedback.css';
import './styles/avatar-fix.css';
import './styles/option-alignment-fix.css';
import './styles/numeric-answer-fix.css';
import './styles/link-fix.css';
import './styles/question-layout-fix.css';
import './styles/question-title-fix.css';
import './styles/accordion-question-fix.css';

// Debug utilities (available in browser console for troubleshooting)
import('./services/supabaseService').then(({ supabaseService }) => {
  (window as any).QuizAIDebug = {
    makeQuizShareable: supabaseService.makeQuizShareable.bind(supabaseService),
    supabaseService
  };
  console.log('QuizAI Debug utilities available at window.QuizAIDebug');
});

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
