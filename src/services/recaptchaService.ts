import { logger } from './logService';

/**
 * Sends a reCAPTCHA Enterprise assessment request to Google.
 * @param {string} token - Token returned from grecaptcha.enterprise.execute()
 * @param {string} [userAction] - User action (optional)
 * @returns {Promise<any>} Assessment result from Google
 */
export const sendRecaptchaAssessment = async (token: string, userAction: string | null = null): Promise<any> => {
  try {
    // @ts-ignore
    const ASSESSMENT_API_KEY = typeof import.meta.env !== 'undefined' ? import.meta.env.VITE_RECAPTCHA_ASSESSMENT_API_KEY : undefined;
    // @ts-ignore
    const SITE_KEY = typeof import.meta.env !== 'undefined' ? import.meta.env.VITE_RECAPTCHA_SITE_KEY : undefined;
    
    if (!ASSESSMENT_API_KEY) {
      logger.error('VITE_RECAPTCHA_ASSESSMENT_API_KEY not found in environment variables.', 'reCAPTCHA');
      throw new Error('reCAPTCHA Assessment API key not configured.');
    }
    if (!SITE_KEY) {
      logger.error('VITE_RECAPTCHA_SITE_KEY not found in environment variables.', 'reCAPTCHA');
      throw new Error('reCAPTCHA Site Key not configured.');
    }
    
    const ASSESSMENT_URL = `https://recaptchaenterprise.googleapis.com/v1/projects/quizai-5168b/assessments?key=${ASSESSMENT_API_KEY}`;
    
    const requestBody: any = {
      event: {
        token: token,
        siteKey: SITE_KEY
      }
    };
    
    if (userAction) {
      requestBody.event.expectedAction = userAction;
    }
    
    logger.info('Sending reCAPTCHA assessment request.', 'reCAPTCHA', { url: ASSESSMENT_URL, action: userAction });
    
    const response = await fetch(ASSESSMENT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    
    const data = await response.json();
    logger.info('Received reCAPTCHA assessment response.', 'reCAPTCHA', { status: response.status, responseDataPreview: JSON.stringify(data).substring(0,100) });
    
    if (!response.ok) {
      logger.error('Error from reCAPTCHA assessment API.', 'reCAPTCHA', { status: response.status, responseData: data });
      const errorMessage = data?.error?.message || `HTTP error ${response.status}`;
      if (response.status === 403) {
         throw new Error(`reCAPTCHA assessment failed: Permission denied. Check API key (${ASSESSMENT_API_KEY ? ASSESSMENT_API_KEY.slice(0,5) + '...' : 'N/A'}) permissions. ${errorMessage}`);
      }
      throw new Error(`reCAPTCHA assessment failed: ${errorMessage}`);
    }
    
    return data;
    
  } catch (error) {
    logger.error('Error sending reCAPTCHA assessment.', 'reCAPTCHA', undefined, error as Error);
    throw error; 
  }
}

/**
 * Processes the reCAPTCHA assessment result.
 * @param {any} assessmentResult - Assessment result from Google
 * @returns {boolean} true if the assessment is successful, false otherwise
 */
export const validateRecaptchaAssessment = (assessmentResult: any): boolean => {
  if (!assessmentResult || !assessmentResult.tokenProperties || !assessmentResult.tokenProperties.valid) {
    logger.warn('reCAPTCHA token invalid.', 'reCAPTCHA', { reason: assessmentResult?.tokenProperties?.invalidReason });
    return false;
  }
  
  const scoreThreshold = 0.5; 
  if (!assessmentResult.riskAnalysis || typeof assessmentResult.riskAnalysis.score !== 'number' || assessmentResult.riskAnalysis.score < scoreThreshold) {
    logger.warn('reCAPTCHA score low or missing.', 'reCAPTCHA', { score: assessmentResult.riskAnalysis ? assessmentResult.riskAnalysis.score : 'N/A' });
    return false;
  }
  
  logger.info('reCAPTCHA validation successful.', 'reCAPTCHA', { score: assessmentResult.riskAnalysis.score });
  return true;
}
