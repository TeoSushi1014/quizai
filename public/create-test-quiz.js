// Simple script to create a test quiz in localStorage for testing
const testQuiz = {
  id: 'a35130c9-2b62-4327-85f2-f1796c37c47a',
  title: 'Test Quiz for Sharing',
  description: 'This is a test quiz to verify sharing functionality',
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      questionText: 'What is 2 + 2?',
      options: ['3', '4', '5', '6'],
      correctAnswer: 1,
      explanation: 'Basic arithmetic: 2 + 2 = 4'
    },
    {
      id: 'q2',
      type: 'true-false',
      questionText: 'The earth is round.',
      options: ['True', 'False'],
      correctAnswer: 0,
      explanation: 'The Earth is approximately spherical.'
    }
  ],
  timeLimit: 300,
  shuffleQuestions: false,
  shuffleOptions: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  tags: ['test', 'demo'],
  category: 'Test',
  creator: {
    name: 'Test User',
    email: 'test@example.com'
  },
  isShared: true,
  sharedTimestamp: new Date().toISOString()
};

// Store in localStorage
const SHARED_QUIZ_STORAGE_KEY = 'quizai_shared_quizzes_v2';
const existingQuizzes = JSON.parse(localStorage.getItem(SHARED_QUIZ_STORAGE_KEY) || '{}');
existingQuizzes[testQuiz.id] = testQuiz;
localStorage.setItem(SHARED_QUIZ_STORAGE_KEY, JSON.stringify(existingQuizzes));

console.log('Test quiz created and stored in localStorage with ID:', testQuiz.id);
