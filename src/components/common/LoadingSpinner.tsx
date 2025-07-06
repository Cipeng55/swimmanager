
import React from 'react';
import { SpinnerIcon } from '../icons/SpinnerIcon';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', text, className = '' }) => {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className={`flex flex-col items-center justify-center p-4 ${className}`} role="status" aria-live="polite">
      <SpinnerIcon className={`${sizeClasses[size]} text-primary`} />
      {text && <span className="mt-2 text-gray-600 dark:text-gray-300">{text}</span>}
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export default LoadingSpinner;