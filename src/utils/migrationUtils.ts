import { supabaseService } from '../services/supabaseService'
import { quizStorage } from '../services/storageService'
import { UserProfile } from '../types'
import { logger } from '../services/logService'

export const migrateLocalDataToSupabase = async (currentUser: UserProfile): Promise<void> => {
  try {
    logger.info('Starting migration from localStorage to Supabase', 'Migration', { userId: currentUser.id })
    
    const localQuizzes = await quizStorage.getAllQuizzes()
    
    if (localQuizzes.length === 0) {
      logger.info('No local quizzes to migrate', 'Migration')
      return
    }

    logger.info('Found local quizzes, starting migration', 'Migration', { count: localQuizzes.length })
    
    let migratedCount = 0
    let errorCount = 0
    
    for (const quiz of localQuizzes) {
      try {
        if (!quiz.userId || quiz.userId === currentUser.id) {
          const migratedQuiz = await supabaseService.createQuiz({
            ...quiz,
            userId: currentUser.id
          }, currentUser.id)
          
          if (migratedQuiz) {
            migratedCount++
            logger.info('Quiz migrated successfully', 'Migration', { quizId: quiz.id })
          } else {
            errorCount++
            logger.warn('Failed to migrate quiz (null returned)', 'Migration', { quizId: quiz.id })
          }
        } else {
          logger.info('Skipping quiz belonging to different user', 'Migration', { quizId: quiz.id, quizUserId: quiz.userId })
        }
      } catch (error) {
        errorCount++
        logger.error('Failed to migrate quiz', 'Migration', { quizId: quiz.id }, error as Error)
      }
    }

    logger.info('Migration completed', 'Migration', { 
      total: localQuizzes.length, 
      migrated: migratedCount, 
      errors: errorCount 
    })
    
  } catch (error) {
    logger.error('Migration failed', 'Migration', {}, error as Error)
    throw error
  }
}

export const checkMigrationNeeded = async (currentUser: UserProfile): Promise<boolean> => {
  try {
    const supabaseQuizzes = await supabaseService.getUserQuizzes(currentUser.id)
    
    const localQuizzes = await quizStorage.getAllQuizzes()
    const userLocalQuizzes = localQuizzes.filter(q => !q.userId || q.userId === currentUser.id)
    
    const migrationNeeded = userLocalQuizzes.length > 0 && supabaseQuizzes.length === 0
    
    logger.info('Migration check completed', 'Migration', {
      localQuizzes: userLocalQuizzes.length,
      supabaseQuizzes: supabaseQuizzes.length,
      migrationNeeded
    })
    
    return migrationNeeded
  } catch (error) {
    logger.error('Migration check failed', 'Migration', {}, error as Error)
    return false
  }
}
