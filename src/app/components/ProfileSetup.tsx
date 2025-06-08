'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/Button';
import { parsePhoneNumber as parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import CustomPhoneInput from './ui/CustomPhoneInput';
import { useAdminModeActivator } from './ui/AdminBanner';
import { Heading } from './ui/Typography';
import { useProfile } from '../context/ProfileContext';
import type { UserProfile } from '@/types/profile';
import { useFreezeScrollOnFocus } from '@/lib/utils/useFreezeScrollOnFocus';
import Avatar from './ui/Avatar';
import { LoadingSpinner } from './ui/LoadingSpinner';

// Define Country type to match CustomPhoneInput
type Country = {
  name: string;
  code: string;
  flag: string;
  dialCode: string;
};

export default function ProfileSetup() {
  // Session and authentication
  const { data: session, status: sessionStatus } = useSession({
    required: true,
  });
  
  // Profile and routing
  const { profile, saveProfile, isLoading, getLatestProfile } = useProfile();
  const router = useRouter();
  
  // Component state
  const [isSaving, setIsSaving] = useState(false);
  const [digits, setDigits] = useState('');
  
  // Keep selectedCountry for phone number formatting
  const [selectedCountry] = useState<Country>({
    name: 'United States',
    code: 'US',
    flag: '🇺🇸',
    dialCode: '1'
  });
  // Refs
  const phoneInputRef = useRef<HTMLInputElement>(null);
  // freeze auto-scroll on focus
  useFreezeScrollOnFocus(phoneInputRef);
  // Admin mode
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
    
    if (!profile) {
      console.error('Cannot save: No profile data');
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
      console.log('Current profile bio before phone save:', profile?.bio);
      console.log('Current profile state:', { 
        hasBio: !!profile?.bio, 
        bioLength: profile?.bio?.length || 0,
        bioPreview: profile?.bio?.substring(0, 50) || 'NO BIO'
      });
      
      // Get the most up-to-date profile data (including any background-generated bio)
      const latestProfile = getLatestProfile() || profile;
      console.log('Latest profile bio:', latestProfile?.bio);
      console.log('Latest profile state:', { 
        hasBio: !!latestProfile?.bio, 
        bioLength: latestProfile?.bio?.length || 0,
        bioPreview: latestProfile?.bio?.substring(0, 50) || 'NO BIO'
      });
      
      // Only update phone-related fields, preserve all other profile data (including bio)
      const phoneUpdateData = {
        // Explicitly preserve bio if it exists
        ...(latestProfile?.bio ? { bio: latestProfile.bio } : {}),
        contactChannels: {
          ...(latestProfile?.contactChannels || {}), // Preserve existing contact channels
          phoneInfo: {
            internationalPhone,
            nationalPhone,
            userConfirmed: true // Explicitly set to true when user saves the form
          },
          whatsapp: {
            ...(latestProfile?.contactChannels?.whatsapp || {}),
            username: nationalPhone,
            url: `https://wa.me/${nationalPhone}`,
            userConfirmed: false
          },
          wechat: {
            ...(latestProfile?.contactChannels?.wechat || {}),
            username: nationalPhone,
            url: `weixin://dl/chat?${nationalPhone}`,
            userConfirmed: false
          },
          telegram: {
            ...(latestProfile?.contactChannels?.telegram || {}),
            username: nationalPhone,
            url: `https://t.me/${nationalPhone}`,
            userConfirmed: false
          }
        }
      };
      
      console.log('Saving phone update data:', JSON.stringify(phoneUpdateData, null, 2));
      
      try {
        // Small delay to ensure any background bio save completes first
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Save only the phone-related fields (preserves bio and other data)
        await saveProfile(phoneUpdateData);
        console.log('Profile saved successfully');
        router.push('/');
      } catch (saveError) {
        console.error('Error in saveProfile call:', saveError);
        throw saveError; // Re-throw to be caught by the outer catch
      }
    } catch (error) {
      console.error('Error in handleSave:', error);
    } finally {
      console.log('=== Save process completed ===');
      setIsSaving(false);
    }
  }, [digits, isSaving, profile, saveProfile, router, selectedCountry.code, session?.user?.email]);

  // Show loading state while checking auth status or loading profile
  if (sessionStatus === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  // Get the latest profile including streaming background image
  const currentProfile = getLatestProfile() || profile;

  // Check if profile is complete (has phone number) to prevent flash during navigation
  const hasCompleteProfile = currentProfile?.contactChannels?.phoneInfo?.internationalPhone && 
                            currentProfile.contactChannels.phoneInfo.internationalPhone.trim() !== '';

  // If profile is complete and we're not currently saving, show minimal loading state to prevent flash
  if (hasCompleteProfile && !isSaving) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen w-full flex flex-col items-center px-4 py-6"
    >
      {/* Main Content */}
      <div className="w-full max-w-[var(--max-content-width)] flex flex-col items-center px-4">
        <div className="w-full max-w-[var(--max-content-width)] flex flex-col items-center">
          {/* Profile Image */}
          <div className="mb-4">
            <div className="border-4 border-white shadow-lg rounded-full">
              <Avatar 
                src={profile?.profileImage || session?.user?.image || '/default-avatar.png'} 
                alt={profile?.name || session?.user?.name || 'Profile'}
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
              {profile?.name || session?.user?.name || 'Profile'}
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
  );
}
