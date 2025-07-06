import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../App';
import { Card, Button, LoadingSpinner } from '../../components/ui';
import { ShareIcon, HistoryIcon, EditIcon } from '../../constants';
import { supabaseService } from '../../services/supabaseService';
import { quizResultsService } from '../../services/quizResultsService';
import { logger } from '../../services/logService';
import { Quiz } from '../../types';

interface QuizWithStats extends Quiz {
  totalAttempts: number;
  averageScore: number;
  bestScore: number;
  uniqueUsers: number;
  isShared: boolean;
  shareUrl?: string;
}

const MyQuizzesPage: React.FC = () => {
  const { currentUser } = useAppContext();
  const navigate = useNavigate();
  
  const [quizzes, setQuizzes] = useState<QuizWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      navigate('/');
      return;
    }
    loadMyQuizzes();
  }, [currentUser, navigate]);

  const loadMyQuizzes = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      logger.info('Loading user quizzes', 'MyQuizzesPage', { userId: currentUser.id });
      
      // Get user's quizzes
      const userQuizzes = await supabaseService.getUserQuizzes(currentUser.id);
      
      // Get stats for each quiz
      const quizzesWithStats: QuizWithStats[] = await Promise.all(
        userQuizzes.map(async (quiz) => {
          const stats = await quizResultsService.getQuizStats(quiz.id);
          
          // Check if quiz is shared - simplified for now
          return {
            ...quiz,
            totalAttempts: stats.totalAttempts,
            averageScore: stats.averageScore,
            bestScore: stats.bestScore,
            uniqueUsers: stats.uniqueUsers,
            isShared: false, // Temporarily set to false until we implement share checking
            shareUrl: `${window.location.origin}/#/shared/${quiz.id}`
          };
        })
      );
      
      setQuizzes(quizzesWithStats);
      logger.info('User quizzes loaded successfully', 'MyQuizzesPage', { 
        quizCount: quizzesWithStats.length 
      });
    } catch (error) {
      logger.error('Failed to load user quizzes', 'MyQuizzesPage', {}, error as Error);
      setError('Failed to load your quizzes');
    } finally {
      setLoading(false);
    }
  };

  const handleShareQuiz = async (quiz: Quiz) => {
    try {
      const shareResult = await supabaseService.shareQuiz(quiz.id);
      if (shareResult?.shareUrl) {
        // Copy to clipboard
        await navigator.clipboard.writeText(shareResult.shareUrl);
        // Refresh quiz list to update share status
        loadMyQuizzes();
      }
    } catch (error) {
      logger.error('Failed to share quiz', 'MyQuizzesPage', {}, error as Error);
    }
  };

  const handleViewHistory = (quizId: string) => {
    navigate(`/quiz-analytics/${quizId}`);
  };

  if (!currentUser) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <LoadingSpinner size="xl" text="Loading your quizzes..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto p-8 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={loadMyQuizzes}>Try Again</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
          My Quizzes
        </h1>
        <Button
          variant="primary"
          onClick={() => navigate('/create')}
          className="px-6 py-2"
        >
          Create New Quiz
        </Button>
      </div>

      {quizzes.length === 0 ? (
        <Card className="max-w-md mx-auto p-8 text-center">
          <h2 className="text-xl font-semibold mb-4">No Quizzes Yet</h2>
          <p className="text-[var(--color-text-muted)] mb-6">
            You haven't created any quizzes yet. Start by creating your first quiz!
          </p>
          <Button
            variant="primary"
            onClick={() => navigate('/create')}
          >
            Create Your First Quiz
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quizzes.map((quiz) => (
            <Card key={quiz.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2 line-clamp-2">
                  {quiz.title}
                </h3>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {quiz.questions?.length || 0} questions
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Created: {new Date(quiz.createdAt).toLocaleDateString()}
                </p>
              </div>

              {/* Quiz Stats */}
              <div className="mb-4 p-3 bg-[var(--color-bg-surface-2)] rounded-lg">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-[var(--color-text-muted)]">Attempts:</span>
                    <span className="ml-1 font-semibold">{quiz.totalAttempts}</span>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)]">Users:</span>
                    <span className="ml-1 font-semibold">{quiz.uniqueUsers}</span>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)]">Avg Score:</span>
                    <span className="ml-1 font-semibold">{quiz.averageScore}%</span>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)]">Best:</span>
                    <span className="ml-1 font-semibold">{quiz.bestScore}%</span>
                  </div>
                </div>
              </div>

              {/* Share Status */}
              {quiz.isShared && (
                <div className="mb-4 p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                  <p className="text-xs text-green-600 dark:text-green-400 flex items-center">
                    <ShareIcon className="w-3 h-3 mr-1" />
                    Shared publicly
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewHistory(quiz.id)}
                  leftIcon={<HistoryIcon className="w-4 h-4" />}
                  className="flex-1"
                >
                  Analytics
                </Button>
                
                {!quiz.isShared ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleShareQuiz(quiz)}
                    leftIcon={<ShareIcon className="w-4 h-4" />}
                    className="flex-1"
                  >
                    Share
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(quiz.shareUrl || '')}
                    leftIcon={<ShareIcon className="w-4 h-4" />}
                    className="flex-1"
                  >
                    Copy Link
                  </Button>
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/review/${quiz.id}`)}
                  leftIcon={<EditIcon className="w-4 h-4" />}
                >
                  Edit
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyQuizzesPage;
