import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
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
    // Example: log to a service
    // Sentry.captureException(error);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div className="p-6 m-4 rounded-lg bg-red-900/30 text-red-200 border border-red-700/50 shadow-xl min-h-[300px] flex flex-col items-center justify-center text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-red-400/80 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-2xl font-semibold text-red-100 mb-3">Oops! Something went wrong.</h2>
          <p className="mb-6 text-red-200/90 max-w-md">
            We're sorry, but an unexpected error occurred. You can try refreshing the page or clicking the button below.
          </p>
          <button
            className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-red-900/30 transition-colors"
            onClick={() => window.location.reload()} // Simple reload strategy
          >
            Refresh Page
          </button>
          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <details className="mt-6 p-3 bg-red-800/50 rounded-md text-sm w-full max-w-xl text-left">
              <summary className="cursor-pointer font-medium text-red-100 hover:text-red-50">Error Details (Development Only)</summary>
              <p className="mt-2.5 font-mono whitespace-pre-wrap text-red-200/80 text-xs leading-relaxed">
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