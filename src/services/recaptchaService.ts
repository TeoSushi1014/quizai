

/**
 * Gửi yêu cầu đánh giá reCAPTCHA Enterprise đến Google
 * @param {string} token - Token được trả về từ grecaptcha.enterprise.execute()
 * @param {string} [userAction] - Hành động người dùng (tùy chọn)
 * @returns {Promise<any>} Kết quả đánh giá từ Google
 */
export const sendRecaptchaAssessment = async (token: string, userAction: string | null = null): Promise<any> => {
  try {
    // @ts-ignore
    const ASSESSMENT_API_KEY = typeof import.meta.env !== 'undefined' ? import.meta.env.VITE_RECAPTCHA_ASSESSMENT_API_KEY : undefined;
    // @ts-ignore
    const SITE_KEY = typeof import.meta.env !== 'undefined' ? import.meta.env.VITE_RECAPTCHA_SITE_KEY : undefined;
    
    if (!ASSESSMENT_API_KEY) {
      console.error('VITE_RECAPTCHA_ASSESSMENT_API_KEY not found in environment variables. Cannot send assessment.');
      throw new Error('reCAPTCHA Assessment API key not configured.');
    }
    if (!SITE_KEY) {
      console.error('VITE_RECAPTCHA_SITE_KEY not found in environment variables. Cannot send assessment.');
      throw new Error('reCAPTCHA Site Key not configured.');
    }
    
    const ASSESSMENT_URL = `https://recaptchaenterprise.googleapis.com/v1/projects/quizai-5168b/assessments?key=${ASSESSMENT_API_KEY}`;
    
    // Tạo payload yêu cầu
    const requestBody: any = {
      event: {
        token: token,
        siteKey: SITE_KEY
      }
    };
    
    // Thêm expectedAction nếu được cung cấp
    if (userAction) {
      requestBody.event.expectedAction = userAction;
    }
    
    console.log('Gửi yêu cầu đánh giá với payload:', JSON.stringify(requestBody, null, 2));
    
    // Gửi yêu cầu POST
    const response = await fetch(ASSESSMENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    // Phân tích và ghi nhật ký phản hồi
    const data = await response.json();
    console.log('Phản hồi đánh giá:', JSON.stringify(data, null, 2));
    
    if (!response.ok) {
      console.error('Lỗi từ API đánh giá reCAPTCHA:', data);
      const errorMessage = data?.error?.message || `HTTP error ${response.status}`;
      if (response.status === 403) {
         throw new Error(`reCAPTCHA assessment failed: Permission denied. Check if the API key (${ASSESSMENT_API_KEY ? ASSESSMENT_API_KEY.slice(0,5) + '...' : 'N/A'}) is enabled for reCAPTCHA Enterprise API and has correct permissions/restrictions. ${errorMessage}`);
      }
      throw new Error(`reCAPTCHA assessment failed: ${errorMessage}`);
    }
    
    return data;
    
  } catch (error) {
    console.error('Lỗi khi gửi đánh giá reCAPTCHA:', error);
    throw error; // Re-throw the error to be handled by the caller
  }
}

/**
 * Xử lý kết quả đánh giá reCAPTCHA
 * @param {any} assessmentResult - Kết quả đánh giá từ Google
 * @returns {boolean} true nếu đánh giá thành công, false nếu không
 */
export const validateRecaptchaAssessment = (assessmentResult: any): boolean => {
  // Kiểm tra xem token có hợp lệ không
  if (!assessmentResult || !assessmentResult.tokenProperties || !assessmentResult.tokenProperties.valid) {
    console.error('Token reCAPTCHA không hợp lệ:', assessmentResult?.tokenProperties?.invalidReason);
    return false;
  }
  
  // Kiểm tra điểm số rủi ro
  // Adjust threshold as needed. For login, a higher threshold might be desired.
  // For less sensitive actions, a lower threshold might be acceptable.
  // Google recommends not solely relying on the score but using it with other signals.
  // For this example, we'll use 0.5 as a general threshold.
  const scoreThreshold = 0.5; 
  if (!assessmentResult.riskAnalysis || typeof assessmentResult.riskAnalysis.score !== 'number' || assessmentResult.riskAnalysis.score < scoreThreshold) {
    console.warn('Điểm số reCAPTCHA thấp hoặc không có:', assessmentResult.riskAnalysis ? assessmentResult.riskAnalysis.score : 'không có điểm số');
    // Potentially log more reasons if available, e.g., assessmentResult.riskAnalysis.reasons
    return false;
  }
  
  // Nếu mọi thứ ổn, trả về true
  console.log('Xác thực reCAPTCHA thành công với điểm số:', assessmentResult.riskAnalysis.score);
  return true;
}