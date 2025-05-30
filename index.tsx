import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './src/App'; 
import { ThemeProvider } from './src/contexts/ThemeContext'; // Import ThemeProvider
import './src/styles/theme-fixes.css'; // Import theme fixes CSS

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