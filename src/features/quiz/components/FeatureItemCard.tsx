
import React, { useRef } from 'react';
import { Card } from '../../../components/ui';
import { useTranslation } from '../../../App';
import useIntersectionObserver from '../../../hooks/useIntersectionObserver';
import { translations } from '../../../i18n';

export interface FeatureItem {
  icon: React.ReactNode;
  titleKey: keyof typeof translations.en;
  descriptionKey: keyof typeof translations.en;
}

interface FeatureItemCardProps {
  item: FeatureItem;
  staggerDelay?: string; 
}

const FeatureItemCard: React.FC<FeatureItemCardProps> = ({ item, staggerDelay = '0s' }) => {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);
  const isVisible = useIntersectionObserver(cardRef, { threshold: 0.1 });

  return (
    <div 
      ref={cardRef} 
      className={`h-full ${isVisible ? 'animate-fadeInUp' : 'opacity-0'}`}
      style={{ animationDelay: isVisible ? staggerDelay : undefined }}
    >
      <Card 
        useGlassEffect 
        className="text-center !p-6 sm:!p-8 !rounded-2xl h-full card-float-hover"
      >
        <div 
          className={`mb-5 sm:mb-6 inline-block p-3.5 bg-sky-400/20 rounded-full text-sky-300 ${isVisible ? 'animate-scaleIn' : 'opacity-0'}`}
          style={{ animationDelay: isVisible ? `calc(${staggerDelay} + 50ms)` : undefined }}
        >
          {item.icon}
        </div>
        <h3 
          className={`text-lg sm:text-xl font-semibold text-slate-50 mb-3 ${isVisible ? 'animate-fadeInUp' : 'opacity-0'}`}
          style={{ animationDelay: isVisible ? `calc(${staggerDelay} + 100ms)` : undefined }}
        >
          {t(item.titleKey)}
        </h3>
        <p 
          className={`text-sm text-slate-300/80 ${isVisible ? 'animate-fadeInUp' : 'opacity-0'}`}
          style={{ animationDelay: isVisible ? `calc(${staggerDelay} + 150ms)` : undefined }}
        >
          {t(item.descriptionKey)}
        </p>
      </Card>
    </div>
  );
};

export default FeatureItemCard;