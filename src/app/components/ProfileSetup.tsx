'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { parsePhoneNumber as parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import CustomPhoneInput from './ui/CustomPhoneInput';
import { useAdminModeActivator } from './ui/AdminBanner';
import { useProfile, UserProfile } from '../context/ProfileContext';
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
  
  // Admin mode
  const adminModeProps = useAdminModeActivator();

  // Handle scroll behavior for mobile
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      setTimeout(() => {
        target.scrollIntoView({ 
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest' 
        });
      }, 100);
    };
    
    // Add event listeners for all inputs
    const inputs = document.querySelectorAll('input, textarea, [contenteditable]');
    inputs.forEach(input => {
      input.addEventListener('focus', handleFocus as EventListener);
    });
    
    // Clean up event listeners
    return () => {
      inputs.forEach(input => {
        input.removeEventListener('focus', handleFocus as EventListener);
      });
    };
  }, []);

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
  const handleSave = useCallback(async () => {
    if (!session?.user?.email || !profile || isSaving) return;
    
    setIsSaving(true);
    
    try {
      let nationalPhone = '';
      let internationalPhone = '';
      
      // Format phone number if digits are provided
      if (digits) {
        const countryCode = selectedCountry?.code as CountryCode | undefined;
        const parsed = parsePhoneNumberFromString(digits, { defaultCountry: countryCode });
        
        if (parsed?.isValid()) {
          internationalPhone = parsed.format('E.164');
          nationalPhone = parsed.nationalNumber;
        } else {
          console.error('Invalid phone number');
          return;
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
      
      await saveProfile(updatedProfile);
      router.push('/');
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setIsSaving(false);
    }
  }, [digits, isSaving, profile, saveProfile, router, selectedCountry.code, session?.user?.email]);

  // Handle loading and unauthenticated states
  if (status === 'loading' || isLoading || status !== 'authenticated') {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#f4f9f4]">
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
        backgroundColor: '#f4f9f4'
      }}
    >
      <div className="w-full max-w-md flex flex-col items-center">
        {/* Profile Image */}
        <div className="mb-4">
          <div className="border-4 border-white shadow-lg rounded-full">
            <Avatar 
              src={profile?.profileImage} 
              alt={profile?.name || 'Profile'}
              size="lg"
            />
          </div>
        </div>
        
        {/* Profile Name - Double click to activate admin mode */}
        <h1 
          className="text-2xl font-bold mb-1 text-center text-black cursor-pointer" 
          {...adminModeProps}
        >
          {profile?.name || session?.user?.name || 'Profile'}
        </h1>
        
        {/* Phone Input Section */}
        <div className="mb-8 w-full max-w-xs mx-auto">
          <div className="w-full space-y-4">
            <label className="sr-only">Phone Number</label>
            <CustomPhoneInput
              ref={phoneInputRef}
              value={digits}
              onChange={setDigits}
              placeholder="Enter phone number"
              className="w-full"
              inputProps={{
                className: "w-full p-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              }}
            />
            
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-full shadow-md transition-colors ${
                isSaving ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
