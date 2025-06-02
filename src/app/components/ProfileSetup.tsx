'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { parsePhoneNumber as parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import CustomPhoneInput from './ui/CustomPhoneInput';
import { useAdminModeActivator } from './ui/AdminBanner';
import { Heading } from './ui/typography';
import { useProfile, UserProfile } from '../context/ProfileContext';
import { useFreezeScrollOnFocus } from '@/lib/utils/useFreezeScrollOnFocus';
// setupScrollLock is not used but kept for future reference
// import { setupScrollLock } from '../../lib/utils/scrollLock';
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
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      window.location.href = '/';
    },
  });
  
  // Profile and routing
  const { profile, saveProfile } = useProfile();
  const router = useRouter();
  
  // Component state
  const [isSaving, setIsSaving] = useState(false);
  const [digits, setDigits] = useState('');
  const [isLoading, setIsLoading] = useState(true);
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

  // Main initialization effect
  useEffect(() => {
    const initializeProfile = async () => {
      if (status === 'loading') {
        setIsLoading(true);
        return;
      }

      try {
        if (status === 'authenticated' && session?.user) {
          // If we have a profile, update the phone number if needed
          if (profile) {
            if (profile.contactChannels?.phoneInfo?.nationalPhone) {
              setDigits(profile.contactChannels.phoneInfo.nationalPhone);
            }
            setIsLoading(false);
          } else {
            // No profile exists, create a new one
            const userEmail = session.user.email || '';
            const profileImage = session.user.image || '/default-avatar.png';
            const emailUsername = userEmail.split('@')[0]?.toLowerCase().replace(/[^a-z0-9._-]/g, '') || '';
            
            const initialProfile: Partial<UserProfile> = {
              name: session.user.name || '',
              profileImage: profileImage,
              bio: '',
              backgroundImage: '',
              lastUpdated: Date.now(),
              contactChannels: {
                phoneInfo: {
                  internationalPhone: '',
                  nationalPhone: '',
                  userConfirmed: false
                },
                email: {
                  email: userEmail,
                  userConfirmed: true
                },
                facebook: { 
                  username: emailUsername, 
                  url: emailUsername ? `https://facebook.com/${emailUsername}` : '', 
                  userConfirmed: false 
                },
                instagram: { 
                  username: emailUsername, 
                  url: emailUsername ? `https://instagram.com/${emailUsername}` : '', 
                  userConfirmed: false 
                },
                x: { 
                  username: emailUsername, 
                  url: emailUsername ? `https://x.com/${emailUsername}` : '', 
                  userConfirmed: false 
                },
                linkedin: { 
                  username: emailUsername, 
                  url: emailUsername ? `https://linkedin.com/in/${emailUsername}` : '', 
                  userConfirmed: false 
                },
                snapchat: { 
                  username: emailUsername, 
                  url: emailUsername ? `https://snapchat.com/add/${emailUsername}` : '', 
                  userConfirmed: false 
                },
                whatsapp: { 
                  username: '', 
                  url: '', 
                  userConfirmed: false 
                },
                telegram: { 
                  username: '', 
                  url: '', 
                  userConfirmed: false 
                },
                wechat: { 
                  username: '', 
                  url: '', 
                  userConfirmed: false 
                }
              }
            };
            
            await saveProfile(initialProfile);
          }
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error in profile initialization:', error);
        setIsLoading(false);
      }
    };

    initializeProfile();
  }, [status, session, profile, saveProfile]);
  


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
        } 
        // For international numbers
        else if (cleanedDigits.length > 10) {
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
      
      // Update the profile with phone info and set as username for messaging apps
      const updatedProfile = {
        ...profile,
        contactChannels: {
          ...profile.contactChannels,
          phoneInfo: {
            internationalPhone,
            nationalPhone,
            userConfirmed: true
          },
          whatsapp: {
            ...profile.contactChannels.whatsapp,
            username: nationalPhone,
            url: `https://wa.me/${nationalPhone}`,
            userConfirmed: false
          },
          wechat: {
            ...profile.contactChannels.wechat,
            username: nationalPhone,
            url: `weixin://dl/chat?${nationalPhone}`,
            userConfirmed: false
          },
          telegram: {
            ...profile.contactChannels.telegram,
            username: nationalPhone,
            url: `https://t.me/${nationalPhone}`,
            userConfirmed: false
          }
        }
      };
      
      console.log('Saving updated profile:', JSON.stringify(updatedProfile, null, 2));
      
      try {
        await saveProfile(updatedProfile);
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

  // Handle loading and unauthenticated states
  if (status === 'loading' || isLoading || status !== 'authenticated') {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen w-full flex flex-col items-center px-4 py-6"
      style={{
        backgroundImage: profile?.backgroundImage ? `url(${profile.backgroundImage})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#004D40' // Theme background color that shows while image loads
      }}
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
