'use client';

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '../buttons/Button';
import { SecondaryButton } from '../buttons/SecondaryButton';
import { Heading, Text } from '../Typography';

interface StandardModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  primaryButtonText?: string;
  primaryButtonIcon?: React.ReactNode;
  onPrimaryButtonClick?: () => void;
  primaryButtonDisabled?: boolean;
  secondaryButtonText?: string;
  onSecondaryButtonClick?: () => void;
  showSecondaryButton?: boolean;
  showPrimaryButton?: boolean;
  showCloseButton?: boolean;
  children?: React.ReactNode;
}

export const StandardModal: React.FC<StandardModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  primaryButtonText,
  primaryButtonIcon,
  onPrimaryButtonClick,
  primaryButtonDisabled = false,
  secondaryButtonText = "Maybe later",
  showSecondaryButton = true,
  showPrimaryButton = true,
  showCloseButton = true,
  onSecondaryButtonClick,
  children
}) => {
  const handlePrimaryClick = () => {
    console.log(`🎯 Standard modal primary button clicked: ${primaryButtonText}`);
    onPrimaryButtonClick?.();
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
        <Dialog.Overlay className="fixed inset-0 z-[2000] animate-backdrop-enter" />
        <Dialog.Content
          className="fixed inset-0 z-[2000] flex items-center justify-center px-4 py-4"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="w-full max-w-[var(--max-content-width,448px)] grid gap-6 bg-black/80 border border-white/20 p-8 shadow-lg rounded-2xl animate-modal-enter relative [&>*]:min-w-0">
            <div className="text-center space-y-4">
              {/* Title */}
              <Dialog.Title asChild>
                <Heading as="h2">
                  {title}
                </Heading>
              </Dialog.Title>

              {/* Subtitle */}
              {subtitle && (
                <Dialog.Description asChild>
                  <Text variant="small" className="leading-relaxed break-words">
                    {subtitle}
                  </Text>
                </Dialog.Description>
              )}
            </div>

            {/* Custom Content */}
            {children}

            {/* Action Button */}
            {showPrimaryButton && primaryButtonText && onPrimaryButtonClick && (
              <div className="w-full">
                <Button
                  onClick={handlePrimaryClick}
                  variant="white"
                  size="xl"
                  className="w-full"
                  disabled={primaryButtonDisabled}
                  icon={primaryButtonIcon}
                >
                  {primaryButtonText}
                </Button>
              </div>
            )}

            {/* Secondary Button */}
            {showSecondaryButton && (
              <div className="flex justify-center">
                <SecondaryButton variant="subtle" onClick={handleSecondaryClick}>
                  {secondaryButtonText}
                </SecondaryButton>
              </div>
            )}

            {/* Close button */}
            {showCloseButton && (
              <Dialog.Close asChild>
                <button
                  className="absolute right-4 top-4 rounded-full opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none text-white hover:text-white/80"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="sr-only">Close</span>
                </button>
              </Dialog.Close>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}; 