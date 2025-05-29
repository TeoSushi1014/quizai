
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext, useTranslation } from '../../App';
import { Button, Card, LoadingSpinner, Tooltip } from '../../components/ui';
import { GoogleDriveIcon, RefreshIcon, CheckCircleIcon, XCircleIcon, InformationCircleIcon } from '../../constants';
import MathText from '../../components/MathText';

const SyncSettingsPage: React.FC = () => {
  const { 
    currentUser, 
    syncWithGoogleDrive, 
    isDriveLoading, 
    driveSyncError, 
    lastDriveSync,
    setDriveSyncError // Added for clearing specific errors
  } = useAppContext();
  const { t, language } = useTranslation();
  const navigate = useNavigate();

  if (!currentUser) {
    navigate('/signin', { state: { from: { pathname: '/settings' } } });
    return <LoadingSpinner text={t('loading')} />;
  }

  const handleSyncNow = async () => {
    if (window.confirm(t('syncConfirmation'))) {
        await syncWithGoogleDrive();
    }
  };
  
  const formattedLastSync = lastDriveSync 
    ? lastDriveSync.toLocaleString(language, { dateStyle: 'medium', timeStyle: 'short' })
    : t('syncStatusNever');

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card useGlassEffect className="shadow-2xl !rounded-2xl">
        <div className="text-center mb-8">
          <GoogleDriveIcon className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-slate-50 mb-3">
            <MathText text={t('syncSettingsTitle')} />
          </h1>
          <p className="text-slate-300/90 text-sm leading-relaxed">
            <MathText text={t('syncSettingsDescription')} />
          </p>
        </div>

        <div className="space-y-6">
          <Card className="!bg-slate-700/60 !border-slate-600/70 p-5 rounded-xl shadow-lg">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <p className="text-sm font-medium text-slate-200 mb-1">{t('syncStatus')}</p>
                {isDriveLoading && !driveSyncError && (
                  <div className="flex items-center text-sky-300 animate-pulse">
                    <RefreshIcon className="w-4 h-4 mr-2 animate-spin" />
                    <span className="text-xs font-semibold">{t('syncStatusInProgress')}</span>
                  </div>
                )}
                {!isDriveLoading && driveSyncError && (
                  <div className="flex items-center text-red-400">
                    <XCircleIcon className="w-4 h-4 mr-2" />
                    <span className="text-xs font-semibold">{t('syncStatusError', { error: driveSyncError })}</span>
                  </div>
                )}
                {!isDriveLoading && !driveSyncError && lastDriveSync && (
                  <div className="flex items-center text-green-400">
                    <CheckCircleIcon className="w-4 h-4 mr-2" />
                    <span className="text-xs font-semibold">{t('syncStatusLast', { dateTime: formattedLastSync })}</span>
                  </div>
                )}
                 {!isDriveLoading && !driveSyncError && !lastDriveSync && (
                  <div className="flex items-center text-slate-400">
                    <InformationCircleIcon className="w-4 h-4 mr-2" />
                    <span className="text-xs font-semibold">{t('syncStatusNever')}</span>
                  </div>
                )}
              </div>
              <Button 
                onClick={handleSyncNow} 
                isLoading={isDriveLoading} 
                disabled={isDriveLoading}
                variant="primary" 
                size="md" 
                leftIcon={<RefreshIcon className={`w-5 h-5 ${isDriveLoading ? 'animate-spin' : ''}`} />}
                className="w-full sm:w-auto shadow-lg hover:shadow-sky-400/40 py-2.5 px-6"
              >
                {isDriveLoading ? t('syncStatusInProgress') : t('syncNowButton')}
              </Button>
            </div>
             {driveSyncError && (
                <Button
                    variant="link"
                    size="xs"
                    onClick={() => setDriveSyncError(null)}
                    className="mt-3 text-sky-400 hover:text-sky-300 text-xs"
                >
                    {t('close')} {/* Or a more specific "Clear Error" text */}
                </Button>
            )}
          </Card>

          {/* Future: Add toggle for enabling/disabling sync if needed */}
          {/* For now, sync is implicitly enabled when logged in */}
          <p className="text-xs text-slate-400/80 text-center pt-4">
            Your QuizAI data is securely stored in a file named <code>{`quizai_user_data.json`}</code> in your Google Drive's root folder, accessible only by this application.
          </p>
        </div>
      </Card>
    </div>
  );
};
SyncSettingsPage.displayName = "SyncSettingsPage";

export default SyncSettingsPage;
