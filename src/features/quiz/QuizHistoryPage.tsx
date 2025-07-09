import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../App';
import { Button, Card, LoadingSpinner } from '../../components/ui';
import { quizResultsService, QuizResultRecord } from '../../services/quizResultsService';
import { ChartBarIcon } from '../../constants';
import { logger } from '../../services/logService';

const QuizHistoryPage: React.FC = () => {
  const { currentUser } = useAppContext();
  const navigate = useNavigate();
  
  const [results, setResults] = useState<QuizResultRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      navigate('/');
      return;
    }
    loadUserHistory();
  }, [currentUser, navigate]);

  const loadUserHistory = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      setError(null);

      const userResults = await quizResultsService.getUserQuizHistory(currentUser.id, 50);
      setResults(userResults);
      setLoading(false);

      logger.info('User quiz history loaded', 'QuizHistoryPage', {
        userId: currentUser.id,
        resultCount: userResults.length
      });

    } catch (error) {
      logger.error('Failed to load user quiz history', 'QuizHistoryPage', {}, error as Error);
      setError('Failed to load your quiz history');
      setLoading(false);
    }
  };

  const formatTime = (seconds: number | null): string => {
    if (!seconds) return '--:--';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-[var(--color-success-accent)]';
    if (score >= 60) return 'text-[var(--color-warning-accent)]';
    return 'text-[var(--color-danger-accent)]';
  };

  const getScoreBgColor = (score: number): string => {
    if (score >= 80) return 'bg-[var(--color-success-accent)]/10 border-[var(--color-success-accent)]/30';
    if (score >= 60) return 'bg-[var(--color-warning-accent)]/10 border-[var(--color-warning-accent)]/30';
    return 'bg-[var(--color-danger-accent)]/10 border-[var(--color-danger-accent)]/30';
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
          Your Quiz History
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          View all your quiz attempts and track your progress
        </p>
      </div>

      {loading && (
        <Card className="p-8">
          <div className="flex items-center justify-center">
            <LoadingSpinner />
            <span className="ml-3 text-[var(--color-text-secondary)]">
              Loading your quiz history...
            </span>
          </div>
        </Card>
      )}

      {error && (
        <Card className="p-6">
          <div className="text-center">
            <p className="text-[var(--color-danger-accent)] mb-4">{error}</p>
            <Button onClick={loadUserHistory} variant="outline" size="sm">
              Try Again
            </Button>
          </div>
        </Card>
      )}

      {!loading && !error && results.length === 0 && (
        <Card className="p-8">
          <div className="text-center">
            <ChartBarIcon className="w-16 h-16 mx-auto text-[var(--color-text-muted)] mb-4" />
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
              No Quiz History Yet
            </h3>
            <p className="text-[var(--color-text-secondary)] mb-4">
              You haven't taken any quizzes yet. Start taking quizzes to see your progress here!
            </p>
            <Button onClick={() => navigate('/')} variant="primary">
              Browse Quizzes
            </Button>
          </div>
        </Card>
      )}

      {!loading && !error && results.length > 0 && (
        <div className="space-y-4">
          {/* Stats Overview */}
          <Card className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--color-primary-accent)]">
                  {results.length}
                </div>
                <div className="text-sm text-[var(--color-text-secondary)]">
                  Total Attempts
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--color-success-accent)]">
                  {results.length > 0 ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length) : 0}%
                </div>
                <div className="text-sm text-[var(--color-text-secondary)]">
                  Average Score
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--color-warning-accent)]">
                  {results.length > 0 ? Math.max(...results.map(r => r.score)) : 0}%
                </div>
                <div className="text-sm text-[var(--color-text-secondary)]">
                  Best Score
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--color-primary-accent)]">
                  {new Set(results.map(r => r.quiz_id)).size}
                </div>
                <div className="text-sm text-[var(--color-text-secondary)]">
                  Unique Quizzes
                </div>
              </div>
            </div>
          </Card>

          {/* Results List */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">
              Recent Attempts
            </h2>
            <div className="space-y-3">
              {results.map((result) => (
                <div
                  key={result.id}
                  className={`p-4 rounded-lg border-2 border-[var(--color-border-default)] ${getScoreBgColor(result.score)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-[var(--color-text-primary)] mb-1">
                        {(result as any).quiz_title || 'Unknown Quiz'}
                      </h3>
                      <div className="flex items-center space-x-4 text-sm text-[var(--color-text-secondary)]">
                        <span className={`font-bold ${getScoreColor(result.score)}`}>
                          {result.score}% ({Math.round((result.score / 100) * result.total_questions)}/{result.total_questions})
                        </span>
                        <span>
                          Time: {formatTime(result.time_taken)}
                        </span>
                        <span>
                          {formatDate(result.created_at)}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/quiz/${result.quiz_id}`)}
                    >
                      Take Again
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default QuizHistoryPage;
