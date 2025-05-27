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

  // Set up scroll lock for mobile keyboard
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    if (isIOS) {
      // Add iOS-specific class to body
      document.body.classList.add('ios-device');
      
      // Check if iOS 18+
      const isIOS18Plus = CSS.supports('color', 'light-dark(red, red)');
      
      // Store the current viewport height
      const setViewportHeight = () => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
      };
      
      // Set initial viewport height
      setViewportHeight();
      
      // Lock the viewport height to prevent resizing
      const lockViewportHeight = () => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
        document.documentElement.style.height = `${window.innerHeight}px`;
      };
      
      // Handle input focus/blur for iOS 18+
      const handleFocus = (e: FocusEvent) => {
        if (isIOS18Plus) {
          e.preventDefault();
          const target = e.target as HTMLElement;
          
          // Lock the viewport height when input is focused
          lockViewportHeight();
          
          // Scroll the input into view
          setTimeout(() => {
            target.scrollIntoView({ 
              behavior: 'instant', 
              block: 'center', 
              inline: 'nearest' 
            });
          }, 100);
        }
      };
      
      // Add event listeners for all inputs
      const inputs = document.querySelectorAll('input, textarea, [contenteditable]');
      inputs.forEach(input => {
        input.addEventListener('focus', handleFocus as EventListener);
      });
      
      // Lock viewport on orientation change
      const handleOrientationChange = () => {
        lockViewportHeight();
      };
      
      // Add event listeners
      window.addEventListener('resize', lockViewportHeight);
      window.addEventListener('orientationchange', handleOrientationChange);
      
      // Setup scroll lock with a small delay
      const timer = setTimeout(() => {
        const cleanup = setupScrollLock();
        
        // Add keyboard detection using visualViewport API if available
        const handleResize = () => {
          setViewportHeight();
          const windowHeight = window.innerHeight;
          const visualViewportHeight = window.visualViewport?.height || windowHeight;
          const isKeyboardVisible = visualViewportHeight < windowHeight * 0.8;
          
          if (isKeyboardVisible) {
            document.body.classList.add('ios-keyboard-visible');
            // Scroll the active element into view for non-iOS 18
            if (!isIOS18Plus && document.activeElement) {
              document.activeElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
              });
            }
          } else {
            document.body.classList.remove('ios-keyboard-visible');
          }
        };
        
        // Use visualViewport API if available for more accurate detection
        if (window.visualViewport) {
          window.visualViewport.addEventListener('resize', handleResize);
        } else {
          window.addEventListener('resize', handleResize);
        }
        
        // Clean up when component unmounts
        return () => {
          cleanup();
          window.removeEventListener('resize', lockViewportHeight);
          window.removeEventListener('orientationchange', handleOrientationChange);
          
          if (window.visualViewport) {
            window.visualViewport.removeEventListener('resize', handleResize);
          } else {
            window.removeEventListener('resize', handleResize);
          }
          
          inputs.forEach(input => {
            input.removeEventListener('focus', handleFocus as EventListener);
          });
          
          // Reset styles
          document.body.classList.remove('ios-device', 'ios-keyboard-visible');
          document.documentElement.style.height = '';
        };
      }, 100);
      
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', lockViewportHeight);
        window.removeEventListener('orientationchange', handleOrientationChange);
      };
    }
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
    <div className="ios-scroll-container">
      <div className="min-h-screen w-full flex flex-col items-center py-6 px-4 bg-background">
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
