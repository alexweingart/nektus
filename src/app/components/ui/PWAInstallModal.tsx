'use client';

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from './Button';
import { Heading, Text } from './Typography';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  isOpen,
  onClose
}) => {
  const handleButtonClick = () => {
    console.log('📱 PWA install modal button clicked');
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-[calc(100%-2rem)] max-w-[var(--max-content-width,448px)] translate-x-[-50%] translate-y-[-50%] gap-6 bg-black border border-white/20 p-8 shadow-lg duration-200 animate-in fade-in-0 zoom-in-95 rounded-2xl">
          <div className="text-center space-y-4">
            {/* Title */}
            <Dialog.Title asChild>
              <Heading as="h2">
                Nekt in a tap
              </Heading>
            </Dialog.Title>
            
            {/* Description */}
            <Dialog.Description asChild>
              <Text variant="base" className="leading-relaxed">
                Tap the share icon, then select add to homescreen
              </Text>
            </Dialog.Description>
          </div>
          
          {/* Action Button */}
          <div className="w-full">
            <Button
              onClick={handleButtonClick}
              variant="white"
              size="lg"
              className="w-full text-xl font-semibold"
            >
              I&apos;ll do that right now!
            </Button>
          </div>
          
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
