'use client';

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from './buttons/Button';
import { SecondaryButton } from './buttons/SecondaryButton';
import { Heading, Text } from './Typography';

interface StandardModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  primaryButtonText: string;
  onPrimaryButtonClick: () => void;
  secondaryButtonText?: string;
  onSecondaryButtonClick?: () => void;
  variant?: 'success' | 'upsell' | 'info';
  showSecondaryButton?: boolean;}

export const StandardModal: React.FC<StandardModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  primaryButtonText,
  onPrimaryButtonClick,
  secondaryButtonText = "Maybe later",
  showSecondaryButton = true,  onSecondaryButtonClick,
  variant: _variant = 'info'
}) => {
  const handlePrimaryClick = () => {
    console.log(`🎯 Standard modal primary button clicked: ${primaryButtonText}`);
    onPrimaryButtonClick();
  };

  const handleSecondaryClick = () => {
    if (onSecondaryButtonClick) {
      onSecondaryButtonClick();
    } else {
      onClose();
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 backdrop-blur-sm animate-in fade-in-0 z-[2000]" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-[2000] grid w-[calc(100%-2rem)] max-w-[var(--max-content-width,448px)] translate-x-[-50%] translate-y-[-50%] gap-6 bg-black/60 backdrop-blur-sm border border-white/20 p-8 shadow-lg duration-200 animate-in fade-in-0 zoom-in-95 rounded-2xl">
          <div className="text-center space-y-4">
            {/* Title */}
            <Dialog.Title asChild>
              <Heading as="h2">
                {title}
              </Heading>
            </Dialog.Title>
            
            {/* Subtitle */}
            <Dialog.Description asChild>
              <Text variant="base" className="leading-relaxed break-words hyphens-auto">
                {subtitle}
              </Text>
            </Dialog.Description>
          </div>
          
          {/* Action Button */}
          <div className="w-full">
            <Button
              onClick={handlePrimaryClick}
              variant="white"
              size="lg"
              className="w-full text-xl font-semibold"
            >
              {primaryButtonText}
            </Button>
          </div>
          
          {/* Secondary Button */}
          {showSecondaryButton && (
            <div className="flex justify-center">
              <SecondaryButton onClick={handleSecondaryClick}>
                {secondaryButtonText}
              </SecondaryButton>
            </div>
          )}          
          {/* Close button (optional, invisible but accessible) */}
          <Dialog.Close asChild>
            <button 
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
              aria-label="Close"
            >
              <span className="sr-only">Close</span>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}; 