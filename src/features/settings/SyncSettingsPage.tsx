


import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext, useTranslation } from '../../App';
import { Button, Card, LoadingSpinner, Tooltip, Toggle } from '../../components/ui'; 
import { GoogleDriveIcon, RefreshIcon, CheckCircleIcon, XCircleIcon, InformationCircleIcon, SunIcon, MoonIcon } from '../../constants'; 
import MathText from '../../components/MathText';
import { useTheme } from '../../contexts/ThemeContext'; 

const SyncSettingsPage: React.FC = () => {
  const { 
    currentUser, 
    syncWithGoogleDrive, 
    isDriveLoading, 
    driveSyncError, 
    lastDriveSync,
    setDriveSyncError
  } = useAppContext();
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme(); 

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
    <div className="max-w-2xl mx-auto py-8 animate-page-slide-fade-in">
      <Card useGlassEffect className="shadow-2xl !rounded-2xl">
        <div className="text-center mb-10">
           <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-3 tracking-tight">
            <MathText text={t('navSettings')} />
          </h1>
          <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed">
            Manage your application preferences and data synchronization.
          </p>
        </div>

        <div className="space-y-8">
          {/* Theme Settings Card Removed */}

          {/* Google Drive Sync Card */}
          <Card className="!bg-[var(--color-bg-surface-2)]/80 !border-[var(--color-border-default)] p-5 sm:p-6 rounded-xl shadow-lg">
            <div className="flex items-center mb-1.5">
                 <GoogleDriveIcon className="w-5 h-5 mr-2.5 text-sky-400 flex-shrink-0" />
                 <p className="text-base font-semibold text-[var(--color-text-primary)]">{t('syncSettingsTitle')}</p>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] mb-5 sm:ml-[28px]">
                {t('syncSettingsDescription')}
            </p>
            
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t('syncStatus')}</p>
                {isDriveLoading && !driveSyncError && (
                  <div className="flex items-center text-[var(--color-primary-accent)] animate-pulse">
                    <RefreshIcon className="w-4 h-4 mr-2 animate-spin" />
                    <span className="text-xs font-semibold">{t('syncStatusInProgress')}</span>
                  </div>
                )}
                {!isDriveLoading && driveSyncError && (
                  <div className="flex items-center text-[var(--color-danger-accent)]">
                    <XCircleIcon className="w-4 h-4 mr-2" />
                    <span className="text-xs font-semibold">{t('syncStatusError', { error: driveSyncError })}</span>
                  </div>
                )}
                {!isDriveLoading && !driveSyncError && lastDriveSync && (
                  <div className="flex items-center text-[var(--color-success-accent)]">
                    <CheckCircleIcon className="w-4 h-4 mr-2" />
                    <span className="text-xs font-semibold">{t('syncStatusLast', { dateTime: formattedLastSync })}</span>
                  </div>
                )}
                 {!isDriveLoading && !driveSyncError && !lastDriveSync && (
                  <div className="flex items-center text-[var(--color-text-muted)]">
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
                className="w-full sm:w-auto shadow-lg hover:shadow-[var(--color-primary-accent)]/40 py-2.5 px-6"
              >
                {isDriveLoading ? t('syncStatusInProgress') : t('syncNowButton')}
              </Button>
            </div>
             {driveSyncError && (
                <Button
                    variant="link"
                    size="xs"
                    onClick={() => setDriveSyncError(null)}
                    className="mt-3 !text-[var(--color-primary-accent)] hover:!text-[var(--color-primary-accent-hover)] text-xs"
                >
                    {t('close')}
                </Button>
            )}
            <p className="text-xs text-[var(--color-text-muted)] text-center pt-6 mt-4 border-t border-[var(--color-border-default)]/50">
                Your QuizAI data is securely stored in a file named <code>{`quizai_user_data.json`}</code> in your Google Drive's root folder, accessible only by this application.
            </p>
          </Card>
        </div>
      </Card>
    </div>
  );
};
SyncSettingsPage.displayName = "SyncSettingsPage";

export default SyncSettingsPage;