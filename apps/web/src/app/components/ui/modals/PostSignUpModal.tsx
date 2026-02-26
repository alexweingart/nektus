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
import { ToggleSetting } from '../controls/ToggleSetting';
import { scrapeBio } from '@/client/profile/scrape-bio';

interface PostSignUpModalProps {
  isOpen: boolean;
  userName: string;
  isSaving: boolean;
  onSave: (phone: string, socials: ContactEntry[]) => Promise<void>;
  /** Called when bio is scraped from social profile — caller saves to Firestore */
  onBioScraped?: (bio: string) => void;
  /** Which profile was scanned - determines default social platform */
  scannedSection?: 'personal' | 'work';
}

export const PostSignUpModal: React.FC<PostSignUpModalProps> = ({
  isOpen,
  userName,
  isSaving,
  onSave,
  onBioScraped,
  scannedSection = 'personal'
}) => {
  const [digits, setDigits] = useState('');
  // Work mode: pre-populate with LinkedIn row so it's visible immediately
  const [socialInputs, setSocialInputs] = useState<Array<{platform: string, username: string}>>(
    scannedSection === 'work' ? [{ platform: 'linkedin', username: '' }] : []
  );
  const [error, setError] = useState<string | null>(null);
  const [useForBio, setUseForBio] = useState(true);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  const isWork = scannedSection === 'work';

  // Check if phone is valid (10+ digits)
  const isPhoneValid = digits.replace(/\D/g, '').length >= 10;

  // Check if any social has a username filled in
  const hasAnySocial = socialInputs.some(s => s.username.trim().length > 0);

  // For work: either a social (LinkedIn) or phone is enough. For personal: phone required.
  const canSave = isWork ? (hasAnySocial || isPhoneValid) : isPhoneValid;

  // Platform-specific delayed focus for keyboard tray behavior
  useEffect(() => {
    if (!isOpen) return;

    // For work mode, don't auto-focus phone — the social input handles its own focus
    if (isWork) return;

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
  }, [isOpen, isWork]);

  // Handle save - build social entries if username provided
  const handleSave = useCallback(async () => {
    if (!canSave || isSaving) return;
    setError(null);

    // Collect all social inputs with non-empty usernames
    const socialEntries: ContactEntry[] = socialInputs
      .filter(input => input.username.trim())
      .flatMap((input, idx) => {
        const baseEntry = {
          fieldType: input.platform,
          value: input.username.trim(),
          order: idx + 1,
          isVisible: true,
          confirmed: true,
          linkType: 'default' as const,
          icon: `/icons/default/${input.platform}.svg`
        };
        return [
          { ...baseEntry, section: 'personal' as const },
          { ...baseEntry, section: 'work' as const }
        ];
      });

    try {
      await onSave(digits, socialEntries);

      // Fire-and-forget bio scrape if toggle is on — pass result to caller
      if (useForBio && socialInputs[0]?.username.trim() &&
          ['instagram', 'linkedin'].includes(socialInputs[0].platform)) {
        scrapeBio(
          socialInputs[0].platform as 'instagram' | 'linkedin',
          socialInputs[0].username.trim()
        ).then(result => {
          if (result.success && result.bio) {
            onBioScraped?.(result.bio);
          }
        }).catch(console.error);
      }
    } catch (err) {
      console.error('[PostSignUpModal] Save failed:', err);
      setError('Couldn\'t save — try again?');
    }
  }, [digits, socialInputs, canSave, isSaving, onSave, onBioScraped, useForBio]);

  // Extract first name from full name
  const firstName = userName?.split(' ')[0] || 'They-who-must-not-be-named';

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
                  {isWork
                    ? 'Don\u2019t ghost them \u2014 drop your LinkedIn or number'
                    : 'Your new friends will want your number and socials'}
                </Text>
              </Dialog.Description>
            </div>

            {/* Inputs */}
            <div className="w-full space-y-4">
              {/* Social Inputs - for work, LinkedIn is pre-populated first */}
              {socialInputs.map((input, index) => (
                <CustomSocialInputAdd
                  key={index}
                  platform={input.platform}
                  username={input.username}
                  onPlatformChange={(platform) =>
                    setSocialInputs(prev => prev.map((s, i) => i === index ? { ...s, platform } : s))
                  }
                  onUsernameChange={(username) =>
                    setSocialInputs(prev => prev.map((s, i) => i === index ? { ...s, username } : s))
                  }
                  autoFocus={isWork && index === 0 ? true : index === socialInputs.length - 1 && index > 0}
                />
              ))}

              {/* Phone Input */}
              <DropdownPhoneInput
                ref={phoneInputRef}
                value={digits}
                onChange={setDigits}
                placeholder="Phone number"
                className="w-full"
                autoFocus={false}
                inputProps={{
                  required: !isWork,
                  'aria-label': 'Phone number',
                  disabled: isSaving,
                  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter' && !isSaving && canSave) {
                      e.preventDefault();
                      handleSave();
                    }
                  }
                }}
              />

              {/* Use for bio toggle - show when first social is instagram or linkedin */}
              {socialInputs.length > 0 && ['instagram', 'linkedin'].includes(socialInputs[0].platform) && socialInputs[0].username.trim() && (
                <ToggleSetting
                  label={`Use ${socialInputs[0].platform === 'linkedin' ? 'LinkedIn' : 'Instagram'} for bio`}
                  enabled={useForBio}
                  onChange={setUseForBio}
                />
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
                disabled={isSaving || !canSave}
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

            {/* Add Socials Button */}
            <div className="flex justify-center">
              <SecondaryButton
                variant="subtle"
                onClick={() => {
                  setSocialInputs(prev => [
                    ...prev,
                    { platform: prev.length === 0 ? (isWork ? 'linkedin' : 'instagram') : 'facebook', username: '' }
                  ]);
                }}
              >
                {socialInputs.length > 0 ? 'Add Socials' : (isWork ? 'Add LinkedIn' : 'Add Instagram')}
              </SecondaryButton>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
