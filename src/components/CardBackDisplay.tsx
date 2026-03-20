import React from 'react';
import clsx from 'clsx';

interface CardBackDisplayProps {
  content: string;
  className?: string;
  hideExtra?: boolean;
}

const CardBackDisplay: React.FC<CardBackDisplayProps> = ({ content, className, hideExtra }) => {
  return (
    <div 
      className={clsx("prose prose-invert max-w-none break-words", className)}
      dangerouslySetInnerHTML={{ __html: content }} 
    />
  );
};

export default CardBackDisplay;
