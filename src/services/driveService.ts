import { Quiz } from '../types';
import { logger } from './logService';
import { getCircuitBreaker } from './circuitBreaker';

const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const QUIZ_DATA_FILENAME = 'quizai_user_data.json';

const driveCircuitBreaker = getCircuitBreaker('googleDrive', {
  failureThreshold: 3, 
  resetTimeout: 60000, 
  halfOpenSuccessThreshold: 1 
});

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
}

async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let retries = 0;
  let lastError: Error = new Error("driveErrorGeneric"); // Default to generic error key

  while (retries <= maxRetries) {
    try {
      const response = await fetch(input, init);
      if (!response.ok) {
        let errorKey = 'driveErrorGeneric';
        const status = response.status;
        let responseBodyText = "Could not read error response body";
        try {
            responseBodyText = await response.text(); // Try to get body for logging
        } catch (e) { /* ignore */ }

        if (status === 401) errorKey = 'driveErrorUnauthorized';
        else if (status === 403) errorKey = 'driveErrorForbidden'; // For permission issues
        else if (status === 404) errorKey = 'driveErrorNotFound'; // For file not found on specific operations
        else if (status === 429) errorKey = 'driveErrorRateLimit';
        else if (status >= 500 && status < 600) errorKey = 'driveErrorServer';
        
        lastError = new Error(errorKey); // Use the key as the message
        logger.warn(`Drive API request failed (attempt ${retries + 1}/${maxRetries + 1})`, 'fetchWithRetry', { url: String(input), status, errorKey, responseBodyPreview: responseBodyText.substring(0,100) });

        if (status === 401 || status === 403 || status === 404) { // Non-retryable errors
            throw lastError;
        }
        // For retryable errors (429, 5xx)
        if (retries >= maxRetries) break;
        const delay = Math.min(1000 * Math.pow(2, retries) + Math.random() * 1000, 10000); // Max 10s
        await new Promise(resolve => setTimeout(resolve, delay));
        retries++;
        continue;
      }
      return response; // Successful response
    } catch (error) { // Catches network errors or errors thrown from !response.ok block
      lastError = error instanceof Error ? error : new Error('driveErrorNetwork');
      logger.warn(`Fetch attempt ${retries + 1} failed`, 'fetchWithRetry', { url: String(input), error: lastError.message });
      if (retries >= maxRetries || (lastError.message !== 'driveErrorRateLimit' && lastError.message !== 'driveErrorServer' && lastError.message !== 'driveErrorNetwork')) {
          // If max retries reached, or it's an error type we decided not to retry (like 401 thrown from above)
          break;
      }
      const delay = Math.min(1000 * Math.pow(2, retries) + Math.random() * 1000, 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
      retries++;
    }
  }
  logger.error(`Fetch failed after ${retries} retries.`, 'fetchWithRetry', { url: String(input) }, lastError);
  throw lastError; // Throw the specific error key or network error
}


const findQuizDataFile = async (accessToken: string): Promise<DriveFile | null> => {
  return driveCircuitBreaker.execute(async () => {
    const query = `name='${QUIZ_DATA_FILENAME}' and 'me' in owners and trashed=false`;
    const fields = 'files(id,name,mimeType,modifiedTime)';
    const url = `${DRIVE_API_URL}?q=${encodeURIComponent(query)}&spaces=drive&fields=${encodeURIComponent(fields)}`;
    logger.debug('Finding quiz data file', 'driveService', { url });
    try {
      const response = await fetchWithRetry(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
      // fetchWithRetry throws on !response.ok with an error key already
      const data = await response.json();
      const file = data.files && data.files.length > 0 ? data.files[0] : null;
      logger.info(`Quiz data file ${file ? 'found' : 'not found'}`, 'driveService', { fileId: file?.id });
      return file;
    } catch (error) {
      logger.error('Error in findQuizDataFile execution', 'driveService', { url }, error as Error);
      throw error; 
    }
  });
};

const readFileContent = async (accessToken: string, fileId: string): Promise<Quiz[] | null> => {
   return driveCircuitBreaker.execute(async () => {
    const url = `${DRIVE_API_URL}/${fileId}?alt=media`;
    logger.debug('Reading file content', 'driveService', { fileId, url });
    try {
      const response = await fetchWithRetry(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
      // fetchWithRetry throws on !response.ok
      const textContent = await response.text();
      if (!textContent) {
        logger.info('Drive file content is empty.', 'driveService', { fileId });
        return [];
      }
      const quizzes = JSON.parse(textContent) as Quiz[];
      logger.info('Successfully read and parsed file content.', 'driveService', { fileId, quizCount: quizzes.length });
      return quizzes;
    } catch (error) {
      logger.error('Error in readFileContent execution', 'driveService', { fileId }, error as Error);
      if (error instanceof SyntaxError) { 
          logger.error('Failed to parse JSON from Drive file content.', 'driveService', { fileId }, error);
          throw new Error('driveErrorParsingFile'); // Throw specific key
      }
      throw error; // Re-throw error key from fetchWithRetry or circuit breaker error
    }
  });
};

const createFile = async (accessToken: string, content: Quiz[]): Promise<DriveFile | null> => {
  return driveCircuitBreaker.execute(async () => {
    const metadata = { name: QUIZ_DATA_FILENAME, mimeType: 'application/json' };
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const close_delim = `\r\n--${boundary}--`;
    const body = delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + delimiter + 'Content-Type: application/json\r\n\r\n' + JSON.stringify(content) + close_delim;
    const url = `${DRIVE_UPLOAD_URL}?uploadType=multipart`;
    logger.debug('Creating new file on Drive', 'driveService', { filename: QUIZ_DATA_FILENAME });
    try {
      const response = await fetchWithRetry(url, { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body: body });
      // fetchWithRetry throws on !response.ok
      const newFile = await response.json() as DriveFile;
      logger.info('Successfully created new file on Drive.', 'driveService', { fileId: newFile.id });
      return newFile;
    } catch (error) {
      logger.error('Error in createFile execution', 'driveService', undefined, error as Error);
      throw error;
    }
  });
};

const updateFileContent = async (accessToken: string, fileId: string, content: Quiz[]): Promise<void> => {
  return driveCircuitBreaker.execute(async () => {
    const url = `${DRIVE_UPLOAD_URL}/${fileId}?uploadType=media`;
    logger.debug('Updating file content on Drive', 'driveService', { fileId });
    try {
      await fetchWithRetry(url, { method: 'PATCH', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(content) });
      // fetchWithRetry throws on !response.ok
      logger.info('Successfully updated file content on Drive.', 'driveService', { fileId });
    } catch (error) {
      logger.error('Error in updateFileContent execution', 'driveService', { fileId }, error as Error);
      throw error;
    }
  });
};

export const loadQuizDataFromDrive = async (accessToken: string): Promise<Quiz[] | null> => {
  try {
    const file = await findQuizDataFile(accessToken);
    if (file && file.id) {
      return await readFileContent(accessToken, file.id);
    }
    return null; 
  } catch (error) {
    logger.error('loadQuizDataFromDrive failed overall', 'driveService', undefined, error as Error);
    if (error instanceof Error && error.message.startsWith('driveError')) {
      throw error; // Re-throw specific error key
    }
    throw new Error('driveErrorLoading'); // Generic fallback key
  }
};

export const saveQuizDataToDrive = async (accessToken: string, quizzes: Quiz[]): Promise<void> => {
  try {
    const file = await findQuizDataFile(accessToken);
    if (file && file.id) {
      await updateFileContent(accessToken, file.id, quizzes);
    } else {
      await createFile(accessToken, quizzes);
    }
  } catch (error) {
    logger.error('saveQuizDataToDrive failed overall', 'driveService', undefined, error as Error);
     if (error instanceof Error && error.message.startsWith('driveError')) {
      throw error; // Re-throw specific error key
    }
    throw new Error('driveErrorSaving'); // Generic fallback key
  }
};