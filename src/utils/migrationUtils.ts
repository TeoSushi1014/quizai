import { supabase } from '../services/supabaseClient';
import { logger } from '../services/logService';

/**
 * Run all pending migrations
 */
export async function runMigrations(): Promise<boolean> {
  try {
    // Try to read a record from quiz_progress table to check if it exists
    const { error } = await supabase
      .from('quiz_progress')
      .select('id')
      .limit(1);
    
    // If there's no error, the table exists
    if (!error) {
      logger.info('Quiz progress table already exists', 'migrationUtils');
      return true;
    }

    // If the error is not about missing table, log it and return
    if (!error.message.includes('does not exist')) {
      logger.error('Error checking migration status', 'migrationUtils', {}, error);
      return false;
    }
    
    logger.info('Creating quiz_progress table', 'migrationUtils');
    
    // Create the quiz_progress table
    const { error: createError } = await supabase.rpc('create_quiz_progress_table');
    
    if (createError) {
      logger.error('Failed to create quiz_progress table', 'migrationUtils', {}, createError);
      return false;
    }
    
    logger.info('Successfully created quiz_progress table', 'migrationUtils');
    return true;
  } catch (error) {
    logger.error('Exception running migrations', 'migrationUtils', {}, error as Error);
    return false;
  }
}
