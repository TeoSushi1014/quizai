import { authService } from '../services/authService';
import { runDiagnostics, quickCheck } from '../utils/deploymentDiagnostics';
import { validateAll } from '../utils/deploymentValidation';

// Debug utilities specifically for production troubleshooting
export const productionDebugUtils = {
  // Test authentication flow
  async testAuth(email: string = 'test@example.com') {
    console.log('🔐 Testing authentication flow...');
    try {
      const result = await authService.testSupabaseConnectivity(email);
      console.log('Auth test result:', result);
      return result;
    } catch (error) {
      console.error('Auth test failed:', error);
      return null;
    }
  },

  // Run all diagnostics
  async runFullDiagnostics() {
    console.log('🔍 Running comprehensive diagnostics...');
    await runDiagnostics();
    
    const quickResult = await quickCheck();
    console.log('Quick health check:', quickResult);
    
    const validation = await validateAll();
    console.log('Full validation:', validation);
    
    return { quickResult, validation };
  },

  // Check OAuth configuration
  checkOAuthConfig() {
    console.log('🔗 Checking OAuth configuration...');
    
    const config = {
      hostname: window.location.hostname,
      protocol: window.location.protocol,
      fullUrl: window.location.href,
      isProduction: window.location.hostname !== 'localhost',
      googleApiLoaded: !!(window as any).google,
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
      supabaseKeyLength: import.meta.env.VITE_SUPABASE_ANON_KEY?.length || 0
    };
    
    console.table(config);
    
    // Check for common issues
    const issues = [];
    if (!config.supabaseUrl) issues.push('Missing VITE_SUPABASE_URL');
    if (config.supabaseKeyLength === 0) issues.push('Missing VITE_SUPABASE_ANON_KEY');
    if (!config.googleApiLoaded) issues.push('Google API not loaded');
    if (config.isProduction && config.protocol !== 'https:') issues.push('Not using HTTPS in production');
    
    if (issues.length > 0) {
      console.warn('⚠️ Issues found:', issues);
    } else {
      console.log('✅ Basic configuration looks good');
    }
    
    return { config, issues };
  },

  // Test specific URL patterns for OAuth
  checkOAuthUrls() {
    console.log('🌐 Checking OAuth URL patterns...');
    
    const baseUrl = `${window.location.protocol}//${window.location.hostname}`;
    const fullBaseUrl = `${baseUrl}${window.location.pathname}`;
    
    const requiredUrls = {
      'Site URL': fullBaseUrl,
      'JavaScript Origins': [
        baseUrl,
        fullBaseUrl
      ],
      'Redirect URIs': [
        `${fullBaseUrl}`,
        `${fullBaseUrl}/`,
        `${fullBaseUrl}#/`,
        'https://jbuqonmeorldgiwvdror.supabase.co/auth/v1/callback'
      ]
    };
    
    console.log('Required OAuth URLs for Google Cloud Console:');
    console.log('=====================================');
    Object.entries(requiredUrls).forEach(([key, value]) => {
      console.log(`${key}:`);
      if (Array.isArray(value)) {
        value.forEach(url => console.log(`  - ${url}`));
      } else {
        console.log(`  - ${value}`);
      }
      console.log('');
    });
    
    return requiredUrls;
  },

  // Simulate OAuth token
  async simulateGoogleAuth() {
    console.log('🧪 Simulating Google auth for testing...');
    
    const mockGoogleUser = {
      sub: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      picture: 'https://via.placeholder.com/150',
      access_token: 'mock-access-token',
      credential: 'mock-credential'
    };
    
    try {
      const result = await authService.signInWithGoogle(mockGoogleUser);
      console.log('Simulated auth result:', result);
      return result;
    } catch (error) {
      console.error('Simulated auth failed:', error);
      return null;
    }
  },

  // Clear all auth data
  clearAuthData() {
    console.log('🧹 Clearing all authentication data...');
    
    // Clear localStorage
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('supabase') || key.includes('auth') || key.includes('google'))) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log(`Removed: ${key}`);
    });
    
    // Clear sessionStorage
    const sessionKeysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.includes('supabase') || key.includes('auth') || key.includes('google'))) {
        sessionKeysToRemove.push(key);
      }
    }
    
    sessionKeysToRemove.forEach(key => {
      sessionStorage.removeItem(key);
      console.log(`Removed from session: ${key}`);
    });
    
    console.log('✅ Auth data cleared. Refresh the page to restart.');
  },

  // Show help
  help() {
    console.log(`
🛠️ QuizAI Production Debug Utilities
=====================================

Available commands:
- window.QuizAIDebug.testAuth('email@example.com')    // Test auth with specific email
- window.QuizAIDebug.runFullDiagnostics()             // Run all diagnostic tests
- window.QuizAIDebug.checkOAuthConfig()               // Check OAuth configuration
- window.QuizAIDebug.checkOAuthUrls()                 // Get required OAuth URLs
- window.QuizAIDebug.simulateGoogleAuth()             // Test with mock Google user
- window.QuizAIDebug.clearAuthData()                  // Clear all auth data
- window.QuizAIDebug.help()                           // Show this help

Example usage:
  window.QuizAIDebug.runFullDiagnostics()
  window.QuizAIDebug.checkOAuthUrls()

For OAuth setup issues:
1. Run checkOAuthUrls() to get required URLs
2. Add these URLs to Google Cloud Console
3. Add site URL to Supabase Auth settings
4. Clear auth data and test again
    `);
  }
};

// Make debug utilities available globally in production
if (typeof window !== 'undefined') {
  (window as any).QuizAIDebug = productionDebugUtils;
  console.log('QuizAI Debug utilities available at window.QuizAIDebug');
  console.log('Type window.QuizAIDebug.help() for available commands');
}
