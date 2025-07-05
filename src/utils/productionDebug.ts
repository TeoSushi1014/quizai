// Production Debug Utilities - Available in browser console via window.QuizAIDebug
import { authService } from '../services/authService';
import { supabase } from '../services/supabaseClient';
import { logger } from '../services/logService';

class ProductionDebugger {
  private logs: any[] = [];

  async testAuth(email: string = 'test@example.com'): Promise<void> {
    console.group('🔐 Authentication Test');
    
    try {
      const result = await authService.testSupabaseConnectivity(email);
      
      console.log('📊 Connectivity Results:', result);
      
      if (result.canConnect) {
        console.log('✅ Database connection: OK');
      } else {
        console.log('❌ Database connection: FAILED');
      }
      
      if (result.hasSession) {
        console.log('✅ Authentication session: ACTIVE');
        console.log('👤 Session details:', result.sessionDetails);
      } else {
        console.log('❌ Authentication session: NONE');
      }
      
      if (result.userExists) {
        console.log('✅ User exists in database');
        console.log('👤 User details:', result.userDetails);
      } else {
        console.log('ℹ️ User does not exist in database');
      }
      
    } catch (error) {
      console.error('❌ Authentication test failed:', error);
    }
    
    console.groupEnd();
  }

  checkConfig(): void {
    console.group('⚙️ Configuration Check');
    
    const config = {
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL || 'NOT SET',
      supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'SET (Hidden)' : 'NOT SET',
      environment: window.location.hostname,
      isProduction: window.location.hostname !== 'localhost',
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    };
    
    console.table(config);
    
    // Check for common issues
    if (!import.meta.env.VITE_SUPABASE_URL) {
      console.warn('⚠️ VITE_SUPABASE_URL is not set');
    }
    
    if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
      console.warn('⚠️ VITE_SUPABASE_ANON_KEY is not set');
    }
    
    if (config.isProduction) {
      console.log('🌐 Running in PRODUCTION mode');
    } else {
      console.log('🛠️ Running in DEVELOPMENT mode');
    }
    
    console.groupEnd();
  }

  async runDiagnostics(): Promise<void> {
    console.group('🔍 Full System Diagnostics');
    
    console.log('Starting comprehensive diagnostics...');
    
    // 1. Configuration check
    this.checkConfig();
    
    // 2. Network connectivity
    console.group('🌐 Network Tests');
    try {
      const response = await fetch(import.meta.env.VITE_SUPABASE_URL + '/rest/v1/', {
        method: 'GET',
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        }
      });
      
      if (response.ok) {
        console.log('✅ Supabase API is reachable');
      } else {
        console.log('❌ Supabase API returned error:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Network test failed:', error);
    }
    console.groupEnd();
    
    // 3. Database tests
    console.group('💾 Database Tests');
    try {
      const { error } = await supabase.from('users').select('count').limit(1);
      if (error) {
        console.error('❌ Database query failed:', error);
      } else {
        console.log('✅ Database query successful');
      }
    } catch (error) {
      console.error('❌ Database test failed:', error);
    }
    console.groupEnd();
    
    // 4. Authentication status
    console.group('🔐 Authentication Status');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log('✅ Active session found');
        console.log('👤 User:', session.user.email);
      } else {
        console.log('ℹ️ No active session');
      }
    } catch (error) {
      console.error('❌ Session check failed:', error);
    }
    console.groupEnd();
    
    console.log('✅ Diagnostics completed');
    console.groupEnd();
  }

  async checkStrategy(googleUser: any): Promise<void> {
    console.group('🎯 Authentication Strategy Test');
    
    try {
      // Import the AuthenticationManager to test strategies
      const { AuthenticationManager } = await import('../services/authStrategies');
      const { supabaseService } = await import('../services/supabaseService');
      
      console.log('📝 Testing Google user object:', {
        hasEmail: !!googleUser?.email,
        hasName: !!googleUser?.name,
        hasId: !!googleUser?.sub || !!googleUser?.id,
        hasAccessToken: !!googleUser?.access_token,
        keys: Object.keys(googleUser || {})
      });
      
      // Test environment detection
      const isProduction = window.location.hostname !== 'localhost';
      console.log(`🌍 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
      
      // Check which strategy would be selected
      console.log('🎯 Strategy selection logic:');
      console.log('- Full Integration: Available in all environments');
      console.log('- Google Only: Fallback when Full Integration fails');
      
      // Initialize manager for future use
      new AuthenticationManager(supabase, supabaseService);
      console.log('✅ AuthenticationManager initialized successfully');
      
    } catch (error) {
      console.error('❌ Strategy test failed:', error);
    }
    
    console.groupEnd();
  }

  async forceGoogleOnly(googleUser: any): Promise<void> {
    console.group('📱 Force Google-Only Authentication Test');
    
    try {
      const { GoogleOnlyStrategy } = await import('../services/authStrategies');
      const strategy = new GoogleOnlyStrategy();
      
      const result = await strategy.authenticate(googleUser);
      
      if (result) {
        console.log('✅ Google-only authentication successful');
        console.log('👤 User profile:', result);
      } else {
        console.log('❌ Google-only authentication failed');
      }
      
    } catch (error) {
      console.error('❌ Google-only test failed:', error);
    }
    
    console.groupEnd();
  }

  async testFullIntegration(googleUser: any): Promise<void> {
    console.group('🔗 Force Full Integration Test');
    
    try {
      const { FullIntegrationStrategy } = await import('../services/authStrategies');
      const { supabaseService } = await import('../services/supabaseService');
      
      const strategy = new FullIntegrationStrategy(supabase, supabaseService);
      
      const result = await strategy.authenticate(googleUser);
      
      if (result) {
        console.log('✅ Full integration authentication successful');
        console.log('👤 User profile:', result);
      } else {
        console.log('❌ Full integration authentication failed');
      }
      
    } catch (error) {
      console.error('❌ Full integration test failed:', error);
    }
    
    console.groupEnd();
  }

  clearLogs(): void {
    console.clear();
    this.logs = [];
    console.log('🧹 Logs cleared');
  }

  exportLogs(): void {
    const logData = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      config: {
        hasSupabaseUrl: !!import.meta.env.VITE_SUPABASE_URL,
        hasSupabaseKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL
      },
      logs: this.logs
    };
    
    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quizai-debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    console.log('📥 Debug logs exported');
  }
}

// Create global debug instance
const productionDebugger = new ProductionDebugger();

// Attach to window for console access
(window as any).QuizAIDebug = {
  testAuth: productionDebugger.testAuth.bind(productionDebugger),
  checkConfig: productionDebugger.checkConfig.bind(productionDebugger),
  runDiagnostics: productionDebugger.runDiagnostics.bind(productionDebugger),
  checkStrategy: productionDebugger.checkStrategy.bind(productionDebugger),
  forceGoogleOnly: productionDebugger.forceGoogleOnly.bind(productionDebugger),
  testFullIntegration: productionDebugger.testFullIntegration.bind(productionDebugger),
  clearLogs: productionDebugger.clearLogs.bind(productionDebugger),
  exportLogs: productionDebugger.exportLogs.bind(productionDebugger)
};

// Log availability
logger.info('Production debug utilities loaded. Use window.QuizAIDebug in browser console.', 'ProductionDebug');

export default productionDebugger;
