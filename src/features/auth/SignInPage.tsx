
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TokenResponse, useGoogleLogin, GoogleCredentialResponse, GoogleLogin } from '@react-oauth/google'; 
import { useAppContext, useTranslation } from '../../App';
import { UserProfile } from '../../types';
import { Button, Card } from '../../components/ui';
import { logger } from '../../services/logService';


declare const grecaptcha: any;

const SignInPage: React.FC = () => {
  const { login, currentUser } = useAppContext(); 
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  
  const siteKey = typeof (import.meta as any).env !== 'undefined' ? (import.meta as any).env.VITE_RECAPTCHA_SITE_KEY : undefined;

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
    logger.info("SignInPage loaded - checking Google OAuth setup", 'SignInPage', {
      hasGoogleOAuth: !!(window as any).google,
      hasGoogleScript: !!document.querySelector('script[src*="accounts.google.com"]')
    });
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
          accessToken: credentialResponse.credential, // Use credential as token
          idToken: credentialResponse.credential, // This is the ID token we need
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

  const handleLoginSuccess = async (tokenResponse: TokenResponse) => {
    logger.info("Google Login Succeeded (token obtained).", 'SignInPage', { hasAccessToken: !!tokenResponse.access_token });
    if (tokenResponse.access_token) {
      try {
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });

        if (!userInfoResponse.ok) {
          const errorData = await userInfoResponse.json().catch(() => ({ message: "Failed to parse error response from userinfo endpoint" }));
          logger.error("Failed to fetch user info from Google.", 'SignInPage', { status: userInfoResponse.status, errorData });
          handleLoginError(errorData);
          return;
        }

        const userInfo = await userInfoResponse.json();
        const pictureUrl = userInfo.picture ? 
          userInfo.picture.replace(/=s\d+-c$/, '=s256-c') :
          userInfo.picture;

        const userProfile: UserProfile = {
          id: userInfo.sub,
          name: userInfo.name,
          email: userInfo.email,
          imageUrl: pictureUrl,
          accessToken: tokenResponse.access_token,
        };
        logger.info("User info fetched successfully. Calling login context function.", 'SignInPage', { userId: userProfile.id });
        
        try {
          const loginResult = await login(userProfile, tokenResponse);
          
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
        logger.error("Error during token validation, fetching user info, or login process.", 'SignInPage', undefined, error as Error);
        handleLoginError(error);
      }
    } else {
      logger.error("Login success callback, but no access_token in tokenResponse.", 'SignInPage', { tokenResponse });
      handleLoginError(tokenResponse);
    }
  };

  const initiateGoogleLogin = useGoogleLogin({
    onSuccess: handleLoginSuccess,
    onError: handleLoginError,
    scope: 'email profile https://www.googleapis.com/auth/drive.file', 
  });

  const handleCustomGoogleLoginClick = () => {
    logger.info("⚠️  FALLBACK Google Login button clicked - this will use access token only!", 'SignInPage');
    console.warn("🔸 User clicked FALLBACK authentication - quiz sharing will NOT work!");
    if (!siteKey) {
      logger.warn('VITE_RECAPTCHA_SITE_KEY is not configured. Proceeding with login directly.', 'SignInPage');
      initiateGoogleLogin();
      return;
    }

    if (typeof grecaptcha === 'undefined' || typeof grecaptcha.enterprise === 'undefined' || typeof grecaptcha.enterprise.ready !== 'function') {
      logger.warn('reCAPTCHA enterprise.js not loaded or not ready. Proceeding with login directly.', 'SignInPage');
      initiateGoogleLogin();
      return;
    }

    grecaptcha.enterprise.ready(async () => {
      try {
        const token = await grecaptcha.enterprise.execute(siteKey, { action: 'LOGIN' });
        logger.info('reCAPTCHA token obtained for LOGIN action.', 'SignInPage', { tokenPreview: token.slice(0,10) + '...' });
        initiateGoogleLogin();

      } catch (error) {
        logger.error('Lỗi khi thực thi reCAPTCHA (token generation):', 'SignInPage', undefined, error as Error);
        initiateGoogleLogin(); 
      }
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-250px)] py-10 sm:py-16">
      <Card 
        className="max-w-md w-full text-center shadow-2xl p-8 sm:p-10 md:p-12 !rounded-2xl" 
        useGlassEffect={true}
      >
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] mb-4 mt-8 sm:mt-10">{t('signInTitle')}</h1>
        <p className="text-[var(--color-text-secondary)] mb-10 text-sm">{t('signInSubtitle')}</p>
        
        <div className="flex flex-col items-center space-y-4 mb-8">
          {/* Primary authentication method: GoogleLogin (provides ID token) */}
          <div className="w-full max-w-xs sm:w-[280px]">
            <div className="text-sm font-medium text-[var(--color-primary-accent)] text-center mb-2">
              ✨ Recommended: Full Features
            </div>
            <GoogleLogin
              onSuccess={handleCredentialResponse}
              onError={() => {
                logger.error("GoogleLogin component failed", 'SignInPage');
                handleLoginError("Google Login component failed");
              }}
              useOneTap={false}
              shape="rectangular"
              theme="outline"
              size="large"
              text="signin_with"
              width="280"
              locale="en"
            />
          </div>
          
          {/* Fallback method: Custom button with access token (if ID token fails) */}
          <div className="w-full max-w-xs sm:w-[280px]">
            <div className="text-xs text-[var(--color-text-muted)] text-center mb-2">
              ⚠️ Limited Features (Quiz sharing won't work)
            </div>
            <Button
              onClick={handleCustomGoogleLoginClick}
              variant="subtle" 
              size="sm" 
              leftIcon={<img src="https://img.icons8.com/color/48/google-logo.png" alt="Google" className="w-4 h-4" />}
              className="w-full !justify-start !text-[var(--color-text-secondary)] hover:!bg-[var(--color-bg-surface-2)] !border-[var(--color-border-subtle)] hover:!border-[var(--color-border-interactive)] !px-3 !py-2 !rounded-md shadow-sm"
            >
              <span className="ml-2 text-xs font-medium">Google (Fallback)</span>
            </Button>
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
