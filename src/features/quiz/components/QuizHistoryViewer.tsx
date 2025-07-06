import React, { useState, useEffect } from 'react';
import { Button, Card, LoadingSpinner, Modal } from '../../../components/ui';
import { useTranslation } from '../../../App';
import { quizResultsService, QuizResultRecord } from '../../../services/quizResultsService';
import { UserCircleIcon, CheckCircleIcon, XCircleIcon } from '../../../constants';
import { logger } from '../../../services/logService';

interface QuizHistoryViewerProps {
  quizId: string;
  quizTitle: string;
  isOwner: boolean; // Người tạo quiz có thể xem tất cả kết quả, người khác chỉ xem kết quả của mình
  currentUserId?: string;
}

interface QuizHistoryViewerState {
  results: QuizResultRecord[];
  stats: {
    totalAttempts: number;
    averageScore: number;
    bestScore: number;
    averageTime: number;
    uniqueUsers: number;
  };
  loading: boolean;
  error: string | null;
  selectedResult: QuizResultRecord | null;
  showResultModal: boolean;
}

export const QuizHistoryViewer: React.FC<QuizHistoryViewerProps> = ({
  quizId,
  quizTitle,
  isOwner,
  currentUserId
}) => {
  const { t } = useTranslation();
  const [state, setState] = useState<QuizHistoryViewerState>({
    results: [],
    stats: {
      totalAttempts: 0,
      averageScore: 0,
      bestScore: 0,
      averageTime: 0,
      uniqueUsers: 0
    },
    loading: true,
    error: null,
    selectedResult: null,
    showResultModal: false
  });

  useEffect(() => {
    loadQuizHistory();
  }, [quizId, isOwner, currentUserId]);

  const loadQuizHistory = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const [results, stats] = await Promise.all([
        quizResultsService.getQuizHistory({
          quizId,
          userId: isOwner ? undefined : currentUserId, // Owner xem tất cả, user xem của mình
          limit: 50
        }),
        isOwner ? quizResultsService.getQuizStats(quizId) : Promise.resolve({
          totalAttempts: 0,
          averageScore: 0,
          bestScore: 0,
          averageTime: 0,
          uniqueUsers: 0
        })
      ]);

      setState(prev => ({
        ...prev,
        results,
        stats,
        loading: false
      }));

      logger.info('Quiz history loaded successfully', 'QuizHistoryViewer', {
        quizId,
        resultCount: results.length,
        isOwner
      });

    } catch (error) {
      logger.error('Failed to load quiz history', 'QuizHistoryViewer', {}, error as Error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load quiz history'
      }));
    }
  };

  const handleViewResult = (result: QuizResultRecord) => {
    setState(prev => ({
      ...prev,
      selectedResult: result,
      showResultModal: true
    }));
  };

  const formatTime = (seconds: number | null): string => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('vi-VN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (state.loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner />
          <span className="ml-3 text-[var(--color-text-secondary)]">
            {t('loadingHistory', 'Loading quiz history...')}
          </span>
        </div>
      </Card>
    );
  }

  if (state.error) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <p className="text-[var(--color-danger-accent)] mb-4">{state.error}</p>
          <Button onClick={loadQuizHistory} variant="outline" size="sm">
            {t('retry', 'Retry')}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview - chỉ hiện cho owner */}
      {isOwner && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            {t('quizStatistics', 'Quiz Statistics')}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--color-primary-accent)]">
                {state.stats.totalAttempts}
              </div>
              <div className="text-sm text-[var(--color-text-secondary)]">
                {t('totalAttempts', 'Total Attempts')}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--color-success-accent)]">
                {state.stats.averageScore}%
              </div>
              <div className="text-sm text-[var(--color-text-secondary)]">
                {t('averageScore', 'Average Score')}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--color-warning-accent)]">
                {state.stats.bestScore}%
              </div>
              <div className="text-sm text-[var(--color-text-secondary)]">
                {t('bestScore', 'Best Score')}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--color-primary-accent)]">
                {formatTime(state.stats.averageTime)}
              </div>
              <div className="text-sm text-[var(--color-text-secondary)]">
                {t('averageTime', 'Average Time')}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--color-secondary-accent)]">
                {state.stats.uniqueUsers}
              </div>
              <div className="text-sm text-[var(--color-text-secondary)]">
                {t('uniqueUsers', 'Unique Users')}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Results List */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
            {isOwner 
              ? t('allResults', 'All Results') 
              : t('yourResults', 'Your Results')
            } ({state.results.length})
          </h3>
        </div>

        {state.results.length === 0 ? (
          <div className="text-center py-8">
            <TrophyIcon className="w-16 h-16 mx-auto text-[var(--color-text-muted)] mb-4" />
            <p className="text-[var(--color-text-secondary)]">
              {isOwner 
                ? t('noAttemptsYet', 'No attempts yet')
                : t('youHaventTakenThisQuiz', "You haven't taken this quiz yet")
              }
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {state.results.map((result) => (
              <div
                key={result.id}
                className="flex items-center justify-between p-4 bg-[var(--color-bg-surface-2)] rounded-lg hover:bg-[var(--color-bg-surface-3)] transition-colors"
              >
                <div className="flex items-center space-x-4">
                  {isOwner && (
                    <div className="flex items-center space-x-2">
                      <UserCircleIcon className="w-6 h-6 text-[var(--color-text-secondary)]" />
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">
                        {result.user_name}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-2">
                    <TrophyIcon className="w-5 h-5 text-[var(--color-success-accent)]" />
                    <span className="font-semibold text-[var(--color-text-primary)]">
                      {result.score}%
                    </span>
                    <span className="text-sm text-[var(--color-text-secondary)]">
                      ({Math.round((result.score / 100) * result.total_questions)}/{result.total_questions})
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <ClockIcon className="w-5 h-5 text-[var(--color-text-secondary)]" />
                    <span className="text-sm text-[var(--color-text-secondary)]">
                      {formatTime(result.time_taken)}
                    </span>
                  </div>

                  <span className="text-sm text-[var(--color-text-muted)]">
                    {formatDate(result.created_at)}
                  </span>
                </div>

                <Button
                  onClick={() => handleViewResult(result)}
                  variant="ghost"
                  size="sm"
                  leftIcon={<EyeIcon className="w-4 h-4" />}
                >
                  {t('viewAnswers', 'View Answers')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Result Detail Modal */}
      {state.showResultModal && state.selectedResult && (
        <Modal
          isOpen={state.showResultModal}
          onClose={() => setState(prev => ({ ...prev, showResultModal: false, selectedResult: null }))}
          title={`${t('quizResult', 'Quiz Result')} - ${state.selectedResult.user_name}`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-[var(--color-bg-surface-2)] rounded-lg">
              <div>
                <h4 className="font-semibold text-[var(--color-text-primary)]">
                  {t('finalScore', 'Final Score')}: {state.selectedResult.score}%
                </h4>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {Math.round((state.selectedResult.score / 100) * state.selectedResult.total_questions)} out of {state.selectedResult.total_questions} correct
                </p>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {t('completedOn', 'Completed on')}: {formatDate(state.selectedResult.created_at)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {t('timeTaken', 'Time Taken')}
                </p>
                <p className="font-semibold text-[var(--color-text-primary)]">
                  {formatTime(state.selectedResult.time_taken)}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h5 className="font-medium text-[var(--color-text-primary)]">
                {t('detailedAnswers', 'Detailed Answers')}
              </h5>
              {state.selectedResult.answers.map((answer, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border-2 ${
                    answer.isCorrect
                      ? 'border-[var(--color-success-accent)] bg-[var(--color-success-accent)]/5'
                      : 'border-[var(--color-danger-accent)] bg-[var(--color-danger-accent)]/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      {t('question', 'Question')} {index + 1}
                    </span>
                    <span
                      className={`text-sm font-semibold ${
                        answer.isCorrect
                          ? 'text-[var(--color-success-accent)]'
                          : 'text-[var(--color-danger-accent)]'
                      }`}
                    >
                      {answer.isCorrect ? t('correct', 'Correct') : t('incorrect', 'Incorrect')}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                    {t('yourAnswer', 'Your answer')}: <span className="font-medium">{answer.userAnswer}</span>
                  </p>
                  {!answer.isCorrect && (
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {t('correctAnswer', 'Correct answer')}: <span className="font-medium text-[var(--color-success-accent)]">{answer.correctAnswer}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default QuizHistoryViewer;
