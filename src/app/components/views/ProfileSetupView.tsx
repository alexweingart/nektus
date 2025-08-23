'use client';

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '../ui/buttons/Button';
import CustomPhoneInput from '../ui/inputs/CustomPhoneInput';
import { useAdminModeActivator } from '../ui/AdminBanner';
import { Heading } from '../ui/Typography';
import { useFreezeScrollOnFocus } from '@/lib/hooks/useFreezeScrollOnFocus';
import Avatar from '../ui/Avatar';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useProfile } from '../../context/ProfileContext'; // Import useProfile hook
import type { UserProfile } from '@/types/profile';
import type { Country } from '../ui/inputs/CustomPhoneInput';
import { formatPhoneNumber } from '@/lib/utils/phoneFormatter';
import { useRouter } from 'next/navigation';
import { type CountryCode } from 'libphonenumber-js';
import { detectPlatform } from '@/lib/utils/platformDetection';

function ProfileSetupView() {
  // Session and authentication
  const { data: session, status: sessionStatus } = useSession({
    required: true,
  });
  
  const { saveProfile, profile, isSaving: isProfileSaving, streamingProfileImage } = useProfile();
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
  
  useFreezeScrollOnFocus(phoneInputRef);
  const adminModeProps = useAdminModeActivator();

  // Platform-specific delayed focus for keyboard tray behavior
  useEffect(() => {
    const focusInput = () => {
      if (phoneInputRef.current) {
        phoneInputRef.current.focus();
      }
    };

    const { isIOS, isAndroid } = detectPlatform();

    if (isIOS) {
      // iOS: Use requestAnimationFrame for optimal performance
      requestAnimationFrame(() => {
        requestAnimationFrame(focusInput);
      });
    } else if (isAndroid) {
      // Android: Use longer delay for OAuth callback scenarios
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
      const phoneResult = formatPhoneNumber(digits, selectedCountry.code as CountryCode);
      internationalPhone = phoneResult.internationalPhone;
    }
    const phoneUpdateData: Partial<UserProfile> = {
      contactEntries: [
        {
          fieldType: 'phone',
          section: 'universal',
          value: internationalPhone,
          order: 0,
          isVisible: true,
          confirmed: true
        }
      ]
    };

    router.replace('/');
    setTimeout(() => {
      console.log('[ProfileSetup] Now saving profile after navigation');
      saveProfile(phoneUpdateData).catch(err => {
        console.error('[ProfileSetup] Failed to save profile:', err);
      });
    }, 0);
  }, [digits, isProfileSaving, selectedCountry.code, session?.user?.email, saveProfile, router]);

  if (sessionStatus === 'loading' || !profile) {
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
            {/* Profile Image */}
            <div className="mb-4">
              <div className="border-4 border-white shadow-lg rounded-full">
                <Avatar 
                  src={streamingProfileImage || profile?.profileImage || session?.user?.image || '/default-avatar.png'} 
                  alt={session?.user?.name || 'Profile'}
                  size="lg"
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
              <div className="w-full space-y-4">
                <CustomPhoneInput
                  ref={phoneInputRef}
                  value={digits}
                  onChange={setDigits}
                  placeholder="Enter phone number"
                  className="w-full"
                  autoFocus={false}
                  inputProps={{
                    className: "w-full p-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white/90",
                    required: true,
                    'aria-label': 'Phone number',
                    disabled: isProfileSaving
                  }}
                />
                
                <Button
                  type="button"
                  variant="theme"
                  size="xl"
                  className="w-full font-medium"
                  disabled={isProfileSaving || (digits.replace(/\D/g, '').length < 10)}
                  aria-busy={isProfileSaving}
                  onClick={handleSave}
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default memo(ProfileSetupView);
