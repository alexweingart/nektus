'use client';

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '../ui/buttons/Button';
import { DropdownPhoneInput } from '../ui/inputs/DropdownPhoneInput';
import { useAdminModeActivator } from '../ui/banners/AdminBanner';
import { Heading, Text } from '../ui/Typography';
import { LoadingSpinner } from '../ui/elements/LoadingSpinner';
import { useProfile } from '../../context/ProfileContext'; // Import useProfile hook
import type { UserProfile, ContactEntry } from '@/types/profile';
import { SecondaryButton } from '../ui/buttons/SecondaryButton';
import { CustomSocialInputAdd } from '../ui/inputs/CustomSocialInputAdd';
import { formatPhoneNumber } from '@/client/profile/phone-formatter';
import { useRouter } from 'next/navigation';
import { type CountryCode } from 'libphonenumber-js';
import { detectPlatform } from '@/client/platform-detection';

function ProfileSetupView() {
  // Session and authentication
  const { data: session, status: sessionStatus, update } = useSession({
    required: true,
  });
  
  const { saveProfile, isSaving: isProfileSaving, setNavigatingFromSetup } = useProfile();
  const router = useRouter();

  // Component state
  const [digits, setDigits] = useState('');
  const [showAddLink, setShowAddLink] = useState(false);
  const [addedLinks, setAddedLinks] = useState<ContactEntry[]>([]);
  const [socialPlatform, setSocialPlatform] = useState('instagram');
  const [socialUsername, setSocialUsername] = useState('');

  // Track country code for phone number formatting (updated by DropdownPhoneInput)
  const [countryCode, setCountryCode] = useState('US');

  const phoneInputRef = useRef<HTMLInputElement>(null);

  const adminModeProps = useAdminModeActivator();

  // Handle adding a social from the inline input (Enter key or Save captures it)
  const handleAddSocial = useCallback(() => {
    if (!socialUsername.trim()) return;

    const baseEntry = {
      fieldType: socialPlatform,
      value: socialUsername.trim(),
      order: Math.floor(addedLinks.length / 2) + 1,
      isVisible: true,
      confirmed: true,
      linkType: 'default' as const,
      icon: `/icons/default/${socialPlatform}.svg`
    };

    setAddedLinks(prev => [
      ...prev,
      { ...baseEntry, section: 'personal' },
      { ...baseEntry, section: 'work' }
    ]);
    setSocialUsername('');
    setSocialPlatform('facebook');
    setShowAddLink(false);
  }, [socialPlatform, socialUsername, addedLinks.length]);

  // Platform-specific delayed focus for keyboard tray behavior
  useEffect(() => {
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
      // Android: Focus after a short delay to bring up keyboard.
      // Don't use click() — programmatic clicks don't trigger Chrome's autosuggest.
      // Autosuggest appears on the user's first tap on the already-focused input.
      const timer = setTimeout(focusInput, 300);
      return () => clearTimeout(timer);
    } else {
      // Web/Desktop: Focus immediately
      focusInput();
    }
  }, []);

  // Handle saving the profile with phone number
  const handleSave = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (!session?.user?.email) return;
    if (isProfileSaving) return;

    let internationalPhone = '';
    if (digits) {
      const phoneResult = formatPhoneNumber(digits, countryCode as CountryCode);
      internationalPhone = phoneResult.internationalPhone;
    }

    // Capture in-progress social if input is showing
    let finalLinks = [...addedLinks];
    if (showAddLink && socialUsername.trim()) {
      const baseEntry = {
        fieldType: socialPlatform,
        value: socialUsername.trim(),
        order: Math.floor(addedLinks.length / 2) + 1,
        isVisible: true,
        confirmed: true,
        linkType: 'default' as const,
        icon: `/icons/default/${socialPlatform}.svg`
      };
      finalLinks.push({ ...baseEntry, section: 'personal' });
      finalLinks.push({ ...baseEntry, section: 'work' });
    }

    // Build contact entries array with phone and any added links
    const contactEntries: ContactEntry[] = [
      {
        fieldType: 'phone',
        section: 'personal',
        value: internationalPhone,
        order: 0,
        isVisible: true,
        confirmed: true
      },
      {
        fieldType: 'phone',
        section: 'work',
        value: internationalPhone,
        order: 0,
        isVisible: true,
        confirmed: true
      },
      ...finalLinks
    ];

    const phoneUpdateData: Partial<UserProfile> = {
      contactEntries
    };

    setNavigatingFromSetup(true);

    // Update session FIRST to prevent middleware redirect
    if (update) {
      await update({
        isNewUser: false,
        redirectTo: '/' // Clear setup redirect immediately
      });
    }

    // Navigate immediately after session update
    router.replace('/');

    // Save in background
    try {
      await saveProfile(phoneUpdateData);
    } catch (err) {
      console.error('[ProfileSetup] Background save failed:', err);
      // Could redirect back to setup or show error notification
    } finally {
      setNavigatingFromSetup(false);
    }
  }, [digits, addedLinks, showAddLink, socialPlatform, socialUsername, isProfileSaving, countryCode, session?.user?.email, saveProfile, router, setNavigatingFromSetup, update]);


  if (sessionStatus === 'loading') {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  // Render form content without outer wrapper
  return (
    <>
      <div className="w-full max-w-[var(--max-content-width,448px)] text-center">
        {/* Main Content */}
        <div className="w-full max-w-[var(--max-content-width)] flex flex-col items-center px-4">
          <div className="w-full max-w-[var(--max-content-width)] flex flex-col items-center">
            {/* Welcome Section - Double click to activate admin mode */}
            <div className="mb-6 text-center relative z-10 space-y-2">
              <Heading
                as="h1"
                className="cursor-pointer"
                {...adminModeProps}
              >
                Welcome, {session?.user?.name || 'there'}!
              </Heading>
              <Text variant="base" className="text-white/70">
                Your new friends will want your number
              </Text>
            </div>
            
            {/* Phone Input Section */}
            <div className="w-full max-w-[var(--max-content-width)] mx-auto setup-form">
              <form onSubmit={handleSave} className="w-full space-y-4">
                <DropdownPhoneInput
                  ref={phoneInputRef}
                  value={digits}
                  onChange={setDigits}
                  onCountryChange={setCountryCode}
                  placeholder="Phone number"
                  className="w-full"
                  autoFocus={false}
                  inputProps={{
                    required: true,
                    'aria-label': 'Phone number',
                    autoComplete: 'tel-national',
                    disabled: isProfileSaving,
                    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === 'Enter' && !isProfileSaving && digits.replace(/\D/g, '').length >= 10) {
                        e.preventDefault();
                        handleSave();
                      }
                    }
                  }}
                />

                {/* Social Input - appears above Save button when active */}
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

                <Button
                  type="submit"
                  variant="white"
                  size="xl"
                  className="w-full"
                  disabled={isProfileSaving || (digits.replace(/\D/g, '').length < 10)}
                  aria-busy={isProfileSaving}
                >
                  {isProfileSaving ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </span>
                  ) : 'Save'}
                </Button>
              </form>

              {/* Add Socials Button - always visible */}
              <div className="mt-4 text-center">
                <SecondaryButton
                  className="cursor-pointer"
                  onClick={() => {
                    if (showAddLink && socialUsername.trim()) {
                      handleAddSocial();
                    }
                    setShowAddLink(true);
                  }}
                >
                  {addedLinks.length > 0 ? 'Add Socials' : 'Add Instagram'}
                </SecondaryButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default memo(ProfileSetupView);
