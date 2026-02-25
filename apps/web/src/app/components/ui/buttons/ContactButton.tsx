/**
 * ContactButton component - Primary action button for contact exchange
 * Handles Save Contact / Done states similar to ExchangeButton pattern
 */

'use client';

import React from 'react';
import { Button } from './Button';
import { LoadingSpinner } from '../elements/LoadingSpinner';

interface ContactButtonProps {
  isSuccess: boolean;
  isSaving: boolean;
  isLoading?: boolean;
  onClick: () => void;
  className?: string;
}

export const ContactButton: React.FC<ContactButtonProps> = ({
  isSuccess,
  isSaving,
  isLoading = false,
  onClick,
  className
}) => {
  // Get button content based on state
  const getButtonContent = () => {
    if (isSaving) {
      return (
        <div className="flex items-center justify-center gap-2">
          <LoadingSpinner size="sm" />
          <span>Hang on...</span>
        </div>
      );
    }

    return isSuccess ? "I'm good" : 'Save';
  };

  const isDisabled = isSaving || isLoading;

  return (
    <Button
      variant="white"
      size="xl"
      className={`w-full ${className || ''}`}
      onClick={onClick}
      disabled={isDisabled}
    >
      {getButtonContent()}
    </Button>
  );
};
