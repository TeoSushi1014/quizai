
import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Input, LoadingSpinner } from '../../../components/ui';
import { useAppContext, useTranslation } from '../../../App';
import { CopyIcon, CheckCircleIcon, FacebookIcon, XIcon, LinkedInIcon, ShareIcon } from '../../../constants'; 
import { shareQuizViaAPI } from '../../../services/quizSharingService';
import { Quiz } from '../../../types';
import { logger } from '../../../services/logService';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  quiz: Quiz;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, quiz }) => {
  const { t } = useTranslation();
  const { currentUser } = useAppContext();
  const [shareUrl, setShareUrl] = useState<string>('');
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [isLinkCopied, setIsLinkCopied] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const isShareRequestInProgress = useRef(false); // Prevent duplicate requests
  
  useEffect(() => {
    let mounted = true;
    const loadShareUrl = async () => {
      // Prevent duplicate requests
      if (isShareRequestInProgress.current) return;
      
      if (isOpen && quiz && !shareUrl && !isLoadingUrl && !urlError) { 
        isShareRequestInProgress.current = true;
        setIsLoadingUrl(true);
        setIsLinkCopied(false); 
        setUrlError(null);
        try {
          const result = await shareQuizViaAPI(quiz, currentUser);
          if (mounted) {
            setShareUrl(result.shareUrl);
          }
        } catch (error) {
          logger.error('Error generating share URL in Modal:', 'ShareModal', { quizId: quiz.id }, error as Error);
          if (mounted) {
            setUrlError(t('dashboardShareLinkFailed')); 
            setShareUrl(''); 
          }
        } finally {
          if (mounted) {
            setIsLoadingUrl(false);
          }
          isShareRequestInProgress.current = false;
        }
      } else if (!isOpen) {
        // Reset state when modal is closed
        setShareUrl('');
        setIsLoadingUrl(false);
        setIsLinkCopied(false);
        setUrlError(null);
        isShareRequestInProgress.current = false;
      }
    };
    
    loadShareUrl();
    return () => { 
      mounted = false; 
      isShareRequestInProgress.current = false;
    };
  }, [isOpen, quiz?.id, currentUser?.id, t]); // Fixed: removed shareUrl, isLoadingUrl, urlError from dependencies
  
  const handleCopyLink = async () => {
    if (!shareUrl || isLoadingUrl || urlError) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsLinkCopied(true);
      setTimeout(() => setIsLinkCopied(false), 2500);
    } catch (error) {
      logger.error('Failed to copy link:', 'ShareModal', undefined, error as Error);
    }
  };
  
  const handleSocialShare = (platform: 'facebook' | 'twitter' | 'linkedin') => {
    if (!shareUrl || isLoadingUrl || urlError) return;
    
    let socialLink = '';
    const quizTitle = encodeURIComponent(quiz.title);
    const encodedShareUrl = encodeURIComponent(shareUrl);
    
    switch (platform) {
      case 'facebook':
        socialLink = `https://www.facebook.com/sharer/sharer.php?u=${encodedShareUrl}&quote=${quizTitle}`;
        break;
      case 'twitter': 
        socialLink = `https://twitter.com/intent/tweet?url=${encodedShareUrl}&text=${quizTitle}`;
        break;
      case 'linkedin':
        socialLink = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedShareUrl}`;
        break;
    }
    
    window.open(socialLink, '_blank', 'noopener,noreferrer');
  };
  
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center">
          <ShareIcon className="w-5 h-5 mr-2.5 text-[var(--color-primary-accent)]" />
          {t('shareQuizTitle')}
        </div>
      }
      size="md"
      useSolidBackground={true}
    >
      <div className="space-y-6 py-2">
        <div>
          <p className="text-sm text-[var(--color-text-secondary)] mb-2">
            {t('shareQuizDescription')}
          </p>
          
          <div className="flex items-center gap-2.5">
            <Input
              value={isLoadingUrl ? '' : (urlError || shareUrl)} 
              readOnly
              disabled={isLoadingUrl || !!urlError}
              placeholder={isLoadingUrl ? t('generatingShareLink') : (urlError ? t('dashboardShareLinkFailed') : t('shareUrlPlaceholder'))}
              className="flex-grow !py-2.5"
              inputClassName={`text-sm ${urlError ? 'text-[var(--color-danger-accent)]' : ''}`}
              error={urlError ? urlError : undefined} 
            />
            <Button
              variant="outline"
              onClick={handleCopyLink}
              disabled={isLoadingUrl || !shareUrl || !!urlError}
              leftIcon={isLinkCopied ? <CheckCircleIcon className="w-4 h-4 text-[var(--color-success-accent)]" /> : <CopyIcon className="w-4 h-4" />}
              className={`!py-2.5 px-4 rounded-lg ${isLinkCopied ? "!border-[var(--color-success-accent)] !text-[var(--color-success-accent)]" : "!border-[var(--color-border-interactive)] hover:!border-[var(--color-primary-accent)]"}`}
              tooltip={isLinkCopied ? t('copied') : t('copy')}
            >
              {isLinkCopied ? t('copied') : t('copy')}
            </Button>
          </div>
           {isLoadingUrl && <LoadingSpinner size="xs" text={t('generatingShareLink')} className="!py-2 !items-start !text-left !pl-1" textClassName="!text-xs" />}
        </div>
        
        <div>
          <p className="text-sm text-[var(--color-text-secondary)] mb-3">
            {t('shareOnSocial')}
          </p>
          
          <div className="grid grid-cols-3 gap-3">
            <Button
              variant="outline"
              onClick={() => handleSocialShare('facebook')}
              disabled={isLoadingUrl || !shareUrl || !!urlError}
              className="w-full !p-2.5 rounded-lg bg-[#1877F2]/10 text-[#1877F2] border-[#1877F2]/30 hover:bg-[#1877F2]/20 hover:border-[#1877F2]/50 flex items-center justify-center"
              aria-label="Share on Facebook"
            >
              <FacebookIcon className="w-5 h-5" />
            </Button>
            
            <Button
              variant="outline"
              onClick={() => handleSocialShare('twitter')}
              disabled={isLoadingUrl || !shareUrl || !!urlError}
              className="w-full !p-2.5 rounded-lg bg-[#000000]/10 text-[#000000] border-[#000000]/30 hover:bg-[#000000]/20 hover:border-[#000000]/50 dark:bg-white/10 dark:text-white dark:border-white/30 dark:hover:bg-white/20 dark:hover:border-white/50 flex items-center justify-center"
              aria-label="Share on X"
            >
              <XIcon className="w-5 h-5" />
            </Button>
            
            <Button
              variant="outline"
              onClick={() => handleSocialShare('linkedin')}
              disabled={isLoadingUrl || !shareUrl || !!urlError}
              className="w-full !p-2.5 rounded-lg bg-[#0077b5]/10 text-[#0077b5] border-[#0077b5]/30 hover:bg-[#0077b5]/20 hover:border-[#0077b5]/50 flex items-center justify-center"
              aria-label="Share on LinkedIn"
            >
              <LinkedInIcon className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
      
      <div className="flex justify-end mt-8 border-t border-[var(--color-modal-border)] pt-5">
        <Button variant="secondary" onClick={onClose} size="md" className="py-2.5 px-6 rounded-lg">{t('close')}</Button>
      </div>
    </Modal>
  );
};
ShareModal.displayName = "ShareModal";
export default ShareModal;
