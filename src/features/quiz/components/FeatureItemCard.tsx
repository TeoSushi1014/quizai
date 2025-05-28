import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../../../components/ui';

interface FeatureItemCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  animationDelay?: number; // in seconds
}

const easeIOS = [0.25, 0.1, 0.25, 1];
const durationSlow = 0.4; // Corresponds to --duration-slow (400ms)

const FeatureItemCard: React.FC<FeatureItemCardProps> = ({ icon, title, description, animationDelay = 0 }) => {
  return (
    <motion.div
      className="h-full" // Ensure motion div takes full height for flexbox alignment in grid
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{
        duration: durationSlow,
        ease: easeIOS,
        delay: animationDelay,
      }}
    >
      <Card 
        className="text-center h-full flex flex-col items-center !rounded-2xl shadow-xl !border-slate-700/40 !p-6 sm:!p-8"
        useGlassEffect={true}
      >
        <div className="p-3.5 sm:p-4 bg-sky-500/20 rounded-full mb-5 sm:mb-6 inline-block shadow-lg ring-1 ring-sky-500/30">
          {React.isValidElement(icon) && React.cloneElement(icon as React.ReactElement<any>, { className: "w-7 h-7 sm:w-8 sm:h-8 text-sky-300" })}
        </div>
        <h3 className="text-lg sm:text-xl font-semibold text-slate-50 mb-2.5 sm:mb-3">{title}</h3>
        <p className="text-slate-300/80 text-sm leading-relaxed flex-grow">{description}</p>
      </Card>
    </motion.div>
  );
};

FeatureItemCard.displayName = "FeatureItemCard";
export default FeatureItemCard;
