'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import CustomPhoneInput from './CustomPhoneInput';
import { useAdminModeActivator } from './AdminBanner';

// Define Country type to match CustomPhoneInput
type Country = {
  name: string;
  code: string;
  flag: string;
  dialCode: string;
};
import { useProfile, UserProfile } from '../context/ProfileContext';
import { setupScrollLock } from '../../lib/utils/scrollLock';

export default function ProfileSetup() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      window.location.href = '/';
    },
  });
  
  const { profile, saveProfile } = useProfile();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [digits, setDigits] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState<Country>({
    name: 'United States',
    code: 'US',
    flag: '🇺🇸',
    dialCode: '1'
  });
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const adminModeProps = useAdminModeActivator();

  // Basic scroll behavior for mobile
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    // Handle input focus to ensure it's visible
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      // Small delay to ensure the keyboard is shown
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

  // Initialize profile on first load if it doesn't exist
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      setIsLoading(false);
      
      if (!profile) {
      const userEmail = session.user.email || '';
      
      // Create initial profile with all required fields
      const initialProfile = {
        name: session.user.name || '',
        profileImage: session.user.image || '',
        bio: '',
        backgroundImage: '/gradient-bg.jpg',
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
          facebook: { username: '', url: '', userConfirmed: false },
          instagram: { username: '', url: '', userConfirmed: false },
          x: { username: '', url: '', userConfirmed: false },
          whatsapp: { username: '', url: '', userConfirmed: false },
          snapchat: { username: '', url: '', userConfirmed: false },
          telegram: { username: '', url: '', userConfirmed: false },
          wechat: { username: '', url: '', userConfirmed: false },
          linkedin: { username: '', url: '', userConfirmed: false }
        }
      };
      
        saveProfile(initialProfile);
      }
    } else {
      setIsLoading(false);
    }
  }, [status, session, profile, saveProfile]);
  
  // Load phone number if it exists in the profile
  useEffect(() => {
    if (profile?.contactChannels?.phoneInfo?.nationalPhone) {
      setDigits(profile.contactChannels.phoneInfo.nationalPhone);
    }
  }, [profile]);
  
  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-12 h-12 border-4 border-gray-200 rounded-full border-t-green-600 animate-spin"></div>
      </div>
    );
  }

  // Handle saving the profile with phone number
  const handleSave = async () => {
    if (!session?.user?.email || !profile) return;
    
    setIsSaving(true);
    
    try {
      let internationalPhone = '';
      let nationalPhone = digits;
      
      // Format phone number if digits are provided
      if (digits) {
        const countryCode = selectedCountry?.code as any;
        const parsed = parsePhoneNumberFromString(digits, countryCode);
        if (parsed?.isValid()) {
          internationalPhone = parsed.format('E.164');
          nationalPhone = parsed.nationalNumber;
        } else {
          // Fallback to just the digits if parsing fails
          nationalPhone = digits;
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
            userConfirmed: false
          },
          wechat: {
            ...profile.contactChannels.wechat,
            username: nationalPhone,
            userConfirmed: false
          },
          telegram: {
            ...profile.contactChannels.telegram,
            username: nationalPhone,
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
  };

  return (
    <div 
      className="min-h-screen flex flex-col items-center px-4 py-6"
      style={{
        backgroundImage: 'url(/gradient-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="w-full max-w-md flex flex-col items-center">
        {/* Profile Image */}
        <div className="mb-4">
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg bg-white">
            {profile?.profileImage ? (
              <img 
                src={profile.profileImage} 
                alt={profile.name || 'Profile'} 
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.src = '/default-avatar.png';
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-white">
                <div className="w-16 h-16 rounded-full bg-gray-100"></div>
              </div>
            )}
          </div>
        </div>
        
        {/* Profile Name */}
        <h1 className="text-2xl font-bold mb-6 text-center text-black">
          {profile?.name || session?.user?.name || 'Profile'}
        </h1>
        
        {/* Phone Input */}
        <div className="w-full max-w-xs space-y-4">
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
            className={`w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-full shadow-md transition-colors ${
              isSaving ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
