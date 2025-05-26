'use client';

import * as React from 'react';
const { useState, useEffect, useMemo } = React;
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import CustomPhoneInput from './CustomPhoneInput';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { 
  FaWhatsapp, 
  FaTelegram, 
  FaFacebook, 
  FaInstagram, 
  FaTwitter, 
  FaSnapchat, 
  FaLinkedin, 
  FaPhone,
  FaEnvelope,
  FaChevronDown,
  FaChevronUp
} from 'react-icons/fa';
import { MdEdit } from 'react-icons/md';
import { useProfile, SocialProfile as ProfileSocialProfile } from '../context/ProfileContext';

// Extended social profile type with additional properties for UI state
type SocialProfile = Omit<ProfileSocialProfile, 'platform'> & {
  platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'snapchat' | 'whatsapp' | 'telegram' | 'email' | 'phone';
  confirmed?: boolean;
  autoFilled?: boolean;
};

export default function ProfileSetup() {
  // Use session with required: true for faster loading
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      // Use direct navigation for faster redirect
      window.location.href = '/';
    },
  });
  const { profile, isLoading, saveProfile } = useProfile();
  const router = useRouter();
  
  // State management
  const [isSaving, setIsSaving] = useState(false);
  const [digits, setDigits] = useState('');  // National digits only (no country code)
  const [country, setCountry] = useState<'US' | 'CA' | 'GB' | 'AU' | 'DE' | 'FR' | 'IN'>('US');
  const [showSocialSettings, setShowSocialSettings] = useState(false);
  const [socialProfiles, setSocialProfiles] = useState<SocialProfile[]>([]);
  const [editingSocial, setEditingSocial] = useState<SocialProfile['platform'] | null>(null);
  const [socialEditValue, setSocialEditValue] = useState('');
  
  // Create a ref for the phone input
  const phoneInputRef = React.useRef<HTMLInputElement>(null);
  
  // Use ref for extracted username to avoid re-renders
  const extractedUsernameRef = React.useRef<string>('');
  
  // Auto-focus phone input after Google OAuth redirect
  useEffect(() => {
    // Only try if we set the flag before redirect
    if (!sessionStorage.getItem("wantsPhoneFocus")) return;
    sessionStorage.removeItem("wantsPhoneFocus");
    
    requestAnimationFrame(() => {
      // 1 — put focus on the phone input
      if (phoneInputRef.current) {
        phoneInputRef.current.focus({ preventScroll: true });
        
        // 2 — on modern Chrome/Edge Android, explicitly ask for the keyboard
        // Using the VirtualKeyboard API (available in Chrome 93+)
        if ('virtualKeyboard' in navigator && 
            typeof (navigator as any).virtualKeyboard?.show === 'function') {
          (navigator as any).virtualKeyboard.show();
        }
      }
    });
  }, []);

  // Memoized platform order
  const platformOrder = useMemo<SocialProfile['platform'][]>(() => 
    ['email', 'phone', 'facebook', 'instagram', 'twitter', 'snapchat', 'linkedin', 'whatsapp', 'telegram'], 
  []);

  // Initialize social profiles with email always confirmed (green)
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const userEmail = session.user.email || '';
      extractedUsernameRef.current = userEmail.split('@')[0] || '';
      
      // Email is immediately confirmed (green)
      setSocialProfiles([{
        platform: 'email',
        username: userEmail,
        shareEnabled: true,
        filled: true,
        confirmed: true
      }]);
    }
  }, []); // Empty dependency array - run only once on mount
  
  // Load profile data and initialize social profiles
  useEffect(() => {
    if (!isLoading) {
      const loadAndInitialize = async () => {
        try {
          // Start with current profiles (including email which is already confirmed)
          const updatedProfiles = [...socialProfiles];
          
          // Add default social profiles if they don't exist yet
          if (extractedUsernameRef.current && !updatedProfiles.find(p => p.platform === 'instagram')) {
            // Add all social platforms in grey (empty) state
            platformOrder.forEach(platform => {
              if (platform !== 'email' && !updatedProfiles.find(p => p.platform === platform)) {
                updatedProfiles.push({
                  platform,
                  username: platform === 'phone' ? '' : extractedUsernameRef.current,
                  shareEnabled: true,
                  filled: false,
                  confirmed: false,
                  autoFilled: false
                });
              }
            });
          }
          
          // Handle existing profile data if available
          if (profile) {
            if (profile.phone) {
              const parsed = parsePhoneNumberFromString(profile.phone, country);
              if (parsed?.isValid()) {
                // Update state with detected country and national digits
                setDigits(parsed.nationalNumber);
              }
            }
            
            if (profile.socialProfiles && profile.socialProfiles.length > 0) {
              // Merge existing profiles with our initialized ones
              profile.socialProfiles.forEach(existingProfile => {
                const index = updatedProfiles.findIndex(p => p.platform === existingProfile.platform);
                if (index >= 0) {
                  updatedProfiles[index] = {
                    ...existingProfile,
                    confirmed: existingProfile.filled
                  } as SocialProfile;
                } else {
                  updatedProfiles.push({
                    ...existingProfile,
                    confirmed: existingProfile.filled
                  } as SocialProfile);
                }
              });
            }
          }
          
          setSocialProfiles(updatedProfiles);
        } catch (error) {
          console.error('Error initializing profile:', error);
        }
      };
      
      loadAndInitialize();
    }
  }, [isLoading, profile, platformOrder, socialProfiles]);
  
  // Update social profiles when phone number is complete
  useEffect(() => {
    if (digits && digits.length >= 6) {
      updateProfilesWithPhone(digits);
    }
  }, [digits]);

  // Phone input now handled directly by the PhoneInput component's onChange callback
  
  // Update profiles with phone number
  const updateProfilesWithPhone = (phoneNumber: string) => {
    if (phoneNumber.length >= 10) {
      // Make a copy of profiles to update
      const updatedProfiles = [...socialProfiles];
      
      // First confirm the phone number profile
      const phoneIndex = updatedProfiles.findIndex(p => p.platform === 'phone');
      if (phoneIndex >= 0) {
        updatedProfiles[phoneIndex] = {
          ...updatedProfiles[phoneIndex],
          username: phoneNumber,
          filled: true,
          confirmed: true,
          autoFilled: false
        };
      } else {
        updatedProfiles.push({
          platform: 'phone',
          username: phoneNumber,
          shareEnabled: true,
          filled: true,
          confirmed: true,
          autoFilled: false
        });
      }
      
      // Auto-fill all other profiles with light green
      ['whatsapp', 'telegram', 'facebook', 'instagram', 'twitter', 'linkedin', 'snapchat'].forEach(platform => {
        const index = updatedProfiles.findIndex(p => p.platform === platform as SocialProfile['platform']);
        let value = extractedUsernameRef.current;
        
        // For messaging platforms, use phone number
        if (platform === 'whatsapp' || platform === 'telegram') {
          value = phoneNumber;
        }
        
        if (index >= 0) {
          // Only auto-fill if not already confirmed
          if (!updatedProfiles[index].confirmed) {
            updatedProfiles[index] = {
              ...updatedProfiles[index],
              username: value,
              filled: true,
              autoFilled: true
            };
          }
        } else {
          updatedProfiles.push({
            platform: platform as SocialProfile['platform'],
            username: value,
            shareEnabled: true,
            filled: true,
            autoFilled: true
          });
        }
      });
      
      setSocialProfiles(updatedProfiles);
    }
  };
  
  // Handle editing social profile
  const handleEditSocial = (platform: SocialProfile['platform']) => {
    const profile = socialProfiles.find(p => p.platform === platform);
    setEditingSocial(platform);
    setSocialEditValue(profile?.username || '');
  };
  
  // Save edited social profile
  const handleSaveSocialEdit = () => {
    if (editingSocial) {
      const updatedProfiles = socialProfiles.map(profile => {
        if (profile.platform === editingSocial) {
          return { 
            ...profile, 
            username: socialEditValue, 
            filled: !!socialEditValue,
            confirmed: !!socialEditValue,
            autoFilled: false
          };
        }
        return profile;
      });
      
      setSocialProfiles(updatedProfiles);
      setEditingSocial(null);
      setSocialEditValue('');
    }
  };
  
  // Handle key press in input fields
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (editingSocial) {
        handleSaveSocialEdit();
      } else {
        handleSave();
      }
    }
  };
  
  // Get the URL prefix for a social platform
  const getSocialPrefix = (platform: SocialProfile['platform']) => {
    switch (platform) {
      case 'facebook':
        return 'facebook.com/';
      case 'instagram':
        return 'instagram.com/';
      case 'twitter':
        return 'twitter.com/';
      case 'snapchat':
        return 'snapchat.com/add/';
      case 'linkedin':
        return 'linkedin.com/in/';
      case 'whatsapp':
        return '+'; // WhatsApp uses phone numbers
      case 'telegram':
        return 't.me/'; // Telegram username
      case 'email':
        return '';
      case 'phone':
        return '+';
      default:
        return '';
    }
  };
  
  // Handle saving data with ultra-fast navigation first approach
  const handleSave = () => {
    try {
      // Filter out email and phone profiles and convert to the expected format
      const profilesForSaving = socialProfiles
        .filter(p => p.platform !== 'email' && p.platform !== 'phone')
        .map(({ platform, username, shareEnabled, filled }) => ({
          platform,
          username,
          shareEnabled,
          filled
        })) as ProfileSocialProfile[];
      
      // Convert national phone number to E.164 format
      const parsed = parsePhoneNumberFromString(digits, country);
      if (!parsed?.isValid()) { 
        alert('Invalid phone number'); 
        return; 
      }
      
      const fullNumber = parsed.number; // e.g. +18182926036
      
      // Create profile data structure
      const profileData = {
        phone: fullNumber,
        socialProfiles: profilesForSaving
      };
      
      // STEP 1: Store data in localStorage for immediate access
      if (session?.user?.email) {
        const cachedProfile = {
          userId: session.user.email,
          name: session.user.name || '',
          email: session.user.email,
          picture: session.user.image || '',
          phone: fullNumber,
          socialProfiles: profilesForSaving,
          lastUpdated: Date.now(),
        };
        localStorage.setItem('nektus_user_profile_cache', JSON.stringify(cachedProfile));
      }
      
      // STEP 2: Navigate to profile page immediately - without waiting for Firebase
      router.push('/');
      
      // STEP 3: After navigation has started, save to Firebase in the background
      // This happens after the user has already navigated away
      setTimeout(() => {
        saveProfile(profileData).catch(error => {
          console.error('Background profile save error:', error);
        });
      }, 100);
      
    } catch (error: any) {
      console.error('Error during save process:', error);
      alert('There was an error saving your profile. Please try again.');
    }
  };

  // If no session, return null (redirect is handled by useSession)
  if (!session && status !== 'loading') {
    return null;
  }

  return (
    <form
      className="max-w-md mx-auto p-6"
      autoComplete="on"
      onSubmit={(e) => { e.preventDefault(); handleSave(); }}
    >
      {/* Profile Photo and Name */}
      <div className="text-center mb-8">
        {session?.user?.image ? (
          <div className="w-28 h-28 mx-auto mb-4 rounded-full overflow-hidden shadow-md">
            <img 
              src={session.user.image} 
              alt={session.user?.name || 'Profile'} 
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-28 h-28 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <span className="text-2xl font-semibold">{session?.user?.name?.[0] || '?'}</span>
          </div>
        )}
        <h2 className="text-2xl font-semibold" style={{ color: '#2d3748' }}>{session?.user?.name}</h2>
      </div>
      

      
      {/* Custom Phone Input Component */}
      <div className="mb-8">
        <div>
          <label htmlFor="phone-input" className="sr-only">Phone number</label>
          <CustomPhoneInput
            onChange={(value) => {
              setDigits(value);
              updateProfilesWithPhone(value);
            }}
            value={digits}
            placeholder="Enter phone number"
            ref={phoneInputRef}
            inputProps={{
              id: "phone-input",
              autoFocus: true, // helps on Android ≤122 & Firefox
              autoComplete: "tel"
            }}
          />
        </div>
      </div>
      

      
      {/* Save Button */}
      <button 
        type="submit"
        disabled={isSaving}
        className="w-full py-3 px-4 bg-primary text-white rounded-full font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
      >
        {isSaving ? (
          <>
            <div className="inline-block mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Saving...
          </>
        ) : 'Save'}
      </button>
    </form>
  );
}
