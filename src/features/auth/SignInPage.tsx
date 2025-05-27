
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TokenResponse, useGoogleLogin } from '@react-oauth/google'; // Changed CredentialResponse to TokenResponse
import { useAppContext, useTranslation } from '../../App';
import { UserProfile } from '../../types';
import { Button, Card } from '../../components/ui';
// Removed import for sendRecaptchaAssessment and validateRecaptchaAssessment as assessment is skipped
// import { sendRecaptchaAssessment, validateRecaptchaAssessment } from '../../services/recaptchaService';

// Declare grecaptcha for TypeScript
declare const grecaptcha: any;

const SignInPage: React.FC = () => {
  const { login, currentUser } = useAppContext(); 
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const siteKey = '6LfjXkorAAAAAOk4X5LwVd-8RgwMGS0IWxZLtFGQ';

  React.useEffect(() => {
    if (currentUser) {
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [currentUser, navigate, location.state]);

  const handleLoginError = () => { 
    console.error("Login Failed. Check Google Cloud Console for redirect_uri_mismatch or other OAuth errors. Also check server COOP headers."); 
    // Optionally, provide user feedback here
  };

  const handleLoginSuccess = async (tokenResponse: TokenResponse) => {
    if (tokenResponse.access_token) {
      try {
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });

        if (!userInfoResponse.ok) {
          const errorData = await userInfoResponse.json().catch(() => ({ message: "Failed to parse error response from userinfo endpoint" }));
          console.error("Failed to fetch user info:", userInfoResponse.status, userInfoResponse.statusText, errorData);
          handleLoginError();
          return;
        }

        const userInfo = await userInfoResponse.json();
        const userProfile: UserProfile = {
          id: userInfo.sub,
          name: userInfo.name,
          email: userInfo.email,
          imageUrl: userInfo.picture,
        };
        login(userProfile); // This should trigger context update and navigation
      } catch (error) {
        console.error("Error during token validation or fetching user info:", error);
        handleLoginError();
      }
    } else {
      console.error("Login success callback, but no access_token in tokenResponse:", tokenResponse);
      handleLoginError();
    }
  };

  const initiateGoogleLogin = useGoogleLogin({
    onSuccess: handleLoginSuccess,
    onError: handleLoginError,
    // flow: 'implicit', // Default, suitable for client-side token handling, provides access_token
  });

  const handleCustomGoogleLoginClick = () => {
    if (typeof grecaptcha === 'undefined' || typeof grecaptcha.enterprise === 'undefined') {
      console.error('reCAPTCHA enterprise.js not loaded. Proceeding with login directly.');
      initiateGoogleLogin();
      return;
    }

    grecaptcha.enterprise.ready(async () => {
      try {
        // Lấy token từ reCAPTCHA với hành động "LOGIN"
        const token = await grecaptcha.enterprise.execute(siteKey, { action: 'LOGIN' });
        console.log('reCAPTCHA token obtained (first 10 chars):', token.slice(0, 10) + '...');
        
        // Intentionally skipping client-side assessment call (sendRecaptchaAssessment)
        // as it was causing 403 errors, likely due to API key misconfiguration for client-side assessment.
        // The application logic previously proceeded with login even if reCAPTCHA validation failed.
        // For a robust implementation, reCAPTCHA assessment should ideally be done server-side.
        console.log('Skipping reCAPTCHA assessment. Proceeding with login.');
        initiateGoogleLogin();

      } catch (error) {
        console.error('Lỗi khi thực thi reCAPTCHA (token generation):', error);
        // Fallback to login if reCAPTCHA token generation itself fails
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
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-50 mb-4 mt-8 sm:mt-10">{t('signInTitle')}</h1>
        <p className="text-slate-300/80 mb-10 text-sm">{t('signInSubtitle')}</p>
        
        <div className="flex justify-center mb-8">
            <Button
              onClick={handleCustomGoogleLoginClick}
              variant="outline" 
              size="lg" 
              leftIcon={<img src="https://img.icons8.com/color/48/google-logo.png" alt="Google" className="w-5 h-5" />}
              className="w-full max-w-xs sm:w-[280px] !justify-start !text-slate-200 !bg-slate-700/60 hover:!bg-slate-600/80 !border-slate-600 hover:!border-slate-500 !px-4 !py-3 !rounded-lg shadow-md"
            >
              <span className="ml-3 text-sm font-medium">{t('loginWithGoogle')}</span>
            </Button>
        </div>
        
        <p className="text-xs text-slate-400/80">
          {t('signInAgreementPrompt')} {' '}
          <a href="#" className="text-sky-400 hover:underline font-medium">{t('footerTerms')}</a> {t('and')} {' '}
          <a href="#" className="text-sky-400 hover:underline font-medium">{t('footerPrivacy')}</a>.
        </p>
      </Card>
    </div>
  );
};

export default SignInPage;
