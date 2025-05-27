
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CredentialResponse, useGoogleLogin } from '@react-oauth/google';
import { useAppContext, useTranslation } from '../../App';
import { UserProfile } from '../../types';
import { Button, Card } from '../../components/ui';
import { sendRecaptchaAssessment, validateRecaptchaAssessment } from '../../services/recaptchaService';

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

  const handleLoginSuccess = (credentialResponse: Omit<CredentialResponse, 'error' | 'error_description' | 'error_uri'>) => {
    if (credentialResponse.credential) {
      try {
        const base64Url = credentialResponse.credential.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        const decodedToken = JSON.parse(jsonPayload);
        const userProfile: UserProfile = { id: decodedToken.sub, name: decodedToken.name, email: decodedToken.email, imageUrl: decodedToken.picture };
        login(userProfile);
      } catch (error) { console.error("Failed to decode JWT or extract profile:", error); }
    }
  };

  const handleLoginError = () => { console.error("Login Failed. Check Google Cloud Console for redirect_uri_mismatch or other OAuth errors."); };

  const initiateGoogleLogin = useGoogleLogin({
    onSuccess: handleLoginSuccess,
    onError: handleLoginError,
    // flow: 'implicit', // Default, suitable for client-side token handling
  });

  const handleCustomGoogleLoginClick = async () => {
    if (typeof grecaptcha === 'undefined' || typeof grecaptcha.enterprise === 'undefined') {
      console.error('reCAPTCHA enterprise.js not loaded');
      // Fallback to original login if reCAPTCHA is not available
      initiateGoogleLogin();
      return;
    }

    try {
      // Đảm bảo reCAPTCHA đã sẵn sàng
      await grecaptcha.enterprise.ready();
      
      // Lấy token từ reCAPTCHA với hành động "LOGIN"
      const token = await grecaptcha.enterprise.execute(siteKey, { action: 'LOGIN' });
      console.log('reCAPTCHA token:', token.slice(0, 10) + '...');
      
      // Gửi token đến Google để đánh giá
      const assessmentResult = await sendRecaptchaAssessment(token, 'LOGIN');
      
      // Xác thực kết quả đánh giá
      const isValid = validateRecaptchaAssessment(assessmentResult);
      
      if (isValid) {
        // Nếu xác thực thành công, tiếp tục đăng nhập
        console.log('Xác thực reCAPTCHA thành công, tiến hành đăng nhập');
        initiateGoogleLogin();
      } else {
        // Nếu xác thực thất bại, hiển thị cảnh báo
        console.error('Xác thực reCAPTCHA thất bại');
        alert(t('recaptchaVerificationFailed'));
        // Decide whether to proceed with login based on security requirements.
        // For demo, we might allow login, but in a real app, you might block it.
        // initiateGoogleLogin(); // Potentially allow login even if reCAPTCHA fails for demo purposes
      }
    } catch (error) {
      console.error('Lỗi khi thực thi reCAPTCHA:', error);
      // Handle error: decide whether to proceed with login even if reCAPTCHA encounters an issue.
      initiateGoogleLogin();
    }
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
