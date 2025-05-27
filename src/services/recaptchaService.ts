/**
 * Gửi yêu cầu đánh giá reCAPTCHA Enterprise đến Google
 * @param {string} token - Token được trả về từ grecaptcha.enterprise.execute()
 * @param {string} [userAction] - Hành động người dùng (tùy chọn)
 * @returns {Promise<any>} Kết quả đánh giá từ Google
 */
export const sendRecaptchaAssessment = async (token: string, userAction: string | null = null): Promise<any> => {
  try {
    const API_KEY = 'AIzaSyByTgrc0nlsvDkCuRvmil_EAyPVp9L3H60';
    const ASSESSMENT_URL = `https://recaptchaenterprise.googleapis.com/v1/projects/quizai-5168b/assessments?key=${API_KEY}`;
    
    // Tạo payload yêu cầu
    const requestBody: any = {
      event: {
        token: token,
        siteKey: "6LfjXkorAAAAAOk4X5LwVd-8RgwMGS0IWxZLtFGQ"
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
    
    return data;
    
  } catch (error) {
    console.error('Lỗi khi gửi đánh giá reCAPTCHA:', error);
    throw error;
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
    console.error('Token reCAPTCHA không hợp lệ');
    return false;
  }
  
  // Kiểm tra điểm số rủi ro
  if (!assessmentResult.riskAnalysis || assessmentResult.riskAnalysis.score < 0.5) {
    console.warn('Điểm số reCAPTCHA thấp:', assessmentResult.riskAnalysis ? assessmentResult.riskAnalysis.score : 'không có điểm số');
    return false;
  }
  
  // Nếu mọi thứ ổn, trả về true
  console.log('Xác thực reCAPTCHA thành công với điểm số:', assessmentResult.riskAnalysis.score);
  return true;
}
