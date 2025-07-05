import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext, useTranslation } from '../../App';
import { Button, Card, LoadingSpinner } from '../../components/ui'; 
import { SunIcon, MoonIcon } from '../../constants'; 
import MathText from '../../components/MathText';
import { useTheme } from '../../contexts/ThemeContext';
import ApiKeyManager from './components/ApiKeyManager'; 

const SyncSettingsPage: React.FC = () => {
  const { 
    currentUser
  } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme(); 

  if (!currentUser) {
    navigate('/signin', { state: { from: { pathname: '/settings' } } });
    return <LoadingSpinner text={t('loading')} />;
  }

  return (
    <div className="max-w-2xl mx-auto py-8 animate-page-slide-fade-in">
      <Card useGlassEffect className="shadow-2xl !rounded-2xl">
        <div className="text-center mb-10">
           <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-3 tracking-tight">
            <MathText text={t('navSettings')} />
          </h1>
          <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed">
            Manage your application preferences and API settings.
          </p>
        </div>

        <div className="space-y-8">
          {/* Theme Settings */}
          <section>
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4 pb-2 border-b border-[var(--color-border-default)]">
              Theme Settings
            </h2>
            <div className="bg-[var(--color-bg-surface-2)] rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {theme === 'dark' ? (
                    <MoonIcon className="w-5 h-5 text-[var(--color-primary-accent)]" />
                  ) : (
                    <SunIcon className="w-5 h-5 text-[var(--color-primary-accent)]" />
                  )}
                  <div>
                    <h3 className="font-medium text-[var(--color-text-primary)]">
                      {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Switch between light and dark themes
                    </p>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={toggleTheme}
                  className="px-4"
                >
                  {theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
                </Button>
              </div>
            </div>
          </section>

          {/* API Key Settings */}
          <section>
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4 pb-2 border-b border-[var(--color-border-default)]">
              API Settings
            </h2>
            <ApiKeyManager />
          </section>
        </div>

        <div className="flex justify-center mt-10 pt-8 border-t border-[var(--color-border-default)]">
          <Button 
            variant="secondary" 
            onClick={() => navigate('/dashboard')}
            className="px-8"
          >
            Back to Dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default SyncSettingsPage;