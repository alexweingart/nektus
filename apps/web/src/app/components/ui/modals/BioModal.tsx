'use client';

import React, { useState, useRef, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '../buttons/Button';
import { SecondaryButton } from '../buttons/SecondaryButton';
import { Heading, Text } from '../Typography';
import { ExpandingInput } from '../inputs/ExpandingInput';
import { CustomSocialInputAdd } from '../inputs/CustomSocialInputAdd';
import type { UserProfile } from '@/types/profile';
import { scrapeBio } from '@/client/profile/scrape-bio';
import { detectPlatform } from '@/client/platform-detection';

interface BioModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSection: 'Personal' | 'Work';
  profile: UserProfile;
  onBioSaved: (bio: string) => void;
  onSocialEntrySaved?: (platform: string, username: string) => void;
  onScrapeStarted?: () => void;
  onScrapeFailed?: () => void;
}

export const BioModal: React.FC<BioModalProps> = ({
  isOpen,
  onClose,
  currentSection,
  profile,
  onBioSaved,
  onSocialEntrySaved,
  onScrapeStarted,
  onScrapeFailed
}) => {
  const [mode, setMode] = useState<'input' | 'social-input'>('input');
  const [bioText, setBioText] = useState('');
  const [socialUsername, setSocialUsername] = useState('');
  const [socialPlatform, setSocialPlatform] = useState<'instagram' | 'linkedin'>(
    currentSection === 'Work' ? 'linkedin' : 'instagram'
  );
  const [isLoading, setIsLoading] = useState(false);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const bioInputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus autobiography input when modal opens in input mode
  useEffect(() => {
    if (!isOpen || mode !== 'input') return;

    const focusInput = () => {
      if (bioInputRef.current) {
        bioInputRef.current.focus();
        if (detectPlatform().isAndroid) {
          bioInputRef.current.click();
        }
      }
    };

    const { isIOS, isAndroid } = detectPlatform();

    if (isIOS) {
      requestAnimationFrame(() => {
        requestAnimationFrame(focusInput);
      });
    } else if (isAndroid) {
      const timer1 = setTimeout(focusInput, 100);
      const timer2 = setTimeout(focusInput, 500);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    } else {
      const timer = setTimeout(focusInput, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, mode]);

  const targetPlatform = currentSection === 'Work' ? 'linkedin' : 'instagram';
  const platformLabel = targetPlatform === 'instagram' ? 'Instagram' : 'LinkedIn';

  // Check if the platform already exists in profile
  const existingEntry = profile.contactEntries?.find(
    e => e.fieldType === targetPlatform && !!e.value?.trim()
  );

  const handleSaveBio = () => {
    if (bioText.trim()) {
      onBioSaved(bioText.trim());
      onClose();
      resetState();
    }
  };

  const handleUseSocialBio = async () => {
    if (existingEntry) {
      // Platform exists - scrape directly
      onClose();
      resetState();
      onScrapeStarted?.();
      scrapeBio(targetPlatform, existingEntry.value).then(result => {
        if (result.success && result.bio) onBioSaved(result.bio);
        else onScrapeFailed?.();
      }).catch(() => onScrapeFailed?.());
    } else {
      // Need username - switch to social input mode
      setMode('social-input');
      setSocialPlatform(targetPlatform);
    }
  };

  const handleSocialSubmit = async () => {
    if (!socialUsername.trim()) return;
    const username = socialUsername.trim();

    // Save the social handle to profile first
    onSocialEntrySaved?.(socialPlatform, username);

    onClose();
    resetState();
    onScrapeStarted?.();

    // Scrape bio in background, use result to update directly
    scrapeBio(socialPlatform, username).then(result => {
      if (result.success && result.bio) onBioSaved(result.bio);
      else onScrapeFailed?.();
    }).catch(() => onScrapeFailed?.());
  };

  const resetState = () => {
    setMode('input');
    setBioText('');
    setSocialUsername('');
    setIsLoading(false);
  };

  const handleClose = () => {
    onClose();
    resetState();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[2000] animate-backdrop-enter" />
        <Dialog.Content
          className="fixed inset-0 z-[2000] flex items-center justify-center px-4 py-4"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div
            ref={modalContentRef}
            className="w-full max-w-[var(--max-content-width,448px)] grid gap-6 bg-black/80 border border-white/20 p-8 shadow-lg rounded-2xl animate-modal-enter relative"
          >
            <div className="text-center space-y-2">
              <Dialog.Title asChild>
                <Heading as="h2">
                  {mode === 'social-input' ? `Add ${platformLabel}` : 'Add Bio'}
                </Heading>
              </Dialog.Title>
              <Dialog.Description asChild>
                <Text variant="small" className="leading-relaxed text-white/70">
                  {mode === 'social-input'
                    ? `Enter your ${platformLabel} username to import your bio`
                    : 'Tell people what you\'re about (or steal your bio from socials)'}
                </Text>
              </Dialog.Description>
            </div>

            {mode === 'input' ? (
              <>
                <ExpandingInput
                  ref={bioInputRef}
                  value={bioText}
                  onChange={setBioText}
                  placeholder="Enter autobiography here..."
                  maxLength={280}
                />

                <Button
                  onClick={handleSaveBio}
                  variant="white"
                  size="xl"
                  className="w-full"
                  disabled={!bioText.trim()}
                >
                  Save
                </Button>

                <div className="flex justify-center">
                  <SecondaryButton
                    variant="subtle"
                    onClick={handleUseSocialBio}
                  >
                    Use {platformLabel} Bio
                  </SecondaryButton>
                </div>
              </>
            ) : (
              <>
                <CustomSocialInputAdd
                  platform={socialPlatform}
                  username={socialUsername}
                  onPlatformChange={(p) => setSocialPlatform(p as 'instagram' | 'linkedin')}
                  onUsernameChange={setSocialUsername}
                  autoFocus
                  portalContainer={modalContentRef.current}
                />

                <Button
                  onClick={handleSocialSubmit}
                  variant="white"
                  size="xl"
                  className="w-full"
                  disabled={!socialUsername.trim() || isLoading}
                >
                  {isLoading ? 'Snooping...' : `Import ${platformLabel} Bio`}
                </Button>

                <div className="flex justify-center">
                  <SecondaryButton
                    variant="subtle"
                    onClick={() => setMode('input')}
                  >
                    I&apos;ll write my own
                  </SecondaryButton>
                </div>
              </>
            )}

            {/* Close button */}
            <Dialog.Close asChild>
              <button
                className="absolute right-4 top-4 rounded-full opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none text-white hover:text-white/80"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
