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
  const [selectedCountry, setSelectedCountry] = useState<Country>({
    name: 'United States',
    code: 'US',
    flag: '🇺🇸',
    dialCode: '1'
  });
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const adminModeProps = useAdminModeActivator();

  // Set up scroll lock for mobile keyboard - more aggressive approach
  useEffect(() => {
    // Add a small delay to ensure the component is fully mounted
    const timer = setTimeout(() => {
      const cleanup = setupScrollLock();
      // Also lock scroll immediately if we're on a mobile device
      if (typeof window !== 'undefined' && window.innerWidth <= 768) {
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        document.body.style.height = '100%';
      }
      return () => {
        cleanup();
        // Clean up styles when component unmounts
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.height = '';
      };
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Initialize profile on first load if it doesn't exist
  useEffect(() => {
    if (status === 'authenticated' && session?.user && !profile) {
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
  }, [status, session, profile, saveProfile]);
  
  // Load phone number if it exists in the profile
  useEffect(() => {
    if (profile?.contactChannels?.phoneInfo?.nationalPhone) {
      setDigits(profile.contactChannels.phoneInfo.nationalPhone);
    }
  }, [profile]);

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
    <div className="fixed inset-0 w-full h-full bg-background overflow-y-auto">
      <div className="min-h-full w-full flex flex-col items-center py-6 px-4">
        <div className="w-full max-w-[320px] mx-auto flex flex-col items-center">
          {/* Profile Picture - Fixed height container */}
          <div className="relative mb-4 h-24">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-white shadow-md">
              {profile?.profileImage && (
                <img 
                  src={profile.profileImage} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          </div>
          
          {/* User's Name - Fixed height container with reduced bottom margin */}
          <div className="min-h-[2.5rem] mb-4 w-full">
            {profile?.name && (
              <h1 
                className="text-2xl font-bold text-center text-black cursor-pointer"
                {...adminModeProps}
              >
                {profile.name}
              </h1>
            )}
          </div>
          
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
              className={`btn-primary w-full ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
