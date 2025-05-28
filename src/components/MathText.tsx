import React from 'react';

interface MathTextProps {
  text: string | undefined | null;
  className?: string;
}

const MathText: React.FC<MathTextProps> = ({ text, className }) => {
  if (text === null || typeof text === 'undefined' || text.trim() === "") {
    return null; 
  }

  
  return (
    <span className={className}>
      {text}
    </span>
  );
};

export default MathText;