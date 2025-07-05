
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GoogleCredentialResponse, GoogleLogin } from '@react-oauth/google'; 
import { useAppContext, useTranslation } from '../../App';
import { UserProfile } from '../../types';
import { Card } from '../../components/ui';
import { logger } from '../../services/logService';

const SignInPage: React.FC = () => {
  const { login, currentUser } = useAppContext(); 
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    if (currentUser) {
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      logger.info('User already signed in, redirecting.', 'SignInPage', { from });
      navigate(from, { replace: true });
    }
  }, [currentUser, navigate, location.state]);

  // Debug: Check if GoogleLogin component is available
  React.useEffect(() => {
    console.log("🔍 SignInPage loaded, GoogleLogin component should be available");
    
    // Check Google OAuth setup
    const hasGoogleOAuth = !!(window as any).google;
    const hasGoogleScript = !!document.querySelector('script[src*="accounts.google.com"]');
    
    logger.info("SignInPage loaded - checking Google OAuth setup", 'SignInPage', {
      hasGoogleOAuth,
      hasGoogleScript,
      currentDomain: window.location.hostname,
      currentURL: window.location.href
    });
    
    // Test if Google OAuth is properly initialized
    setTimeout(() => {
      console.log("🧪 Testing Google OAuth availability:", {
        googleObject: !!(window as any).google,
        googleAccounts: !!(window as any).google?.accounts,
        googleId: !!(window as any).google?.accounts?.id,
        domain: window.location.hostname
      });
      
      if (!(window as any).google?.accounts?.id) {
        console.error("🔴 Google OAuth not properly loaded! GoogleLogin component may not work.");
        console.error("🔴 This could be why you're not seeing the ID token authentication working.");
      }
    }, 2000);
  }, []);

  const handleLoginError = (error?: any) => { 
    logger.error("Google Login Failed.", 'SignInPage', { errorDetails: error });
  };

  // New handler for credential-based authentication (provides ID token)
  const handleCredentialResponse = async (credentialResponse: GoogleCredentialResponse) => {
    logger.info("🎉 GoogleLogin SUCCESS - ID token received!", 'SignInPage', { 
      hasCredential: !!credentialResponse.credential,
      credentialLength: credentialResponse.credential?.length || 0
    });
    
    if (credentialResponse.credential) {
      try {
        // Decode the JWT to get user info
        const base64Url = credentialResponse.credential.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        
        const userInfo = JSON.parse(jsonPayload);
        logger.info("ID token decoded successfully", 'SignInPage', { 
          userId: userInfo.sub,
          email: userInfo.email 
        });

        const userProfile: UserProfile = {
          id: userInfo.sub,
          name: userInfo.name,
          email: userInfo.email,
          imageUrl: userInfo.picture,
          idToken: credentialResponse.credential, // This is the ID token we need for Supabase
        };
        
        logger.info("User profile created from ID token. Calling login context function.", 'SignInPage', { 
          userId: userProfile.id,
          hasIdToken: true 
        });
        
        try {
          const loginResult = await login(userProfile);
          
          if (loginResult) {
            logger.info("Login completed successfully, redirecting...", 'SignInPage', { userId: loginResult.id });
            const from = (location.state as any)?.from?.pathname || '/dashboard';
            navigate(from, { replace: true });
          } else {
            logger.error("Login returned null result", 'SignInPage');
            handleLoginError(new Error("Login failed - no user returned"));
          }
        } catch (loginError) {
          logger.error("Login process failed", 'SignInPage', undefined, loginError as Error);
          handleLoginError(loginError);
        }
      } catch (error) {
        logger.error("Error during credential processing or login", 'SignInPage', undefined, error as Error);
        handleLoginError(error);
      }
    } else {
      logger.error("Credential response received but no credential token", 'SignInPage', { credentialResponse });
      handleLoginError(credentialResponse);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-250px)] py-10 sm:py-16">
      <Card 
        className="max-w-md w-full text-center shadow-2xl p-8 sm:p-10 md:p-12 !rounded-2xl" 
        useGlassEffect={true}
      >
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] mb-4 mt-8 sm:mt-10">{t('signInTitle')}</h1>
        <p className="text-[var(--color-text-secondary)] mb-10 text-sm">{t('signInSubtitle')}</p>
        
        <div className="flex flex-col items-center space-y-6 mb-8">
          {/* Primary authentication method: GoogleLogin (provides ID token) */}
          <div className="w-full max-w-xs sm:w-[280px]">
            <div className="text-sm font-medium text-[var(--color-primary-accent)] text-center mb-2">
              ✨ Sign in with Google
            </div>
            <div className="border-4 border-green-500 rounded p-3 bg-green-50 shadow-lg">
              <GoogleLogin
                onSuccess={handleCredentialResponse}
                onError={(error?: any) => {
                  logger.error("GoogleLogin component failed", 'SignInPage', { 
                    error,
                    domain: window.location.hostname,
                    userAgent: navigator.userAgent,
                    isSecureContext: window.isSecureContext
                  });
                  console.error("🔴 GoogleLogin component error occurred!", error);
                  console.error("🔴 If you see Cross-Origin-Opener-Policy errors, this might be a domain configuration issue");
                  console.error("🔴 Current domain:", window.location.hostname);
                  handleLoginError("Google Login component failed");
                }}
                useOneTap={false}
                shape="rectangular"
                theme="outline"
                size="large"
                text="signin_with"
                width="260"
                locale="en"
              />
            </div>
          </div>
        </div>
        
        <p className="text-xs text-[var(--color-text-muted)]">
          {t('signInAgreementPrompt')} {' '}
          <a href="#" className="text-[var(--color-primary-accent)] hover:underline font-medium">{t('footerTerms')}</a> {t('and')} {' '}
          <a href="#" className="text-[var(--color-primary-accent)] hover:underline font-medium">{t('footerPrivacy')}</a>.
        </p>
      </Card>
    </div>
  );
};
SignInPage.displayName = "SignInPage";

export default SignInPage;
