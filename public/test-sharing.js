// Simple test to create and share a quiz programmatically
// Run this in browser console after loading the app

window.testQuizSharing = async function() {
  console.log('🧪 Testing Quiz Creation and Sharing...');
  
  // Mock current user (replace with real data from app)
  const mockUser = {
    id: 'test-user-' + Date.now(),
    name: 'Test User',
    email: 'test@example.com'
  };
  
  // Create test quiz
  const testQuiz = {
    id: 'test-quiz-' + Date.now(),
    title: 'Simple Test Quiz',
    questions: [
      {
        id: 'q1',
        questionText: 'What is the capital of Vietnam?',
        options: ['Hanoi', 'Ho Chi Minh City', 'Da Nang', 'Hue'],
        correctAnswer: 'Hanoi',
        explanation: 'Hanoi is the capital city of Vietnam.'
      }
    ],
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    config: {
      difficulty: 'Easy',
      language: 'English',
      numQuestions: 1,
      selectedModel: 'gemini'
    },
    sourceContentSnippet: 'Test geography question'
  };

  console.log('📝 Test Quiz:', testQuiz);
  console.log('👤 Mock User:', mockUser);

  try {
    // Import services
    const { shareQuizViaAPI } = await import('./src/services/quizSharingService.js');
    
    console.log('🚀 Attempting to share quiz...');
    const shareResult = await shareQuizViaAPI(testQuiz, mockUser);
    
    console.log('✅ Success! Share result:', shareResult);
    
    // Test access to shared quiz
    console.log('🔍 Testing shared quiz access...');
    const { getSharedQuiz } = await import('./src/services/quizSharingService.js');
    const retrievedQuiz = await getSharedQuiz(testQuiz.id, mockUser);
    
    if (retrievedQuiz) {
      console.log('✅ Successfully retrieved shared quiz:', retrievedQuiz);
    } else {
      console.log('❌ Failed to retrieve shared quiz');
    }
    
  } catch (error) {
    console.error('❌ Error in test:', error);
    console.error('Stack trace:', error.stack);
  }
};

console.log('🎯 Test function loaded. Run: testQuizSharing()');
