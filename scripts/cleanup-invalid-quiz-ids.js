/**
 * Cleanup script for invalid quiz IDs
 * Run this in the browser console to clean up any existing invalid quiz IDs
 */

console.log('🧹 Starting QuizAI cleanup...');

// Function to validate UUID
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Clean up localStorage
async function cleanupLocalStorage() {
  try {
    // Check legacy localStorage
    const quizzesJson = localStorage.getItem('quizzes');
    if (quizzesJson) {
      const quizzes = JSON.parse(quizzesJson);
      const validQuizzes = quizzes.filter(quiz => {
        if (!isValidUUID(quiz.id)) {
          console.log('❌ Removing invalid quiz ID from localStorage:', quiz.id, quiz.title);
          return false;
        }
        return true;
      });
      
      if (validQuizzes.length !== quizzes.length) {
        localStorage.setItem('quizzes', JSON.stringify(validQuizzes));
        console.log(`✅ Cleaned localStorage: ${quizzes.length - validQuizzes.length} invalid quizzes removed`);
      } else {
        console.log('✅ localStorage is clean - no invalid quiz IDs found');
      }
    }

    // Check LocalForage
    if (typeof localforage !== 'undefined') {
      try {
        const lfQuizzes = await localforage.getItem('quizai-lf-quizzes');
        if (lfQuizzes && Array.isArray(lfQuizzes)) {
          const validLfQuizzes = lfQuizzes.filter(quiz => {
            if (!isValidUUID(quiz.id)) {
              console.log('❌ Removing invalid quiz ID from LocalForage:', quiz.id, quiz.title);
              return false;
            }
            return true;
          });
          
          if (validLfQuizzes.length !== lfQuizzes.length) {
            await localforage.setItem('quizai-lf-quizzes', validLfQuizzes);
            console.log(`✅ Cleaned LocalForage: ${lfQuizzes.length - validLfQuizzes.length} invalid quizzes removed`);
          } else {
            console.log('✅ LocalForage is clean - no invalid quiz IDs found');
          }
        }
      } catch (e) {
        console.log('⚠️ Could not access LocalForage:', e.message);
      }
    }
    
    console.log('🎉 Cleanup completed successfully!');
    console.log('💡 Please refresh the page to see the changes.');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

// Run the cleanup
cleanupLocalStorage();
