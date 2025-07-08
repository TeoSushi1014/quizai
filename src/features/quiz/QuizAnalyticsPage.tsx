import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../../App';
import { Card, Button, LoadingSpinner } from '../../components/ui';
import { ChevronLeftIcon } from '../../constants';
import { quizResultsService, QuizResultRecord } from '../../services/quizResultsService';
import { supabaseService } from '../../services/supabaseService';
import { logger } from '../../services/logService';
import { Quiz, UserProfile } from '../../types';
import { UserAvatar } from '../../components/UserAvatar';

const QuizAnalyticsPage: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const { currentUser } = useAppContext();
  const navigate = useNavigate();
  
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [results, setResults] = useState<QuizResultRecord[]>([]);
  const [stats, setStats] = useState({
    totalAttempts: 0,
    averageScore: 0,
    bestScore: 0,
    averageTime: 0,
    uniqueUsers: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser || !quizId) {
      navigate('/');
      return;
    }
    loadQuizAnalytics();
  }, [currentUser, quizId, navigate]);

  const loadQuizAnalytics = async () => {
    if (!quizId || !currentUser) return;
    
    try {
      setLoading(true);
      logger.info('Loading quiz analytics', 'QuizAnalyticsPage', { quizId });
      
      // Load quiz details - get quiz by ID (works for both owned and shared quizzes)
      const quizData = await supabaseService.getQuizById(quizId);
      
      if (!quizData) {
        setError('Quiz not found or you do not have permission to view it');
        return;
      }
      
      setQuiz(quizData);
      
      // Load quiz statistics
      const quizStats = await quizResultsService.getQuizStats(quizId);
      setStats(quizStats);
      
      // Load detailed results
      // If this is the user's own quiz, show all attempts from everyone
      // If this is someone else's quiz, show only current user's attempts
      const isOwner = quizData.userId === currentUser.id;
      
      logger.info('Loading quiz history with ownership check', 'QuizAnalyticsPage', {
        quizId,
        isOwner,
        quizOwnerId: quizData.userId,
        currentUserId: currentUser.id,
        userIdFilter: isOwner ? undefined : currentUser.id
      });
      
      const quizHistory = await quizResultsService.getQuizHistory({ 
        quizId,
        userId: isOwner ? undefined : currentUser.id, // Show all if owner, only self if not owner
        limit: 50 
      });
      
      logger.info('Quiz history results', 'QuizAnalyticsPage', {
        quizId,
        resultsCount: quizHistory.length,
        results: quizHistory.map(r => ({
          id: r.id,
          userId: r.user_id,
          userName: r.user_name,
          score: r.score
        }))
      });
      
      setResults(quizHistory);
      
      logger.info('Quiz analytics loaded successfully', 'QuizAnalyticsPage', {
        quizId,
        resultsCount: quizHistory.length
      });
    } catch (error) {
      logger.error('Failed to load quiz analytics', 'QuizAnalyticsPage', {}, error as Error);
      setError('Failed to load quiz analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number | null): string => {
    if (typeof seconds !== 'number' || seconds < 0) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (!currentUser || !quizId) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <LoadingSpinner size="xl" text="Loading analytics..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto p-8 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="outline"
          onClick={() => navigate('/dashboard')}
          leftIcon={<ChevronLeftIcon className="w-4 h-4" />}
          className="mb-4"
        >
          Back to Dashboard
        </Button>
        
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
          Quiz Analytics
        </h1>
        {quiz && (
          <div>
            <h2 className="text-xl text-[var(--color-text-secondary)] mb-2">
              {quiz.title}
            </h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              {quiz.userId === currentUser?.id ? 
                'Showing all attempts from everyone who took this quiz' : 
                'Showing your attempts only'
              }
            </p>
          </div>
        )}
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-[var(--color-primary-accent)]">
            {stats.totalAttempts}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">
            Total Attempts
          </div>
        </Card>
        
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-[var(--color-primary-accent)]">
            {stats.uniqueUsers}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">
            Unique Users
          </div>
        </Card>
        
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-[var(--color-primary-accent)]">
            {stats.averageScore}%
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">
            Average Score
          </div>
        </Card>
        
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-[var(--color-primary-accent)]">
            {stats.bestScore}%
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">
            Best Score
          </div>
        </Card>
        
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-[var(--color-primary-accent)]">
            {formatTime(stats.averageTime)}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">
            Avg Time
          </div>
        </Card>
      </div>

      {/* Detailed Results */}
      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-6">Detailed Results</h3>
        
        {results.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[var(--color-text-muted)]">
              No attempts yet. Share your quiz to get started!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border-default)]">
                  <th className="text-left py-3 px-2">User</th>
                  <th className="text-left py-3 px-2">Score</th>
                  <th className="text-left py-3 px-2">Time Taken</th>
                  <th className="text-left py-3 px-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr
                    key={result.id}
                    className="border-b border-[var(--color-border-default)] hover:bg-[var(--color-bg-surface-2)]"
                  >
                    <td className="py-3 px-2">
                      <div className="flex items-center space-x-3">
                        <UserAvatar 
                          user={{
                            id: result.user_id,
                            name: result.user_name,
                            email: result.user_email,
                            imageUrl: result.user_image_url || null
                          } as UserProfile}
                          size="sm"
                        />
                        <div>
                          <div className="font-medium">
                            {result.user_name || 'Anonymous User'}
                          </div>
                          {result.user_email && (
                            <div className="text-sm text-[var(--color-text-muted)]">
                              {result.user_email}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`font-semibold ${getScoreColor(result.score)}`}>
                        {result.score}%
                      </span>
                      <div className="text-sm text-[var(--color-text-muted)]">
                        {Math.round((result.score / 100) * result.total_questions)}/{result.total_questions}
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      {formatTime(result.time_taken)}
                    </td>
                    <td className="py-3 px-2">
                      <div className="text-sm">
                        {new Date(result.created_at).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        {new Date(result.created_at).toLocaleTimeString()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default QuizAnalyticsPage;