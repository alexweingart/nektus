'use client';

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '../ui/buttons/Button';
import { DropdownPhoneInput } from '../ui/inputs/DropdownPhoneInput';
import { useAdminModeActivator } from '../ui/banners/AdminBanner';
import { Heading } from '../ui/Typography';
import Avatar from '../ui/elements/Avatar';
import { LoadingSpinner } from '../ui/elements/LoadingSpinner';
import { useProfile } from '../../context/ProfileContext'; // Import useProfile hook
import type { UserProfile } from '@/types/profile';
import type { Country } from '../ui/inputs/DropdownPhoneInput';
import { formatPhoneNumber } from '@/lib/client/profile/phone-formatter';
import { useRouter } from 'next/navigation';
import { type CountryCode } from 'libphonenumber-js';
import { detectPlatform } from '@/lib/client/platform-detection';
import { getOptimalProfileImageUrl } from '@/lib/client/profile/image';

function ProfileSetupView() {
  // Session and authentication
  const { data: session, status: sessionStatus, update } = useSession({
    required: true,
  });
  
  const { saveProfile, profile, isSaving: isProfileSaving, isLoading: isProfileLoading, setNavigatingFromSetup, isGoogleInitials, isCheckingGoogleImage, streamingProfileImage } = useProfile();
  const router = useRouter();

  // Component state
  const [digits, setDigits] = useState('');
  
  // Keep selectedCountry for phone number formatting
  const [selectedCountry] = useState<Country>({
    name: 'United States',
    code: 'US',
    flag: '🇺🇸',
    dialCode: '1'
  });
  
  const phoneInputRef = useRef<HTMLInputElement>(null);
  
  const adminModeProps = useAdminModeActivator();

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
      const phoneResult = formatPhoneNumber(digits, selectedCountry.code as CountryCode);
      internationalPhone = phoneResult.internationalPhone;
    }
    const phoneUpdateData: Partial<UserProfile> = {
      contactEntries: [
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
        }
      ]
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
  }, [digits, isProfileSaving, selectedCountry.code, session?.user?.email, saveProfile, router, setNavigatingFromSetup, update]);


  if (sessionStatus === 'loading') {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  // For new users, profile might not exist yet - that's OK for setup

  // ProfileContext now handles all initialization automatically
  // No manual initialization needed - it will create profile and generate assets normally

  // Don't wait for profile - show form immediately for new users

  // When we have a streaming image, use it as src (for crossfade)
  // When we have Google initials (confirmed by async check), use undefined (to show our custom initials)
  // While checking Google image, hide it (src=undefined) to prevent flash
  const profileImageUrl = streamingProfileImage || profile?.profileImage;
  const isGoogleUrl = profileImageUrl?.includes('googleusercontent.com');

  const avatarSrc = streamingProfileImage
    ? getOptimalProfileImageUrl(streamingProfileImage, 400)
    : isGoogleInitials || (isCheckingGoogleImage && isGoogleUrl)
      ? undefined  // Hide Google image while checking or if confirmed initials
      : getOptimalProfileImageUrl(profileImageUrl, 400);

  // Show initials if: confirmed Google initials, OR checking a Google image (prevents flash)
  const avatarShowInitials = isGoogleInitials || (isCheckingGoogleImage && isGoogleUrl);

  // Render form content without outer wrapper
  return (
    <>
      <div className="w-full max-w-[var(--max-content-width,448px)] text-center">
        {/* Main Content */}
        <div className="w-full max-w-[var(--max-content-width)] flex flex-col items-center px-4">
          <div className="w-full max-w-[var(--max-content-width)] flex flex-col items-center">
            {/* Profile Image */}
            <div className="mb-4">
              <div className="border-4 border-white shadow-lg rounded-full">
                <Avatar
                  src={avatarSrc}
                  alt={session?.user?.name || 'Profile'}
                  size="lg"
                  isLoading={isProfileLoading}
                  showInitials={avatarShowInitials}
                />
              </div>
            </div>
            
            {/* Profile Name - Double click to activate admin mode */}
            <div className="mb-6 text-center">
              <Heading 
                as="h1"
                className="cursor-pointer"
                {...adminModeProps}
              >
                {session?.user?.name || 'Profile'}
              </Heading>
            </div>
            
            {/* Phone Input Section */}
            <div className="w-full max-w-[var(--max-content-width)] mx-auto setup-form">
              <form onSubmit={handleSave} className="w-full space-y-4">
                <DropdownPhoneInput
                  ref={phoneInputRef}
                  value={digits}
                  onChange={setDigits}
                  placeholder="Enter phone number"
                  className="w-full"
                  autoFocus={false}
                  inputProps={{
                    className: "w-full p-3 text-base border border-gray-300 rounded-full focus:ring-2 focus:ring-primary focus:border-transparent bg-white/90",
                    required: true,
                    'aria-label': 'Phone number',
                    disabled: isProfileSaving,
                    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === 'Enter' && !isProfileSaving && digits.replace(/\D/g, '').length >= 10) {
                        e.preventDefault();
                        handleSave();
                      }
                    }
                  }}
                />

                <Button
                  type="submit"
                  variant="white"
                  size="xl"
                  className="w-full font-medium"
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
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default memo(ProfileSetupView);
