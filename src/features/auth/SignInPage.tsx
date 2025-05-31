
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TokenResponse, useGoogleLogin } from '@react-oauth/google'; 
import { useAppContext, useTranslation } from '../../App';
import { UserProfile } from '../../types';
import { Button, Card } from '../../components/ui';
import { logger } from '../../services/logService'; // Import logger


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

  const handleLoginError = (error?: any) => { 
    logger.error("Google Login Failed.", 'SignInPage', { errorDetails: error });
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
        const userProfile: UserProfile = {
          id: userInfo.sub,
          name: userInfo.name,
          email: userInfo.email,
          imageUrl: userInfo.picture,
          // accessToken will be set by the login context function from tokenResponse
        };
        logger.info("User info fetched successfully. Calling login context function.", 'SignInPage', { userId: userProfile.id });
        login(userProfile, tokenResponse); // Pass the full tokenResponse
      } catch (error) {
        logger.error("Error during token validation or fetching user info.", 'SignInPage', undefined, error as Error);
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
    logger.info("Custom Google Login button clicked.", 'SignInPage');
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
        logger.info('Skipping reCAPTCHA assessment for now. Proceeding with login.', 'SignInPage'); // Placeholder for actual assessment
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
        
        <div className="flex justify-center mb-8">
            <Button
              onClick={handleCustomGoogleLoginClick}
              variant="subtle" 
              size="lg" 
              leftIcon={<img src="https://img.icons8.com/color/48/google-logo.png" alt="Google" className="w-5 h-5" />}
              className="w-full max-w-xs sm:w-[280px] !justify-start !text-[var(--color-text-primary)] hover:!bg-[var(--color-bg-surface-3)] !border-[var(--color-border-interactive)] hover:!border-[var(--color-border-strong)] !px-4 !py-3 !rounded-lg shadow-md"
            >
              <span className="ml-3 text-sm font-medium">{t('loginWithGoogle')}</span>
            </Button>
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
