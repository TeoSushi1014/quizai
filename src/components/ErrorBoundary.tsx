
import { Component, ErrorInfo, ReactNode } from 'react';
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
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    
    this.setState({
      errorInfo
    });
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    
    // Log deployment-specific error information
    this.logDeploymentError(error, errorInfo);
  }

  private logDeploymentError(error: Error, errorInfo: ErrorInfo) {
    const isProduction = window.location.hostname !== 'localhost';
    const deploymentInfo = {
      hostname: window.location.hostname,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      isProduction,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      componentStack: errorInfo.componentStack
    };
    
    console.group('🚨 Deployment Error Details');
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.log('Deployment Context:', deploymentInfo);
    console.groupEnd();
    
    // Check for common deployment issues
    const errorMessage = error.message.toLowerCase();
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      console.warn('💡 This appears to be a network error. Check:');
      console.warn('   - Internet connectivity');
      console.warn('   - API endpoints accessibility');
      console.warn('   - CORS configuration');
    } else if (errorMessage.includes('supabase') || errorMessage.includes('auth')) {
      console.warn('💡 This appears to be a Supabase/Auth error. Check:');
      console.warn('   - VITE_SUPABASE_URL environment variable');
      console.warn('   - VITE_SUPABASE_ANON_KEY environment variable');
      console.warn('   - Supabase project status');
    } else if (errorMessage.includes('import') || errorMessage.includes('module')) {
      console.warn('💡 This appears to be a module loading error. Check:');
      console.warn('   - Build process completed successfully');
      console.warn('   - All dependencies are installed');
      console.warn('   - Base path configuration');
    }
  }

  private getErrorCategory(error: Error): string {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';
    
    if (message.includes('network') || message.includes('fetch') || message.includes('cors')) {
      return 'Network/CORS';
    } else if (message.includes('supabase') || message.includes('auth') || stack.includes('supabase')) {
      return 'Database/Auth';
    } else if (message.includes('import') || message.includes('module') || message.includes('dynamic import')) {
      return 'Module Loading';
    } else if (message.includes('environment') || message.includes('env')) {
      return 'Environment';
    } else {
      return 'Application';
    }
  }

  private getErrorSuggestions(error: Error): string[] {
    const category = this.getErrorCategory(error);
    
    switch (category) {
      case 'Network/CORS':
        return [
          'Check your internet connection',
          'Verify API endpoints are accessible',
          'Check CORS configuration in Supabase',
          'Ensure your domain is added to allowed origins'
        ];
      case 'Database/Auth':
        return [
          'Verify VITE_SUPABASE_URL environment variable',
          'Verify VITE_SUPABASE_ANON_KEY environment variable',
          'Check Supabase project status',
          'Verify database tables exist',
          'Check RLS policies'
        ];
      case 'Module Loading':
        return [
          'Clear browser cache and reload',
          'Check build process completed successfully',
          'Verify all dependencies are installed',
          'Check base path configuration',
          'Verify assets are uploaded correctly'
        ];
      case 'Environment':
        return [
          'Check all required environment variables are set',
          'Verify environment variables format',
          'Check deployment platform configuration',
          'Verify build environment matches runtime environment'
        ];
      default:
        return [
          'Try refreshing the page',
          'Clear browser cache',
          'Check browser console for more details',
          'Contact support if the issue persists'
        ];
    }
  }

  public render() {
    if (this.state.hasError) {
      const { t } = this.props; // Use t from props

      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorCategory = this.state.error ? this.getErrorCategory(this.state.error) : 'Unknown';
      const suggestions = this.state.error ? this.getErrorSuggestions(this.state.error) : [];
      const isProduction = window.location.hostname !== 'localhost';
      
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
          
          {isProduction && (
            <div className="mb-6 p-4 bg-black/20 rounded-lg max-w-xl">
              <h3 className="text-lg font-medium text-white mb-2">Error Category: {errorCategory}</h3>
              <div className="text-left">
                <p className="text-white/90 mb-2">Try these solutions:</p>
                <ul className="space-y-1">
                  {suggestions.map((suggestion, index) => (
                    <li key={index} className="text-sm text-white/80">
                      • {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          
          <div className="flex gap-3">
            <button
              className="px-6 py-2.5 bg-white/20 text-white rounded-lg hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/70 focus:ring-offset-2 focus:ring-offset-[var(--color-danger-accent)] transition-colors"
              onClick={() => window.location.reload()}
            >
              {t('refresh')} 
            </button>
            
            {isProduction && (
              <button
                className="px-6 py-2.5 bg-white/10 text-white rounded-lg hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/70 focus:ring-offset-2 focus:ring-offset-[var(--color-danger-accent)] transition-colors"
                onClick={() => {
                  // Run deployment diagnostics
                  import('../utils/deploymentDiagnostics').then(({ runDiagnostics }) => {
                    runDiagnostics();
                  });
                }}
              >
                Run Diagnostics
              </button>
            )}
          </div>
          
          {!isProduction && this.state.error && (
            <details className="mt-6 p-3 bg-black/20 rounded-md text-sm w-full max-w-xl text-left">
              <summary className="cursor-pointer font-medium text-white/90 hover:text-white">Error Details (Development Only)</summary>
              <div className="mt-2.5 space-y-3">
                <div>
                  <p className="font-medium text-white/90">Error:</p>
                  <p className="font-mono whitespace-pre-wrap text-white/80 text-xs leading-relaxed">
                    {this.state.error.toString()}
                  </p>
                </div>
                {this.state.error.stack && (
                  <div>
                    <p className="font-medium text-white/90">Stack Trace:</p>
                    <p className="font-mono whitespace-pre-wrap text-white/80 text-xs leading-relaxed">
                      {this.state.error.stack}
                    </p>
                  </div>
                )}
                {this.state.errorInfo?.componentStack && (
                  <div>
                    <p className="font-medium text-white/90">Component Stack:</p>
                    <p className="font-mono whitespace-pre-wrap text-white/80 text-xs leading-relaxed">
                      {this.state.errorInfo.componentStack}
                    </p>
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
