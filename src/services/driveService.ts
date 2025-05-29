
import { Quiz } from '../types';
import { logger } from './logService';
import { getCircuitBreaker } from './circuitBreaker';

const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const QUIZ_DATA_FILENAME = 'quizai_user_data.json';

const driveCircuitBreaker = getCircuitBreaker('googleDrive', {
  failureThreshold: 3, // Open circuit after 3 consecutive failures
  resetTimeout: 60000, // Stay open for 60 seconds before trying half-open
  halfOpenSuccessThreshold: 1 // One success in half-open to close circuit
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
  let lastError: Error = new Error("Fetch failed after all retries"); 

  while (retries <= maxRetries) {
    try {
      const response = await fetch(input, init);
      if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
        await response.text(); 
        throw new Error(`Server error: ${response.status}`);
      }
      return response;
    } catch (error) {
      lastError = error as Error;
      retries++;
      if (retries > maxRetries) {
        logger.error(`Fetch failed after ${maxRetries} retries.`, 'fetchWithRetry', { url: String(input) }, lastError);
        break; 
      }
      const delay = Math.min(1000 * Math.pow(2, retries -1) + Math.random() * 1000, 8000);
      logger.warn(`Drive API request failed (attempt ${retries}/${maxRetries}), retrying in ${Math.round(delay/1000)}s.`, 'fetchWithRetry', { url: String(input), error: lastError.message });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

const findQuizDataFile = async (accessToken: string): Promise<DriveFile | null> => {
  return driveCircuitBreaker.execute(async () => {
    const query = `name='${QUIZ_DATA_FILENAME}' and 'me' in owners and trashed=false`;
    const fields = 'files(id,name,mimeType,modifiedTime)';
    const url = `${DRIVE_API_URL}?q=${encodeURIComponent(query)}&spaces=drive&fields=${encodeURIComponent(fields)}`;
    logger.debug('Finding quiz data file', 'driveService', { url });
    try {
      const response = await fetchWithRetry(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logger.error('Drive API error (findFile)', 'driveService', { status: response.status, errorData, url });
        throw new Error(`Google Drive API error ${response.status}: ${errorData.error?.message || 'Failed to find file'}`);
      }
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
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logger.error('Drive API error (readFile)', 'driveService', { status: response.status, errorData, fileId });
        throw new Error(`Google Drive API error ${response.status}: ${errorData.error?.message || 'Failed to read file content'}`);
      }
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
    logger.debug('Creating new file on Drive', 'driveService', { filename: QUIZ_DATA_FILENAME });
    try {
      const response = await fetchWithRetry(url, { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body: body });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logger.error('Drive API error (createFile)', 'driveService', { status: response.status, errorData });
        throw new Error(`Google Drive API error ${response.status}: ${errorData.error?.message || 'Failed to create file'}`);
      }
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
      const response = await fetchWithRetry(url, { method: 'PATCH', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(content) });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logger.error('Drive API error (updateFile)', 'driveService', { status: response.status, errorData, fileId });
        throw new Error(`Google Drive API error ${response.status}: ${errorData.error?.message || 'Failed to update file content'}`);
      }
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
    // Error already logged by findQuizDataFile or readFileContent, CircuitBreaker
    // Here we just re-map to a user-friendly error key if needed.
    if (error instanceof Error) {
        if (error.message.includes("401") || error.message.includes("driveErrorUnauthorized") || error.message.includes("token has been expired or revoked")) {
            throw new Error("driveErrorUnauthorized"); 
        }
        if (error.message.includes("Failed to find file") || error.message.includes("driveErrorFindingFile")) {
            throw new Error("driveErrorFindingFile");
        }
        if (error.message.includes("Failed to read file content") || error.message.includes("driveErrorReadingFile")) {
            throw new Error("driveErrorReadingFile");
        }
        if (error.message.includes("Failed to parse JSON") || error.message.includes("driveErrorParsingFile")) {
            throw new Error("driveErrorParsingFile");
        }
        if (error.message.includes("Circuit for googleDrive is open")) {
           throw new Error('driveErrorGeneric'); // Or a more specific "service temporarily unavailable"
        }
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
    // Error already logged. Re-map to user-friendly key.
    if (error instanceof Error) {
        if (error.message.includes("401") || error.message.includes("driveErrorUnauthorized") || error.message.includes("token has been expired or revoked")) {
            throw new Error("driveErrorUnauthorized");
        }
        if (error.message.includes("Failed to create file") || error.message.includes("driveErrorCreatingFile")) {
            throw new Error("driveErrorCreatingFile");
        }
        if (error.message.includes("Failed to update file") || error.message.includes("driveErrorUpdatingFile")) {
            throw new Error("driveErrorUpdatingFile");
        }
         if (error.message.includes("Circuit for googleDrive is open")) {
           throw new Error('driveErrorSaving'); // Or a more specific "service temporarily unavailable"
        }
    }
    throw new Error('driveErrorSaving'); 
  }
};