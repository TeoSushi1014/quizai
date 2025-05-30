
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAppContext, useTranslation } from '../../App';
import { Card, Button, Input, LoadingSpinner, Textarea } from '../../components/ui';
import { UserAvatar } from '../../components/UserAvatar';
import { UserProfile } from '../../types';
import { logger } from '../../services/logService';
import { TranslationKey } from '../../i18n';

const ProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser, updateUserProfile, isLoading: contextIsLoading } = useAppContext();

  const [name, setName] = useState(currentUser?.name || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setBio(currentUser.bio || '');
    }
  }, [currentUser]);

  if (contextIsLoading && !currentUser) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <LoadingSpinner size="xl" text={t('loading')} />
      </div>
    );
  }
  
  if (!currentUser) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-5">
            <p className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">
                {t('error')}
            </p>
            <p className="text-base text-[var(--color-text-secondary)] mb-8">
                User not found. Please sign in to view your profile.
            </p>
            <Button onClick={() => window.location.hash = '/signin'} variant="primary">
                {t('signIn')}
            </Button>
        </div>
    );
  }


  const handleSave = async () => {
    if (!currentUser) return;
    setIsSaving(true);
    logger.info('Attempting to save profile', 'ProfilePage', { userId: currentUser.id, newName: name, newBioLength: bio.length });
    
    const success = await updateUserProfile({ name, bio });
    
    if (success) {
      setIsEditing(false);
      // Notification is handled by updateUserProfile in AppContext
    } else {
      // Error notification is handled by updateUserProfile in AppContext
      logger.error('Profile update failed in ProfilePage after context call.', 'ProfilePage', { userId: currentUser.id });
    }
    setIsSaving(false);
  };
  
  const handleCancelEdit = () => {
    setName(currentUser.name || '');
    setBio(currentUser.bio || '');
    setIsEditing(false);
  };
  
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
  };

  const userStats = [
    { labelKey: 'profileQuizzes', value: currentUser.quizCount, suffix: '' },
    { labelKey: 'profileCompletions', value: currentUser.completionCount, suffix: '' },
    { labelKey: 'profileAvgScore', value: currentUser.averageScore, suffix: currentUser.averageScore !== null && currentUser.averageScore !== undefined ? '%' : '' },
  ];


  return (
    <motion.div 
      className="container mx-auto py-6 sm:py-8 md:py-10 max-w-4xl"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
    >
      <motion.h1 
        variants={itemVariants}
        className="text-3xl sm:text-4xl font-bold text-[var(--color-text-primary)] mb-8 sm:mb-10 text-center tracking-tight"
      >
        {t('profile')}
      </motion.h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
        <motion.div variants={itemVariants} className="md:col-span-1">
          <Card useGlassEffect className="p-6 sm:p-8 flex flex-col items-center justify-center text-center !rounded-2xl shadow-xl">
            <div className="mb-5">
              <UserAvatar 
                photoUrl={currentUser.imageUrl}
                userName={currentUser.name}
                size="lg"
                className="border-4 border-[var(--color-primary-accent)] shadow-lg"
              />
            </div>
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-1 truncate max-w-full" title={currentUser.name || undefined}>{currentUser.name || t('user')}</h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6 truncate max-w-full" title={currentUser.email || undefined}>{currentUser.email}</p>
            
            <div className="mt-auto w-full">
              <Button 
                variant={isEditing ? "secondary" : "primary"}
                size="md" 
                className="w-full py-2.5 rounded-lg shadow-md" 
                onClick={() => isEditing ? handleCancelEdit() : setIsEditing(true)}
              >
                {isEditing ? t('cancel') : t('edit')}
              </Button>
            </div>
          </Card>
        </motion.div>
        
        <motion.div variants={itemVariants} className="md:col-span-2">
          <Card useGlassEffect className="p-6 sm:p-8 !rounded-2xl shadow-xl">
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-6 border-b border-[var(--color-border-default)] pb-4">{t('profileInformation')}</h2>
            
            {isEditing ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-5"
              >
                <Input
                  label={<span className="text-sm font-medium text-[var(--color-text-secondary)]">{t('profileName')}</span>}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('profileNamePlaceholder')}
                  inputClassName="text-base"
                />
                
                <Textarea
                  label={<span className="text-sm font-medium text-[var(--color-text-secondary)]">{t('profileBio')}</span>}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={t('profileBioPlaceholder')}
                  rows={4}
                  className="min-h-[100px] text-base"
                />
                
                <div className="flex justify-end space-x-3 pt-3">
                  <Button 
                    variant="secondary" 
                    size="md" 
                    onClick={handleCancelEdit}
                    className="py-2.5 px-6 rounded-lg"
                  >
                    {t('cancel')}
                  </Button>
                  <Button 
                    variant="primary" 
                    size="md" 
                    onClick={handleSave}
                    isLoading={isSaving}
                    className="py-2.5 px-6 rounded-lg shadow-lg"
                  >
                    {isSaving ? t('savingButton') : t('save')}
                  </Button>
                </div>
              </motion.div>
            ) : (
              <div className="space-y-5">
                <div className="animate-fadeIn">
                  <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">{t('profileName')}</h3>
                  <p className="text-[var(--color-text-primary)] text-base">{name || '-'}</p>
                </div>
                
                <div className="animate-fadeIn" style={{animationDelay: '0.1s'}}>
                  <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">{t('profileEmail')}</h3>
                  <p className="text-[var(--color-text-primary)] text-base">{currentUser.email || '-'}</p>
                </div>
                
                <div className="animate-fadeIn" style={{animationDelay: '0.2s'}}>
                  <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">{t('profileBio')}</h3>
                  <p className="text-[var(--color-text-primary)] text-base whitespace-pre-line break-words">{bio || <span className="italic text-[var(--color-text-muted)]">{t('profileBioPlaceholder')}</span>}</p>
                </div>
              </div>
            )}
          </Card>
        </motion.div>
        
        <motion.div variants={itemVariants} className="md:col-span-3">
          <Card useGlassEffect className="p-6 sm:p-8 !rounded-2xl shadow-xl">
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-6 border-b border-[var(--color-border-default)] pb-4">{t('profileStats')}</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
              {userStats.map((stat, index) => (
                 <motion.div 
                    key={stat.labelKey}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.1 * index, ease: "easeOut" }}
                    className="bg-[var(--color-bg-surface-2)]/50 p-5 rounded-xl border border-[var(--color-border-default)] text-center shadow-md hover:shadow-lg transition-shadow"
                  >
                  <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">{t(stat.labelKey as TranslationKey)}</h3>
                  <p className="text-3xl font-bold text-[var(--color-primary-accent)]">
                    {stat.value !== undefined && stat.value !== null ? stat.value : '-'}
                    {stat.suffix}
                  </p>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
};
ProfilePage.displayName = "ProfilePage";
export default ProfilePage;
