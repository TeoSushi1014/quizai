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
  let lastError: Error = new Error("driveErrorGeneric");

  while (retries <= maxRetries) {
    try {
      const response = await fetch(input, init);
      if (!response.ok) {
        let errorKey = 'driveErrorGeneric';
        const status = response.status;
        let responseBodyText = "Could not read error response body";
        try {
            responseBodyText = await response.text();
        } catch (e) { /* ignore */ }

        if (status === 401) errorKey = 'driveErrorUnauthorized';
        else if (status === 403) errorKey = 'driveErrorForbidden';
        else if (status === 404) errorKey = 'driveErrorNotFound';
        else if (status === 429) errorKey = 'driveErrorRateLimit';
        else if (status >= 500 && status < 600) errorKey = 'driveErrorServer';
        
        lastError = new Error(errorKey);
        logger.warn(`Drive API request failed (attempt ${retries + 1}/${maxRetries + 1})`, 'fetchWithRetry', { url: String(input), status, errorKey, responseBodyPreview: responseBodyText.substring(0,100) });

        if (status === 401 || status === 403 || status === 404) {
            throw lastError;
        }
        if (retries >= maxRetries) break;
        const delay = Math.min(1000 * Math.pow(2, retries) + Math.random() * 1000, 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        retries++;
        continue;
      }
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('driveErrorNetwork');
      logger.warn(`Fetch attempt ${retries + 1} failed`, 'fetchWithRetry', { url: String(input), error: lastError.message });
      if (retries >= maxRetries || (lastError.message !== 'driveErrorRateLimit' && lastError.message !== 'driveErrorServer' && lastError.message !== 'driveErrorNetwork')) {
          break;
      }
      const delay = Math.min(1000 * Math.pow(2, retries) + Math.random() * 1000, 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
      retries++;
    }
  }
  logger.error(`Fetch failed after ${retries} retries.`, 'fetchWithRetry', { url: String(input) }, lastError);
  throw lastError;
}

const findQuizDataFile = async (accessToken: string): Promise<DriveFile | null> => {
  return driveCircuitBreaker.execute(async () => {
    const query = `name='${QUIZ_DATA_FILENAME}' and 'me' in owners and trashed=false`;
    const fields = 'files(id,name,mimeType,modifiedTime)';
    const url = `${DRIVE_API_URL}?q=${encodeURIComponent(query)}&spaces=drive&fields=${encodeURIComponent(fields)}`;
    
    try {
      const response = await fetchWithRetry(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
      const data = await response.json();
      return data.files && data.files.length > 0 ? data.files[0] : null;
    } catch (error) {
      logger.error('Error in findQuizDataFile execution', 'driveService', { url }, error as Error);
      throw error; 
    }
  });
};

const readFileContent = async (accessToken: string, fileId: string): Promise<Quiz[] | null> => {
   return driveCircuitBreaker.execute(async () => {
    const url = `${DRIVE_API_URL}/${fileId}?alt=media`;
    
    try {
      const response = await fetchWithRetry(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
      const textContent = await response.text();
      if (!textContent) {
        return [];
      }
      return JSON.parse(textContent) as Quiz[];
    } catch (error) {
      logger.error('Error in readFileContent execution', 'driveService', { fileId }, error as Error);
      if (error instanceof SyntaxError) { 
          logger.error('Failed to parse JSON from Drive file content.', 'driveService', { fileId }, error);
          throw new Error('driveErrorParsingFile');
      }
      throw error;
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
    
    try {
      const response = await fetchWithRetry(url, { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body: body });
      return await response.json() as DriveFile;
    } catch (error) {
      logger.error('Error in createFile execution', 'driveService', undefined, error as Error);
      throw error;
    }
  });
};

const updateFileContent = async (accessToken: string, fileId: string, content: Quiz[]): Promise<void> => {
  return driveCircuitBreaker.execute(async () => {
    const url = `${DRIVE_UPLOAD_URL}/${fileId}?uploadType=media`;
    
    try {
      await fetchWithRetry(url, { method: 'PATCH', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(content) });
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
      throw error;
    }
    throw new Error('driveErrorLoading');
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
      throw error;
    }
    throw new Error('driveErrorSaving');
  }
};