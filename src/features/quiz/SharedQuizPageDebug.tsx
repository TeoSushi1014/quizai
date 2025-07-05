// Temporary debugging version of SharedQuizPage
// This will help us identify what's causing the blank page

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../../App';
import { Quiz } from '../../types';
import { getSharedQuiz } from '../../services/quizSharingService';
import { logger } from '../../services/logService';
import { validateQuizId } from '../../utils/quizValidationUtils';

const SharedQuizPageDebug: React.FC = () => {
  const { quizId } = useParams<{ quizId?: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAppContext();
  
  const [sharedQuiz, setSharedQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('Component loaded');
  
  useEffect(() => {
    const loadSharedQuiz = async () => {
      try {
        logger.info('SharedQuizPageDebug: Starting to load quiz', 'SharedQuizPageDebug', { quizId });
        setDebugInfo(`Starting to load quiz ID: ${quizId}`);
        
        if (!quizId) {
          setError('No quiz ID provided');
          setDebugInfo('No quiz ID in URL params');
          setLoading(false);
          return;
        }
        
        setDebugInfo(`Quiz ID: ${quizId}, Valid format: ${validateQuizId(quizId)}`);
        
        // Try to get the quiz
        const fetchedQuizData = await getSharedQuiz(quizId, currentUser);
        
        if (fetchedQuizData) {
          logger.info('SharedQuizPageDebug: Quiz found!', 'SharedQuizPageDebug', { quizId });
          setSharedQuiz(fetchedQuizData as Quiz);
          setDebugInfo(`Quiz found: ${fetchedQuizData.title}`);
        } else {
          logger.warn('SharedQuizPageDebug: Quiz not found', 'SharedQuizPageDebug', { quizId });
          // No longer using localStorage, all quizzes are in Supabase now
          setError('Quiz not found');
          setDebugInfo(`Quiz not found in Supabase database.`);
        }
        
      } catch (err) {
        logger.error('SharedQuizPageDebug: Error loading quiz', 'SharedQuizPageDebug', { quizId }, err as Error);
        setError(`Error: ${(err as Error).message}`);
        setDebugInfo(`Error occurred: ${(err as Error).message}`);
      } finally {
        setLoading(false);
      }
    };
    
    loadSharedQuiz();
  }, [quizId, currentUser]);
  
  // Simple loading state
  if (loading) {
    return (
      <div style={{ padding: '50px', textAlign: 'center' }}>
        <h1>Loading Quiz...</h1>
        <p>Debug: {debugInfo}</p>
      </div>
    );
  }
  
  // Simple error state
  if (error || !sharedQuiz) {
    return (
      <div style={{ padding: '50px', textAlign: 'center' }}>
        <h1>Error Loading Quiz</h1>
        <p>Error: {error}</p>
        <p>Debug: {debugInfo}</p>
        <p>Quiz ID: {quizId}</p>
        <button onClick={() => navigate('/')}>Go Home</button>
      </div>
    );
  }
  
  // Simple success state
  return (
    <div style={{ padding: '50px' }}>
      <h1>Quiz Found!</h1>
      <h2>{sharedQuiz.title}</h2>
      <p>Questions: {sharedQuiz.questions?.length || 0}</p>
      <p>Debug: {debugInfo}</p>
      <button onClick={() => navigate('/')}>Go Home</button>
    </div>
  );
};

export default SharedQuizPageDebug;
