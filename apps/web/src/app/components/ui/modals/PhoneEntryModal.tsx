'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '../buttons/Button';
import { SecondaryButton } from '../buttons/SecondaryButton';
import { Heading, Text } from '../Typography';
import { DropdownPhoneInput } from '../inputs/DropdownPhoneInput';
import { CustomSocialInputAdd } from '../inputs/CustomSocialInputAdd';
import type { ContactEntry } from '@/types/profile';
import { detectPlatform } from '@/client/platform-detection';

interface PhoneEntryModalProps {
  isOpen: boolean;
  userName: string;
  isSaving: boolean;
  onSave: (phone: string, socials: ContactEntry[]) => Promise<void>;
  /** Which profile was scanned - determines default social platform */
  scannedSection?: 'personal' | 'work';
}

export const PhoneEntryModal: React.FC<PhoneEntryModalProps> = ({
  isOpen,
  userName,
  isSaving,
  onSave,
  scannedSection = 'personal'
}) => {
  const [digits, setDigits] = useState('');
  const [showAddLink, setShowAddLink] = useState(false);
  const [socialPlatform, setSocialPlatform] = useState(scannedSection === 'work' ? 'linkedin' : 'instagram');
  const [socialUsername, setSocialUsername] = useState('');
  const [addedSocials, setAddedSocials] = useState<ContactEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  // Update default platform when scannedSection prop changes
  useEffect(() => {
    setSocialPlatform(scannedSection === 'work' ? 'linkedin' : 'instagram');
  }, [scannedSection]);

  // Check if phone is valid (10+ digits)
  const isPhoneValid = digits.replace(/\D/g, '').length >= 10;

  // Platform-specific delayed focus for keyboard tray behavior
  useEffect(() => {
    if (!isOpen) return;

    const focusInput = () => {
      if (phoneInputRef.current) {
        phoneInputRef.current.focus();
        // For Android, also trigger a click to ensure keyboard shows
        if (detectPlatform().isAndroid) {
          phoneInputRef.current.click();
        }
      }
    };

    const { isIOS, isAndroid } = detectPlatform();

    if (isIOS) {
      // iOS: Use requestAnimationFrame for optimal performance
      requestAnimationFrame(() => {
        requestAnimationFrame(focusInput);
      });
    } else if (isAndroid) {
      // Android: Use multiple attempts with different delays
      const timer1 = setTimeout(focusInput, 100);
      const timer2 = setTimeout(focusInput, 500);
      const timer3 = setTimeout(focusInput, 1000);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    } else {
      // Web/Desktop: Focus with slight delay to let modal open
      const timer = setTimeout(focusInput, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle adding a social (Enter key in social input)
  const handleAddSocial = useCallback(() => {
    if (!socialUsername.trim()) return;

    const baseEntry = {
      fieldType: socialPlatform,
      value: socialUsername.trim(),
      order: Math.floor(addedSocials.length / 2) + 1,
      isVisible: true,
      confirmed: true,
      linkType: 'default' as const,
      icon: `/icons/default/${socialPlatform}.svg`
    };

    setAddedSocials(prev => [
      ...prev,
      { ...baseEntry, section: 'personal' },
      { ...baseEntry, section: 'work' }
    ]);
    setSocialUsername('');
    setSocialPlatform('facebook');
    setShowAddLink(false);
  }, [socialPlatform, socialUsername, addedSocials.length]);

  // Handle save - build social entries if username provided
  const handleSave = useCallback(async () => {
    if (!isPhoneValid || isSaving) return;
    setError(null);

    // Combine previously added socials with any in-progress one
    const socialEntries: ContactEntry[] = [...addedSocials];
    if (showAddLink && socialUsername.trim()) {
      const baseEntry = {
        fieldType: socialPlatform,
        value: socialUsername.trim(),
        order: Math.floor(addedSocials.length / 2) + 1,
        isVisible: true,
        confirmed: true,
        linkType: 'default' as const,
        icon: `/icons/default/${socialPlatform}.svg`
      };
      socialEntries.push({ ...baseEntry, section: 'personal' });
      socialEntries.push({ ...baseEntry, section: 'work' });
    }

    try {
      await onSave(digits, socialEntries);
    } catch (err) {
      console.error('[PhoneEntryModal] Save failed:', err);
      setError('Failed to save. Please try again.');
    }
  }, [digits, socialPlatform, socialUsername, addedSocials, showAddLink, isPhoneValid, isSaving, onSave]);

  // Extract first name from full name
  const firstName = userName?.split(' ')[0] || 'there';

  return (
    <Dialog.Root open={isOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[2000] animate-backdrop-enter" />
        <Dialog.Content
          className="fixed inset-0 z-[2000] flex items-center justify-center px-4 py-4"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <div className="w-full max-w-[var(--max-content-width,448px)] grid gap-6 bg-black/80 border border-white/20 p-8 shadow-lg rounded-2xl animate-modal-enter relative">
            <div className="text-center space-y-4">
              {/* Title */}
              <Dialog.Title asChild>
                <Heading as="h2">
                  Welcome, {firstName}!
                </Heading>
              </Dialog.Title>

              {/* Subtitle */}
              <Dialog.Description asChild>
                <Text variant="small" className="leading-relaxed break-words">
                  Your new friends will want your number
                </Text>
              </Dialog.Description>
            </div>

            {/* Phone Input */}
            <div className="w-full space-y-4">
              <DropdownPhoneInput
                ref={phoneInputRef}
                value={digits}
                onChange={setDigits}
                placeholder="Phone number"
                className="w-full"
                autoFocus={false}
                inputProps={{
                  required: true,
                  'aria-label': 'Phone number',
                  disabled: isSaving,
                  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter' && !isSaving && isPhoneValid) {
                      e.preventDefault();
                      handleSave();
                    }
                  }
                }}
              />

              {/* Social Input - appears when Add Socials is clicked */}
              {showAddLink && (
                <div onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleAddSocial();
                  }
                }}>
                  <CustomSocialInputAdd
                    platform={socialPlatform}
                    username={socialUsername}
                    onPlatformChange={setSocialPlatform}
                    onUsernameChange={setSocialUsername}
                    autoFocus
                  />
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <Text variant="small" className="text-red-400 text-center">
                {error}
              </Text>
            )}

            {/* Save Button */}
            <div className="w-full">
              <Button
                onClick={handleSave}
                variant="white"
                size="xl"
                className="w-full"
                disabled={isSaving || !isPhoneValid}
              >
                {isSaving ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </span>
                ) : 'Save'}
              </Button>
            </div>

            {/* Add Socials Button - always visible */}
            <div className="flex justify-center">
              <SecondaryButton
                variant="subtle"
                onClick={() => {
                  if (showAddLink) {
                    handleAddSocial();
                    setSocialPlatform('facebook');
                    setSocialUsername('');
                  }
                  setShowAddLink(true);
                }}
              >
                {showAddLink || addedSocials.length > 0 ? 'Add Socials' : (scannedSection === 'work' ? 'Add LinkedIn' : 'Add Instagram')}
              </SecondaryButton>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
