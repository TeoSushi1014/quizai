// Helper function for debugging quiz sharing in browser console
// Copy and paste this into browser console for testing

window.debugQuizSharing = async function() {
  console.log('🔍 Starting Quiz Sharing Debug...');
  
  // Get current user from app context
  const appContext = window.appContext || window.App?.useAppContext?.();
  if (!appContext?.currentUser) {
    console.error('❌ No current user found. Please login first.');
    return;
  }

  console.log('👤 Current user:', appContext.currentUser);
  
  // First check user permissions
  try {
    console.log('🔐 Checking user share permissions...');
    const { supabaseService } = await import('./src/services/supabaseService.js');
    const permissionCheck = await supabaseService.checkUserSharePermissions(appContext.currentUser.id);
    
    console.log('📋 Permission check result:', permissionCheck);
    
    if (!permissionCheck.canShare) {
      console.error('❌ User cannot share quizzes:', permissionCheck.reason);
      return;
    }
    
    console.log('✅ User has permission to share quizzes');
  } catch (permError) {
    console.error('❌ Error checking permissions:', permError);
  }
  
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
    
    // Additional debugging info
    console.log('🔍 Additional debugging info:');
    console.log('- User ID:', appContext.currentUser.id);
    console.log('- Quiz ID:', testQuiz.id);
    console.log('- Quiz questions count:', testQuiz.questions.length);
  }
};

// Function to check if a specific quiz ID exists
window.debugCheckQuizExists = async function(quizId) {
  if (!quizId) {
    console.error('❌ Please provide a quiz ID');
    return;
  }
  
  try {
    console.log('🔍 Checking if quiz exists:', quizId);
    const { supabaseService } = await import('./src/services/supabaseService.js');
    
    // Try to get quiz via public method
    const publicQuiz = await supabaseService.getPublicQuizById(quizId);
    if (publicQuiz) {
      console.log('✅ Found as public quiz:', publicQuiz);
      return;
    }
    
    console.log('❌ Quiz not found as public quiz');
  } catch (error) {
    console.error('❌ Error checking quiz:', error);
  }
};

// Function to debug user permissions specifically
window.debugUserPermissions = async function() {
  try {
    console.log('🔐 Running user permissions debug...');
    const { supabaseService } = await import('./src/services/supabaseService.js');
    await supabaseService.debugUserPermissions();
  } catch (error) {
    console.error('❌ Error debugging user permissions:', error);
  }
};

// Utility function to list user's quizzes
window.debugListUserQuizzes = async function(userId = null) {
  console.log('📚 Listing user quizzes...');
  
  try {
    const { supabase } = await import('./src/services/supabaseClient.js');
    
    let effectiveUserId = userId;
    if (!effectiveUserId) {
      const appContext = window.appContext || window.App?.useAppContext?.();
      if (appContext?.currentUser) {
        effectiveUserId = appContext.currentUser.id;
      } else {
        // Try getting from Supabase auth
        const { data: { user } } = await supabase.auth.getUser();
        effectiveUserId = user?.id;
      }
    }
    
    if (!effectiveUserId) {
      console.error('❌ No user ID available');
      return [];
    }
    
    console.log('👤 Using User ID:', effectiveUserId);
    
    const { data: quizzes, error } = await supabase
      .from('quizzes')
      .select('id, title, created_at')
      .eq('user_id', effectiveUserId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error fetching quizzes:', error.message);
      return [];
    }
    
    console.log(`✅ Found ${quizzes?.length || 0} quizzes:`);
    quizzes?.forEach((quiz, index) => {
      console.log(`${index + 1}. ${quiz.title} (ID: ${quiz.id})`);
    });
    
    return quizzes || [];
    
  } catch (error) {
    console.error('❌ Failed to list quizzes:', error);
    return [];
  }
};

console.log('🎯 Debug functions loaded!');
console.log('  Run: debugQuizSharing() - Test quiz sharing flow');
console.log('  Run: debugCheckQuizExists("quiz-id") - Check if quiz exists');
console.log('  Run: debugUserPermissions() - Check user authentication and permissions');
console.log('  Run: debugListUserQuizzes() - List all user quizzes');
