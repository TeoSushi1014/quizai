// Helper function for debugging quiz sharing in browser console
// Copy and paste this into browser console for testing

window.debugQuizSharing = async function() {
  console.log('🔍 Starting Quiz Sharing Debug...');
  
  // Create a test quiz
  const testQuiz = {
    id: 'debug-quiz-' + Date.now(),
    title: 'Debug Test Quiz',
    questions: [
      {
        id: 'q1',
        questionText: 'What is 1 + 1?',
        options: ['1', '2', '3', '4'],
        correctAnswer: '2',
        explanation: 'Basic math: 1 + 1 = 2'
      }
    ],
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    config: {
      difficulty: 'Easy',
      language: 'English', 
      numQuestions: 1,
      selectedModel: 'gemini'
    }
  };

  // Get current user from app context
  const appContext = window.appContext || window.App?.useAppContext?.();
  if (!appContext?.currentUser) {
    console.error('❌ No current user found. Please login first.');
    return;
  }

  console.log('👤 Current user:', appContext.currentUser);
  console.log('📝 Test quiz:', testQuiz);

  try {
    // Import sharing service
    const { shareQuizViaAPI } = await import('./src/services/quizSharingService.js');
    
    console.log('🚀 Attempting to share quiz...');
    const result = await shareQuizViaAPI(testQuiz, appContext.currentUser);
    
    console.log('✅ Quiz shared successfully!');
    console.log('🔗 Share URL:', result.shareUrl);
    console.log('🎭 Is Demo:', result.isDemo);
    
    // Try to access the shared quiz
    console.log('🔍 Testing shared quiz access...');
    window.open(result.shareUrl, '_blank');
    
  } catch (error) {
    console.error('❌ Error sharing quiz:', error);
    console.error('Stack:', error.stack);
  }
};

console.log('🎯 Debug function loaded! Run: debugQuizSharing()');
