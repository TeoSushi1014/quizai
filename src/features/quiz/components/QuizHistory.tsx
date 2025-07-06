import React, { useState, useEffect } from 'react';
import { Button, Card, LoadingSpinner } from '../../../components/ui';
import { useTranslation } from '../../../App';
import { quizResultsService, QuizResultRecord } from '../../../services/quizResultsService';
import { UserCircleIcon } from '../../../constants';
import { logger } from '../../../services/logService';

interface QuizHistoryProps {
  quizId: string;
  isOwner: boolean;
  currentUserId?: string;
}

export const QuizHistory: React.FC<QuizHistoryProps> = ({
  quizId,
  isOwner,
  currentUserId
}) => {
  const { t } = useTranslation();
  const [results, setResults] = useState<QuizResultRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadQuizHistory();
  }, [quizId, isOwner, currentUserId]);

  const loadQuizHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const historyResults = await quizResultsService.getQuizHistory({
        quizId,
        userId: isOwner ? undefined : currentUserId,
        limit: 20
      });

      setResults(historyResults);
      setLoading(false);

      logger.info('Quiz history loaded', 'QuizHistory', {
        quizId,
        resultCount: historyResults.length,
        isOwner
      });

    } catch (error) {
      logger.error('Failed to load quiz history', 'QuizHistory', {}, error as Error);
      setError('Failed to load history');
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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-center py-4">
          <LoadingSpinner />
          <span className="ml-2 text-sm text-[var(--color-text-secondary)]">
            Loading history...
          </span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-4">
        <div className="text-center py-4">
          <p className="text-sm text-[var(--color-danger-accent)] mb-2">{error}</p>
          <Button onClick={loadQuizHistory} variant="outline" size="sm">
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  if (results.length === 0) {
    return (
      <Card className="p-4">
        <div className="text-center py-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {isOwner ? 'No attempts yet' : "You haven't taken this quiz yet"}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
          {isOwner ? 'Recent Results' : 'Your Results'} ({results.length})
        </h3>
      </div>

      <div className="space-y-2">
        {results.map((result) => (
          <div
            key={result.id}
            className="flex items-center justify-between p-3 bg-[var(--color-bg-surface-2)] rounded-lg"
          >
            <div className="flex items-center space-x-3">
              {isOwner && (
                <div className="flex items-center space-x-1">
                  <UserCircleIcon className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    {result.user_name}
                  </span>
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                <span 
                  className={`font-semibold ${
                    result.score >= 80 
                      ? 'text-[var(--color-success-accent)]' 
                      : result.score >= 60 
                        ? 'text-[var(--color-warning-accent)]'
                        : 'text-[var(--color-danger-accent)]'
                  }`}
                >
                  {result.score}%
                </span>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  ({Math.round((result.score / 100) * result.total_questions)}/{result.total_questions})
                </span>
              </div>

              <span className="text-xs text-[var(--color-text-muted)]">
                {formatTime(result.time_taken)}
              </span>

              <span className="text-xs text-[var(--color-text-muted)]">
                {formatDate(result.created_at)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {results.length >= 20 && (
        <div className="mt-3 text-center">
          <Button variant="ghost" size="sm" onClick={loadQuizHistory}>
            Load More
          </Button>
        </div>
      )}
    </Card>
  );
};

export default QuizHistory;
