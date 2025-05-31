
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { TranslationKey } from '../i18n'; // Assuming TranslationKey type is exported

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  t: (key: TranslationKey | string) => string; // Accept t function as a prop
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  public render() {
    if (this.state.hasError) {
      const { t } = this.props; // Use t from props

      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div 
          className="p-6 m-4 rounded-lg border shadow-xl min-h-[300px] flex flex-col items-center justify-center text-center"
          style={{ 
            backgroundColor: 'var(--color-danger-accent)', 
            color: 'var(--color-primary-accent-text)', // Assuming white/light text on danger bg
            borderColor: 'rgba(255,255,255,0.2)' // A light border for definition
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-[var(--color-primary-accent-text)] opacity-80 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-2xl font-semibold text-[var(--color-primary-accent-text)] mb-3">{t('errorBoundaryTitle')}</h2>
          <p className="mb-6 text-[var(--color-primary-accent-text)] opacity-90 max-w-md">
            {t('errorBoundaryMessage')}
          </p>
          <button
            className="px-6 py-2.5 bg-white/20 text-white rounded-lg hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/70 focus:ring-offset-2 focus:ring-offset-[var(--color-danger-accent)] transition-colors"
            onClick={() => window.location.reload()}
          >
            {t('refresh')} 
          </button>
          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <details className="mt-6 p-3 bg-black/20 rounded-md text-sm w-full max-w-xl text-left">
              <summary className="cursor-pointer font-medium text-white/90 hover:text-white">Error Details (Development Only)</summary>
              <p className="mt-2.5 font-mono whitespace-pre-wrap text-white/80 text-xs leading-relaxed">
                {this.state.error.toString()}
                {this.state.error.stack && `\n\nStack Trace:\n${this.state.error.stack}`}
              </p>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
