'use client';

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/Button';
import { parsePhoneNumber as parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import CustomPhoneInput from './ui/CustomPhoneInput';
import { useAdminModeActivator } from './ui/AdminBanner';
import { Heading } from './ui/Typography';
import { useFreezeScrollOnFocus } from '@/lib/utils/useFreezeScrollOnFocus';
import Avatar from './ui/Avatar';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { useProfile } from '../context/ProfileContext'; // Import useProfile hook
import type { UserProfile } from '@/types/profile';

// Define Country type to match CustomPhoneInput
type Country = {
  name: string;
  code: string;
  flag: string;
  dialCode: string;
};

function ProfileSetup() {
  console.log('[ProfileSetup] Component rendering started');
  
  // Session and authentication
  const { data: session, status: sessionStatus } = useSession({
    required: true,
  });
  
  console.log('[ProfileSetup] useSession result:', { sessionStatus, hasSession: !!session });
  
  // Minimal ProfileContext subscription - only for saveProfile function
  const { saveProfile } = useProfile();
  const router = useRouter();
  
  console.log('[ProfileSetup] useProfile result:', { hasSaveProfile: !!saveProfile });
  
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
    console.log('=== Starting save process ===');
    console.log('Raw digits from input:', digits);
    
    if (!session?.user?.email) {
      console.error('Cannot save: No user session');
      return;
    }
    
    if (isSaving) {
      console.log('Save already in progress');
      return;
    }
    
    console.log('Starting save process...');
    setIsSaving(true);
    
    try {
      let nationalPhone = '';
      let internationalPhone = '';
      
      // Format phone number if digits are provided
      if (digits) {
        // Clean the digits to remove any non-numeric characters
        const cleanedDigits = digits.replace(/\D/g, '');
        console.log('Cleaned digits:', cleanedDigits);
        
        // For US/Canada numbers (10 digits or 11 digits starting with 1)
        if (cleanedDigits.length === 10 || (cleanedDigits.length === 11 && cleanedDigits.startsWith('1'))) {
          console.log('Processing as US/Canada number');
          const nationalNum = cleanedDigits.length === 11 ? cleanedDigits.slice(1) : cleanedDigits;
          internationalPhone = `+1${nationalNum}`; // E.164 format for US/Canada
          nationalPhone = nationalNum;
          console.log('US/Canada - National:', nationalPhone, 'International:', internationalPhone);
        } else if (cleanedDigits.length > 10) {
          console.log('Processing as international number');
          // Try to parse with country code
          const countryCode = selectedCountry?.code as CountryCode | undefined;
          console.log('Using country code for parsing:', countryCode);
          const parsed = parsePhoneNumberFromString(`+${cleanedDigits}`, { defaultCountry: countryCode });
          
          if (parsed?.isValid()) {
            internationalPhone = parsed.format('E.164');
            nationalPhone = parsed.nationalNumber;
            console.log('Valid international number - National:', nationalPhone, 'International:', internationalPhone);
          } else {
            // If parsing fails, just use the raw digits
            console.warn('Could not parse international number, using raw digits');
            internationalPhone = `+${cleanedDigits}`;
            nationalPhone = cleanedDigits;
            console.log('Fallback - National:', nationalPhone, 'International:', internationalPhone);
          }
        } else {
          // For numbers that are too short to be valid, just use them as is
          console.log('Number too short, using as is');
          internationalPhone = `+${cleanedDigits}`;
          nationalPhone = cleanedDigits;
          console.log('Short number - National:', nationalPhone, 'International:', internationalPhone);
        }
      }
      
      console.log('Saving phone info:', { internationalPhone, nationalPhone });
      
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
      
      console.log('Saving phone update data:', JSON.stringify(phoneUpdateData, null, 2));
      
      try {
        // Save only the phone-related fields (preserves bio and other data)
        const updatedProfile = await saveProfile(phoneUpdateData);
        
        if (updatedProfile) {
          console.log('Profile saved successfully');
          console.log('=== Navigating to profile page ===');
          
          // Navigate immediately without resetting saving state
          router.push('/');
          return; // Exit early, don't reset isSaving
        } else {
          throw new Error('Failed to save profile - no updated profile returned');
        }
      } catch (saveError) {
        console.error('Error in saveProfile call:', saveError);
        // Only reset saving state on error
        setIsSaving(false);
        throw saveError; // Re-throw to be caught by the outer catch
      }
    } catch (error) {
      console.error('Error in handleSave:', error);
      setIsSaving(false); // Reset saving state on any error
    }
    
    console.log('=== Save process completed ===');
    // Don't reset isSaving here - either we navigated or hit an error
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

  // Show loading state while checking auth status or loading profile
  // Don't show loading if we have a valid session but status is temporarily 'loading' due to session updates
  // ALSO skip loading for new users since we want immediate setup form
  const isNewUser = session?.isNewUser;
  const shouldSkipLoading = !!(isNewUser && sessionStatus === 'authenticated' && session);
  
  console.log('[ProfileSetup] Loading check:', {
    sessionStatus,
    hasSession: !!session,
    isNewUser,
    shouldSkipLoading,
    willShowSpinner: ((sessionStatus === 'loading' && !session) || false) && !shouldSkipLoading
  });
  
  if (((sessionStatus === 'loading' && !session) || false) && !shouldSkipLoading) {
    console.log('[ProfileSetup] Showing loading spinner:', { 
      sessionStatus, 
      hasSession: !!session, 
      isNewUser,
      shouldSkipLoading 
    });
    
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  // If profile is complete and we're not currently saving, show minimal loading state during redirect
  if (hasCompleteProfile && !isSaving && !isRedirecting) {
    console.log('[ProfileSetup] Showing loading spinner for complete profile redirect:', {
      hasCompleteProfile,
      isSaving,
      isRedirecting
    });
    
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  console.log('[ProfileSetup] Rendering setup form:', {
    hasCompleteProfile,
    isSaving,
    isRedirecting,
    isNewUser: session?.isNewUser
  });

  return (
    <div 
      className="h-screen flex flex-col items-center px-4 py-8 overflow-hidden"
    >
      {/* DEBUG: Make it obvious this is ProfileSetup */}
      <div className="fixed top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs z-50">
        PROFILE SETUP
      </div>
      
      <div className="w-full max-w-[var(--max-content-width,448px)] text-center flex-1 flex flex-col justify-center">
        {/* Main Content */}
        <div className="w-full max-w-[var(--max-content-width)] flex flex-col items-center px-4">
          <div className="w-full max-w-[var(--max-content-width)] flex flex-col items-center">
            {/* Profile Image */}
            <div className="mb-4">
              <div className="border-4 border-white shadow-lg rounded-full">
                <Avatar 
                  src={session?.user?.image || '/default-avatar.png'} 
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
    </div>
  );
}

export default memo(ProfileSetup);
