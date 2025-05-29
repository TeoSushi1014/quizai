
import { Quiz } from '../types';
import { loadQuizDataFromDrive, saveQuizDataToDrive } from './driveService';

export const QUIZAI_LOCALSTORAGE_QUIZZES_KEY = 'quizai-quizzes';
export const QUIZAI_LOCALSTORAGE_DRIVE_SYNC_KEY = 'quizai-drive-last-sync';

// --- Local Storage Functions ---

export const getLocalQuizzes = (): Quiz[] => {
  const localQuizzesJson = localStorage.getItem(QUIZAI_LOCALSTORAGE_QUIZZES_KEY);
  try {
    return localQuizzesJson ? JSON.parse(localQuizzesJson) : [];
  } catch (e) {
    console.error("Error parsing local quizzes from localStorage", e);
    localStorage.removeItem(QUIZAI_LOCALSTORAGE_QUIZZES_KEY); // Clear corrupted data
    return [];
  }
};

export const saveLocalQuizzes = (quizzes: Quiz[]): void => {
  try {
    localStorage.setItem(QUIZAI_LOCALSTORAGE_QUIZZES_KEY, JSON.stringify(quizzes));
  } catch (e) {
    console.error("Error saving quizzes to localStorage", e);
    // Consider handling quota exceeded errors or other specific storage errors if necessary
  }
};

export const getLastDriveSyncTimestamp = (): Date | null => {
  const lastSyncTimeStr = localStorage.getItem(QUIZAI_LOCALSTORAGE_DRIVE_SYNC_KEY);
  return lastSyncTimeStr ? new Date(lastSyncTimeStr) : null;
};

export const updateLastDriveSyncTimestamp = (timestamp?: Date): void => {
  localStorage.setItem(QUIZAI_LOCALSTORAGE_DRIVE_SYNC_KEY, (timestamp || new Date()).toISOString());
};

// --- Google Drive Synchronization Function ---

interface DriveSyncResult {
  success: boolean;
  quizzes?: Quiz[];    // The quizzes array that should be used by the app after sync
  errorKey?: string;   // Translation key for any error encountered
  newSyncTime?: Date;  // Timestamp of this sync operation
}

/**
 * Performs a full synchronization with Google Drive.
 * 1. Loads data from Drive.
 * 2. If Drive has data, that data is considered authoritative.
 * 3. If Drive has no data, the provided 'localQuizzesSnapshot' is used.
 * 4. The determined authoritative data is then saved back to Drive to ensure consistency.
 * This function is intended for manual sync operations or initial load scenarios
 * where a full reconciliation is needed.
 */
export const syncWithGoogleDrive = async (
  accessToken: string,
  localQuizzesSnapshot: Quiz[] // A snapshot of quizzes currently in local state/storage
): Promise<DriveSyncResult> => {
  try {
    const driveQuizzes = await loadQuizDataFromDrive(accessToken);
    let quizzesToUseAsAuthoritative: Quiz[];
    const now = new Date();

    if (driveQuizzes !== null) {
      // Data found on Drive, it's authoritative for this sync.
      quizzesToUseAsAuthoritative = driveQuizzes;
    } else {
      // No data file on Drive. Use the local snapshot.
      // If local data exists, it will be uploaded to create the file on Drive.
      // If local data is empty, an empty array might be saved.
      quizzesToUseAsAuthoritative = localQuizzesSnapshot;
    }
    
    // Save the determined authoritative data back to Google Drive.
    // This ensures Drive reflects the state the app will now use,
    // and creates the file if it didn't exist (and local data was provided).
    await saveQuizDataToDrive(accessToken, quizzesToUseAsAuthoritative);

    return {
      success: true,
      quizzes: quizzesToUseAsAuthoritative,
      newSyncTime: now,
    };
  } catch (error: any) {
    console.error("Error during Google Drive sync:", error);
    return {
      success: false,
      quizzes: localQuizzesSnapshot, // Fallback to the passed local snapshot on error
      errorKey: error.message || 'driveErrorGeneric', // error.message from driveService is expected to be a key
    };
  }
};
