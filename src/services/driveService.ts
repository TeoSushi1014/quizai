
import { Quiz } from '../types';

const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const QUIZ_DATA_FILENAME = 'quizai_user_data.json';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
}

// Finds the specific quiz data file
const findQuizDataFile = async (accessToken: string): Promise<DriveFile | null> => {
  const query = `name='${QUIZ_DATA_FILENAME}' and 'me' in owners and trashed=false`;
  const fields = 'files(id,name,mimeType,modifiedTime)';
  const url = `${DRIVE_API_URL}?q=${encodeURIComponent(query)}&spaces=drive&fields=${encodeURIComponent(fields)}`;

  try {
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Drive API error (findFile):', response.status, errorData);
      throw new Error(`Google Drive API error ${response.status}: ${errorData.error?.message || 'Failed to find file'}`);
    }
    const data = await response.json();
    return data.files && data.files.length > 0 ? data.files[0] : null;
  } catch (error) {
    console.error('Error in findQuizDataFile:', error);
    throw error; // Re-throw to be caught by caller
  }
};

// Reads content of a file
const readFileContent = async (accessToken: string, fileId: string): Promise<Quiz[] | null> => {
  const url = `${DRIVE_API_URL}/${fileId}?alt=media`;
  try {
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Drive API error (readFile):', response.status, errorData);
      throw new Error(`Google Drive API error ${response.status}: ${errorData.error?.message || 'Failed to read file content'}`);
    }
    const textContent = await response.text();
    if (!textContent) return []; // Empty file
    return JSON.parse(textContent) as Quiz[];
  } catch (error) {
    console.error('Error in readFileContent:', error);
    if (error instanceof SyntaxError) { // JSON parsing error
        console.error('Failed to parse JSON from Drive file content.');
    }
    throw error; // Re-throw
  }
};

// Creates a new file
const createFile = async (accessToken: string, content: Quiz[]): Promise<DriveFile | null> => {
  const metadata = {
    name: QUIZ_DATA_FILENAME,
    mimeType: 'application/json',
    // parents: ['appDataFolder'] // Using appDataFolder is more robust for app-specific data
                                // but requires ensuring 'drive.appdata' scope if used, or careful handling with 'drive.file'.
                                // For 'drive.file', not specifying parents places it in user's root Drive.
  };
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const close_delim = `\r\n--${boundary}--`;

  const body = 
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(content) +
    close_delim;

  const url = `${DRIVE_UPLOAD_URL}?uploadType=multipart`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: body
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Drive API error (createFile):', response.status, errorData);
      throw new Error(`Google Drive API error ${response.status}: ${errorData.error?.message || 'Failed to create file'}`);
    }
    return await response.json() as DriveFile;
  } catch (error) {
    console.error('Error in createFile:', error);
    throw error;
  }
};

// Updates content of an existing file
const updateFileContent = async (accessToken: string, fileId: string, content: Quiz[]): Promise<void> => {
  const url = `${DRIVE_UPLOAD_URL}/${fileId}?uploadType=media`;
  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(content)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Drive API error (updateFile):', response.status, errorData);
      throw new Error(`Google Drive API error ${response.status}: ${errorData.error?.message || 'Failed to update file content'}`);
    }
  } catch (error) {
    console.error('Error in updateFileContent:', error);
    throw error;
  }
};


export const loadQuizDataFromDrive = async (accessToken: string): Promise<Quiz[] | null> => {
  try {
    const file = await findQuizDataFile(accessToken);
    if (file && file.id) {
      return await readFileContent(accessToken, file.id);
    }
    return null; // File not found, which is a valid scenario for new users
  } catch (error) {
    console.error('Failed to load quiz data from Drive:', error);
    // Depending on the error type, you might want to throw specific errors
    if (error instanceof Error && error.message.includes("401")) {
        throw new Error("DriveErrorNoToken"); // Or a more specific "Unauthorized" error
    }
    if (error instanceof Error && error.message.includes("Failed to find file")) {
        throw new Error("DriveErrorFindingFile");
    }
    if (error instanceof Error && error.message.includes("Failed to read file content")) {
        throw new Error("DriveErrorReadingFile");
    }
     if (error instanceof Error && error.message.includes("Failed to parse JSON")) {
        throw new Error("DriveErrorParsingFile");
    }
    throw new Error('DriveErrorLoading'); // Generic loading error
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
    console.error('Failed to save quiz data to Drive:', error);
     if (error instanceof Error && error.message.includes("401")) {
        throw new Error("DriveErrorNoToken");
    }
    // Distinguish between create/update errors if necessary
    if (error instanceof Error && error.message.includes("Failed to create file")) {
        throw new Error("DriveErrorCreatingFile");
    }
    if (error instanceof Error && error.message.includes("Failed to update file")) {
        throw new Error("DriveErrorUpdatingFile");
    }
    throw new Error('DriveErrorSaving'); // Generic saving error
  }
};
