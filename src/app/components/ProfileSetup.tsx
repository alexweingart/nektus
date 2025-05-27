'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import CustomPhoneInput from './CustomPhoneInput';

// Define Country type to match CustomPhoneInput
type Country = {
  name: string;
  code: string;
  flag: string;
  dialCode: string;
};
import { useProfile } from '../context/ProfileContext';

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

  // Initialize profile on first load if it doesn't exist
  useEffect(() => {
    if (status === 'authenticated' && session?.user && !profile) {
      const userEmail = session.user.email || '';
      
      // Create initial profile with just the essential information
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
          // Initialize empty social channels
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
      
      // Update the profile with phone info
      const updatedProfile = {
        ...profile,
        contactChannels: {
          ...profile.contactChannels,
          phoneInfo: {
            internationalPhone,
            nationalPhone,
            userConfirmed: true
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
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Complete Your Profile</h1>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <CustomPhoneInput
              ref={phoneInputRef}
              value={digits}
              onChange={setDigits}
              placeholder="Enter phone number"
              className="w-full"
            />
          </div>
          
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isSaving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
