
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

  const handleLoginError = (error?: any) => { 
    logger.error("Google Login Failed.", 'SignInPage', { errorDetails: error });
  };

  // Handle credential-based authentication (provides ID token)
  const handleCredentialResponse = async (credentialResponse: GoogleCredentialResponse) => {
    logger.info("🎉 Google Login successful - ID token received!", 'SignInPage', { 
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
        
        logger.info("Calling login...", 'SignInPage', { 
          userId: userProfile.id,
          hasIdToken: true
        });
        
        const loginResult = await login(userProfile);
        
        if (loginResult) {
          logger.info("Login completed successfully, redirecting...", 'SignInPage', { userId: loginResult.id });
          const from = (location.state as any)?.from?.pathname || '/dashboard';
          navigate(from, { replace: true });
        } else {
          logger.error("Login returned null result", 'SignInPage');
          handleLoginError(new Error("Login failed - no user returned"));
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
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] mb-4 mt-8 sm:mt-10">
          {t('signInTitle')}
        </h1>
        <p className="text-[var(--color-text-secondary)] mb-10 text-sm">
          {t('signInSubtitle')}
        </p>
        
        <div className="flex flex-col items-center mb-8">
          <GoogleLogin
            onSuccess={handleCredentialResponse}
            onError={handleLoginError}
            useOneTap={false}
            shape="rectangular"
            theme="outline"
            size="large"
            text="signin_with"
            width="300"
            locale="en"
          />
        </div>
        
        <p className="text-xs text-[var(--color-text-muted)]">
          {t('signInAgreementPrompt')} {' '}
          <a href="#" className="text-[var(--color-primary-accent)] hover:underline font-medium">
            {t('footerTerms')}
          </a> {t('and')} {' '}
          <a href="#" className="text-[var(--color-primary-accent)] hover:underline font-medium">
            {t('footerPrivacy')}
          </a>.
        </p>
      </Card>
    </div>
  );
};
SignInPage.displayName = "SignInPage";

export default SignInPage;
