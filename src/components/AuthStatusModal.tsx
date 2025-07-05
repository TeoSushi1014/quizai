import { useState, useEffect } from 'react';
import { authService } from '../services/authService';

interface AuthStatusProps {
  onClose?: () => void;
}

interface AuthDiagnostics {
  isProduction: boolean;
  googleLoaded: boolean;
  supabaseConfigured: boolean;
  supabaseConnectable: boolean;
  authMode: 'full' | 'google-only' | 'none';
  issues: string[];
  suggestions: string[];
}

export const AuthStatusModal: React.FC<AuthStatusProps> = ({ onClose }) => {
  const [diagnostics, setDiagnostics] = useState<AuthDiagnostics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    setIsLoading(true);
    
    try {
      const isProduction = window.location.hostname !== 'localhost';
      const googleLoaded = !!(window as any).google;
      const supabaseConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
      
      let supabaseConnectable = false;
      let authMode: 'full' | 'google-only' | 'none' = 'none';
      const issues: string[] = [];
      const suggestions: string[] = [];

      // Test Supabase connectivity
      if (supabaseConfigured) {
        try {
          const testResult = await authService.testSupabaseConnectivity('test@example.com');
          supabaseConnectable = testResult.canConnect;
          
          if (googleLoaded && supabaseConnectable) {
            authMode = 'full';
          } else if (googleLoaded) {
            authMode = 'google-only';
          }
        } catch (error) {
          console.warn('Supabase connectivity test failed:', error);
        }
      } else {
        issues.push('Supabase not configured');
        suggestions.push('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables');
      }

      if (!googleLoaded) {
        issues.push('Google API not loaded');
        suggestions.push('Check Google OAuth configuration and internet connection');
      }

      if (isProduction && issues.length > 0) {
        suggestions.push('In production, app will use fallback modes to ensure functionality');
      }

      setDiagnostics({
        isProduction,
        googleLoaded,
        supabaseConfigured,
        supabaseConnectable,
        authMode,
        issues,
        suggestions
      });
    } catch (error) {
      console.error('Diagnostics failed:', error);
      setDiagnostics({
        isProduction: window.location.hostname !== 'localhost',
        googleLoaded: false,
        supabaseConfigured: false,
        supabaseConnectable: false,
        authMode: 'none',
        issues: ['Diagnostics failed to run'],
        suggestions: ['Check browser console for detailed errors']
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!diagnostics && !isLoading) return null;

  const getStatusColor = (status: boolean) => status ? 'text-green-600' : 'text-red-600';
  const getStatusIcon = (status: boolean) => status ? '✅' : '❌';
  
  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'full': return 'text-green-600';
      case 'google-only': return 'text-yellow-600';
      default: return 'text-red-600';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Authentication Status</h2>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                aria-label="Close"
              >
                ×
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Running diagnostics...</p>
            </div>
          ) : diagnostics && (
            <div className="space-y-6">
              {/* Environment Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-3">Environment</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Environment:</span>
                    <span className={diagnostics.isProduction ? 'text-blue-600 font-medium' : 'text-gray-600'}>
                      {diagnostics.isProduction ? 'Production' : 'Development'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Domain:</span>
                    <span className="text-gray-800 font-mono text-sm">{window.location.hostname}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Authentication Mode:</span>
                    <span className={`font-medium ${getModeColor(diagnostics.authMode)}`}>
                      {diagnostics.authMode.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* System Status */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-3">System Status</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span>Google API:</span>
                    <span className={getStatusColor(diagnostics.googleLoaded)}>
                      {getStatusIcon(diagnostics.googleLoaded)} {diagnostics.googleLoaded ? 'Loaded' : 'Not Available'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Supabase Configured:</span>
                    <span className={getStatusColor(diagnostics.supabaseConfigured)}>
                      {getStatusIcon(diagnostics.supabaseConfigured)} {diagnostics.supabaseConfigured ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Supabase Connectable:</span>
                    <span className={getStatusColor(diagnostics.supabaseConnectable)}>
                      {getStatusIcon(diagnostics.supabaseConnectable)} {diagnostics.supabaseConnectable ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Issues */}
              {diagnostics.issues.length > 0 && (
                <div className="bg-red-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-red-800 mb-3">Issues Found</h3>
                  <ul className="space-y-1">
                    {diagnostics.issues.map((issue, index) => (
                      <li key={index} className="text-red-700 text-sm">
                        • {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Suggestions */}
              {diagnostics.suggestions.length > 0 && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-blue-800 mb-3">Suggestions</h3>
                  <ul className="space-y-1">
                    {diagnostics.suggestions.map((suggestion, index) => (
                      <li key={index} className="text-blue-700 text-sm">
                        • {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={runDiagnostics}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Refresh Status
                </button>
                
                <button
                  onClick={() => {
                    console.log('🔍 Running full diagnostics...');
                    if ((window as any).QuizAIDebug) {
                      (window as any).QuizAIDebug.runDiagnostics();
                    } else {
                      console.log('Debug utilities not available');
                    }
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Run Full Diagnostics
                </button>
                
                {onClose && (
                  <button
                    onClick={onClose}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors ml-auto"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Hook to show auth status
export const useAuthStatus = () => {
  const [showModal, setShowModal] = useState(false);

  const showAuthStatus = () => setShowModal(true);
  const hideAuthStatus = () => setShowModal(false);

  return {
    showModal,
    showAuthStatus,
    hideAuthStatus,
    AuthStatusModal: () => showModal ? <AuthStatusModal onClose={hideAuthStatus} /> : null
  };
};

export default AuthStatusModal;
