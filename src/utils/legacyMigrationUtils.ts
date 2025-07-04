import { Quiz } from '../types';
import { generateQuizId } from './uuidUtils';
import { isLegacyQuizId, getQuizValidationStats } from './quizValidationUtils';
import { logger } from '../services/logService';

/**
 * Migrates legacy quiz IDs to proper UUIDs
 * This can be used as a one-time migration for existing users
 */
export function migrateLegacyQuizIds(quizzes: Quiz[]): {
  migratedQuizzes: Quiz[];
  migrationReport: {
    totalQuizzes: number;
    migrated: number;
    alreadyValid: number;
    errors: number;
  };
} {
  const migratedQuizzes: Quiz[] = [];
  const migrationReport = {
    totalQuizzes: quizzes.length,
    migrated: 0,
    alreadyValid: 0,
    errors: 0
  };

  const stats = getQuizValidationStats(quizzes);
  logger.info('Starting legacy quiz ID migration', 'LegacyMigration', stats);

  for (const quiz of quizzes) {
    try {
      if (isLegacyQuizId(quiz.id)) {
        // Generate a new UUID for this quiz
        const newId = generateQuizId();
        const migratedQuiz: Quiz = {
          ...quiz,
          id: newId,
          lastModified: new Date().toISOString() // Update last modified to indicate migration
        };
        
        migratedQuizzes.push(migratedQuiz);
        migrationReport.migrated++;
        
        logger.info('Migrated legacy quiz ID', 'LegacyMigration', {
          oldId: quiz.id,
          newId: newId,
          title: quiz.title
        });
      } else {
        // Quiz already has valid ID, keep as is
        migratedQuizzes.push(quiz);
        migrationReport.alreadyValid++;
      }
    } catch (error) {
      logger.error('Error migrating quiz', 'LegacyMigration', {
        quizId: quiz.id,
        title: quiz.title
      }, error as Error);
      migrationReport.errors++;
      
      // For errored quizzes, try to keep them if they have valid IDs
      if (quiz.id && typeof quiz.id === 'string' && quiz.id.length > 0) {
        migratedQuizzes.push(quiz);
      }
    }
  }

  logger.info('Legacy quiz ID migration completed', 'LegacyMigration', migrationReport);
  return { migratedQuizzes, migrationReport };
}

/**
 * Checks if migration is needed for a collection of quizzes
 */
export function needsLegacyMigration(quizzes: Quiz[]): boolean {
  return quizzes.some(quiz => isLegacyQuizId(quiz.id));
}

/**
 * Browser console utility for manual migration
 * Users can run this in the console to migrate their local data
 */
export function createMigrationScript(): string {
  return `
// QuizAI Legacy Quiz Migration Script
// Run this in your browser console to migrate old quiz IDs

(async function migrateLegacyQuizzes() {
  console.log('🔧 Starting QuizAI legacy quiz migration...');
  
  try {
    // Check localStorage first
    const legacyQuizzes = localStorage.getItem('quizzes');
    if (legacyQuizzes) {
      const quizzes = JSON.parse(legacyQuizzes);
      let needsMigration = false;
      let migratedCount = 0;
      
      const migratedQuizzes = quizzes.map(quiz => {
        if (quiz.id && quiz.id.startsWith('new-quiz-')) {
          needsMigration = true;
          migratedCount++;
          return {
            ...quiz,
            id: crypto.randomUUID ? crypto.randomUUID() : 'temp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            lastModified: new Date().toISOString()
          };
        }
        return quiz;
      });
      
      if (needsMigration) {
        localStorage.setItem('quizzes', JSON.stringify(migratedQuizzes));
        console.log(\`✅ Migrated \${migratedCount} legacy quizzes in localStorage\`);
      } else {
        console.log('✅ No legacy quizzes found in localStorage');
      }
    }
    
    // Check LocalForage if available
    if (typeof localforage !== 'undefined') {
      try {
        const lfQuizzes = await localforage.getItem('quizai-lf-quizzes');
        if (lfQuizzes && Array.isArray(lfQuizzes)) {
          let needsMigration = false;
          let migratedCount = 0;
          
          const migratedQuizzes = lfQuizzes.map(quiz => {
            if (quiz.id && quiz.id.startsWith('new-quiz-')) {
              needsMigration = true;
              migratedCount++;
              return {
                ...quiz,
                id: crypto.randomUUID ? crypto.randomUUID() : 'temp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                lastModified: new Date().toISOString()
              };
            }
            return quiz;
          });
          
          if (needsMigration) {
            await localforage.setItem('quizai-lf-quizzes', migratedQuizzes);
            console.log(\`✅ Migrated \${migratedCount} legacy quizzes in LocalForage\`);
          } else {
            console.log('✅ No legacy quizzes found in LocalForage');
          }
        }
      } catch (e) {
        console.log('⚠️ Could not access LocalForage:', e.message);
      }
    }
    
    console.log('🎉 Legacy quiz migration completed! Please refresh the page.');
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
  }
})();
`;
}
