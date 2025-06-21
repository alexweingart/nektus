'use client';

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/Button';
import { type CountryCode } from 'libphonenumber-js';
import CustomPhoneInput from './ui/CustomPhoneInput';
import { useAdminModeActivator } from './ui/AdminBanner';
import { Heading } from './ui/Typography';
import { useFreezeScrollOnFocus } from '@/lib/utils/useFreezeScrollOnFocus';
import Avatar from './ui/Avatar';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { useProfile } from '../context/ProfileContext'; // Import useProfile hook
import type { UserProfile } from '@/types/profile';
import type { Country } from '@/types/forms';
import { formatPhoneNumber } from '@/lib/utils/phoneFormatter';

function ProfileSetup() {
  // Session and authentication
  const { data: session, status: sessionStatus } = useSession({
    required: true,
  });
  
  // Minimal ProfileContext subscription - only for saveProfile function
  const { saveProfile, profile } = useProfile();
  const router = useRouter();
  
  // Component state
  const [isSaving, setIsSaving] = useState(false);
  const [digits, setDigits] = useState('');
  const [isRedirecting, setIsRedirecting] = useState(false);
  const navigationAttemptedRef = useRef(false);
  
  // Keep selectedCountry for phone number formatting
  const [selectedCountry] = useState<Country>({
    name: 'United States',
    code: 'US',
    flag: '🇺🇸',
    dialCode: '1'
  });
  
  // Refs
  const phoneInputRef = useRef<HTMLInputElement>(null);
  
  // Hooks must be called before any conditional returns
  useFreezeScrollOnFocus(phoneInputRef);
  const adminModeProps = useAdminModeActivator();

  // Handle saving the profile with phone number
  const handleSave = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!session?.user?.email) {
      console.error('Cannot save: No user session');
      return;
    }
    
    if (isSaving) {
      return;
    }
    
    setIsSaving(true);
    
    try {
      let nationalPhone = '';
      let internationalPhone = '';
      
      // Format phone number if digits are provided
      if (digits) {
        const phoneResult = formatPhoneNumber(digits, selectedCountry.code as CountryCode);
        
        if (phoneResult.isValid || phoneResult.internationalPhone) {
          internationalPhone = phoneResult.internationalPhone;
          nationalPhone = phoneResult.nationalPhone;
        } else {
          // For invalid numbers, still try to save them for user's convenience
          // This matches the original behavior of preserving user input
          const cleanedDigits = digits.replace(/\D/g, '');
          internationalPhone = cleanedDigits ? `+${cleanedDigits}` : '';
          nationalPhone = cleanedDigits;
        }
      }
      
      // Only update phone-related fields, preserve all other profile data
      const phoneUpdateData: Partial<UserProfile> = {
        contactChannels: {
          phoneInfo: {
            internationalPhone,
            nationalPhone,
            userConfirmed: false
          },
          whatsapp: {
            username: nationalPhone,
            url: `https://wa.me/${nationalPhone}`,
            userConfirmed: false
          },
          wechat: {
            username: nationalPhone,
            url: `weixin://dl/chat?${nationalPhone}`,
            userConfirmed: false
          },
          telegram: {
            username: nationalPhone,
            url: `https://t.me/${nationalPhone}`,
            userConfirmed: false
          }
        } as any // Partial update - preserves existing contact channels
      };
      
      try {
        // Save only the phone-related fields (preserves bio and other data)
        console.log('[ProfileSetup] Starting save for phone data:', phoneUpdateData);
        const updatedProfile = await saveProfile(phoneUpdateData);
        
        if (updatedProfile) {
          console.log('[ProfileSetup] Successfully saved phone data to Firestore for user:', updatedProfile.userId);
          
          // Navigate immediately without resetting saving state
          router.push('/');
          return; // Exit early, don't reset isSaving
        } else {
          throw new Error('Failed to save profile - no updated profile returned');
        }
      } catch (saveError) {
        console.error('[ProfileSetup] Error in saveProfile call:', saveError);
        // Only reset saving state on error
        setIsSaving(false);
        throw saveError; // Re-throw to be caught by the outer catch
      }
    } catch (error) {
      console.error('Error in handleSave:', error);
      setIsSaving(false); // Reset saving state on any error
    }
  }, [digits, isSaving, selectedCountry.code, session?.user?.email, saveProfile]);

  // Check if profile is complete (has phone number) to prevent flash during navigation
  const hasCompleteProfile = false;

  // All useEffect and useCallback hooks must be called before any conditional returns
  useEffect(() => {
    // Setup page now handles proactive redirect, so this component only needs to prevent ProfileContext interference
    if (hasCompleteProfile && !isSaving && !isRedirecting && !navigationAttemptedRef.current) {
      console.log('[ProfileSetup] Complete profile detected - setup page should have redirected already');
      
      // Set flags to prevent ProfileContext interference (belt and suspenders approach)
      setIsRedirecting(true);
      navigationAttemptedRef.current = true;
    }
  }, [hasCompleteProfile, isSaving, isRedirecting]);

  // Safety timeout to reset saving state if it gets stuck
  useEffect(() => {
    if (isSaving) {
      const timeoutId = setTimeout(() => {
        console.warn('[ProfileSetup] Save operation timeout - resetting saving state');
        setIsSaving(false);
      }, 30000); // 30 second timeout

      return () => clearTimeout(timeoutId);
    }
  }, [isSaving]);

  // Show loading state while checking auth status or loading profile
  // Don't show loading if we have a valid session but status is temporarily 'loading' due to session updates
  // ALSO skip loading for new users since we want immediate setup form
  const isNewUser = session?.isNewUser;
  const shouldSkipLoading = !!(isNewUser && sessionStatus === 'authenticated' && session);
  
  // Skip the complex loading check - just proceed to form or redirect

  // If profile is complete and we're not currently saving, show minimal loading state during redirect
  if (hasCompleteProfile && !isSaving && !isRedirecting) {
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
                  src={profile?.profileImage || session?.user?.image || '/default-avatar.png'} 
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
            <form onSubmit={handleSave} className="w-full max-w-[var(--max-content-width)] mx-auto setup-form">
              <div className="w-full space-y-4">
                <CustomPhoneInput
                  ref={phoneInputRef}
                  value={digits}
                  onChange={setDigits}
                  placeholder="Enter phone number"
                  className="w-full"
                  inputProps={{
                    className: "w-full p-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white/90",
                    required: true,
                    'aria-label': 'Phone number',
                    disabled: isSaving
                  }}
                />
                
                <Button
                  type="submit"
                  variant="theme"
                  size="lg"
                  className="w-full font-medium"
                  disabled={isSaving}
                  aria-busy={isSaving}
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
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default memo(ProfileSetup);
