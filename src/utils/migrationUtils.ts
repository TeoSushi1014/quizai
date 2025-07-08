import { supabaseService } from '../services/supabaseService'
import { quizStorage } from '../services/storageService'
import { UserProfile } from '../types'
import { logger } from '../services/logService'

export const migrateLocalDataToSupabase = async (currentUser: UserProfile): Promise<void> => {
  try {
    const localQuizzes = await quizStorage.getAllQuizzes()
    
    if (localQuizzes.length === 0) {
      return
    }

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
          } else {
            errorCount++
            logger.warn('Failed to migrate quiz (null returned)', 'Migration', { quizId: quiz.id })
          }
        }
      } catch (error) {
        errorCount++
        logger.error('Failed to migrate quiz', 'Migration', { quizId: quiz.id }, error as Error)
      }
    }
    
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
