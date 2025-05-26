'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useProfile, SocialProfile as ProfileSocialProfile } from '../context/ProfileContext';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import CustomPhoneInput from './CustomPhoneInput';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import SocialIcon from './SocialIcon';
import { MdEdit } from 'react-icons/md';

// Use the SocialProfile type from ProfileContext
type SocialProfile = ProfileSocialProfile;

type UserProfile = {
  userId: string;
  name: string;
  email: string;
  picture: string;
  phone: string;
  country?: string;
  socialProfiles: SocialProfile[];
  backgroundImage?: string;
  lastUpdated?: any;
};

const EditProfile: React.FC = () => {
  const { data: session } = useSession();
  const { profile, saveProfile } = useProfile();
  const router = useRouter();
  const nameInputRef = useRef<HTMLInputElement>(null);
  
  // State for form data
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    phone: string;
    picture: string;
    socialProfiles: SocialProfile[];
    backgroundImage: string;
  }>({
    name: '',
    email: '',
    phone: '',
    picture: '',
    socialProfiles: [],
    backgroundImage: '/gradient-bg.jpg',
  });
  
  const [digits, setDigits] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<'US' | 'CA' | 'GB' | 'AU' | 'DE' | 'FR' | 'IN'>('US');
  const [isSaving, setIsSaving] = useState(false);
  
  // Load profile data
  useEffect(() => {
    // First try to load from localStorage for immediate display
    try {
      const cachedProfile = localStorage.getItem('nektus_user_profile_cache');
      if (cachedProfile) {
        const parsedProfile = JSON.parse(cachedProfile);
        console.log('Loading profile data from localStorage:', parsedProfile);
        initializeFormData(parsedProfile);
      }
    } catch (err) {
      console.log('Error reading from localStorage cache:', err);
    }
    
    // Then load from profile context (which might be more up-to-date)
    if (profile) {
      console.log('Loading profile data from context:', profile);
      initializeFormData(profile);
    }
  }, [profile]);
  
  // Helper function to initialize form data from profile
  const initializeFormData = (profileData: any) => {
    // Initialize form data with profile data
    setFormData({
      name: profileData.name || '',
      email: profileData.email || '',
      phone: profileData.phone || '',
      picture: profileData.picture || '',
      socialProfiles: profileData.socialProfiles || [],
      backgroundImage: profileData.backgroundImage || '/gradient-bg.jpg',
    });
    
    // Parse phone number to display in the input
    if (profileData.phone && profileData.phone.trim() !== '') {
      console.log('Attempting to parse phone number:', profileData.phone);
      try {
        const parsedPhone = parsePhoneNumberFromString(profileData.phone);
        console.log('Parsed phone result:', parsedPhone);
        
        if (parsedPhone) {
          console.log('National number:', parsedPhone.nationalNumber);
          console.log('Country:', parsedPhone.country);
          setDigits(parsedPhone.nationalNumber);
          setPhoneCountry(parsedPhone.country as any || 'US');
        } else {
          // If the number can't be parsed as E.164, use it directly
          setDigits(profileData.phone.replace(/[^0-9]/g, ''));
        }
      } catch (error) {
        console.error('Error parsing phone number:', error);
        // Add auto-focus to name input on component mount
        // Fallback: just use the raw digits
        setDigits(profileData.phone.replace(/[^0-9]/g, ''));
      }
    }
  };
  
  // Auto-focus name input on mount for mobile convenience
  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);
  
  // Handle image upload
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'background') => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (type === 'avatar') {
        setFormData(prev => ({ ...prev, picture: result }));
      } else {
        setFormData(prev => ({ ...prev, backgroundImage: result }));
      }
    };
    reader.readAsDataURL(file);
  };
  
  // Handle social profile input change
  const handleSocialChange = (platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'snapchat' | 'whatsapp' | 'telegram' | 'wechat' | 'x', value: string) => {
    setFormData(prev => {
      const updatedProfiles = [...prev.socialProfiles];
      const profileIndex = updatedProfiles.findIndex(p => p.platform === platform);
      
      if (profileIndex >= 0) {
        // Update existing profile
        updatedProfiles[profileIndex] = {
          ...updatedProfiles[profileIndex],
          username: value,
          filled: value.trim() !== ''
        };
      } else {
        // Add new profile
        updatedProfiles.push({
          platform,
          username: value,
          shareEnabled: true,
          filled: value.trim() !== ''
        });
      }
      
      return { ...prev, socialProfiles: updatedProfiles };
    });
  };
  
  // Get social profile value
  const getSocialProfileValue = (platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'snapchat' | 'whatsapp' | 'telegram' | 'wechat' | 'x'): string => {
    const profile = formData.socialProfiles.find(p => p.platform === platform);
    return profile?.username || '';
  };
  
  // Handle save profile
  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      if (!session?.user?.email) {
        throw new Error('No user session');
      }
      
      // Extract email username (for auto-populating social profiles)
      const emailUsername = session.user.email.split('@')[0] || '';
      
      // Format phone number with country code
      let phoneNumber = '';
      if (digits) {
        try {
          // Try to parse with the country code
          const parsed = parsePhoneNumberFromString(digits, phoneCountry as any);
          if (parsed?.isValid()) {
            phoneNumber = parsed.format('E.164'); // +12133734253
          } else {
            // Basic fallback
            phoneNumber = digits.replace(/[^0-9]/g, '');
            if (!phoneNumber.startsWith('+')) {
              phoneNumber = `+${phoneNumber}`;
            }
          }
        } catch (error) {
          console.error('Error formatting phone:', error);
          // Simple fallback
          phoneNumber = digits;
        }
      }
      
      // Normalize phone number for social profiles
      const normalizedPhone = phoneNumber.replace(/[^0-9]/g, '');
      
      // Create a merged profile with updated data
      const updatedProfile: Partial<UserProfile> = {
        userId: session.user.email,
        name: formData.name,
        email: formData.email,
        picture: formData.picture,
        phone: phoneNumber,
        socialProfiles: formData.socialProfiles,
        backgroundImage: formData.backgroundImage,
        lastUpdated: Date.now()
      };
      
      // Auto-populate WhatsApp, Telegram, and WeChat with phone number if they're empty
      const phoneBasedProfiles = ['whatsapp', 'telegram', 'wechat'] as const;
      phoneBasedProfiles.forEach(platform => {
        if (!updatedProfile.socialProfiles) {
          updatedProfile.socialProfiles = [];
        }
        
        const profileIndex = updatedProfile.socialProfiles.findIndex(
          p => p.platform === platform
        );
        
        if (profileIndex === -1 || !updatedProfile.socialProfiles[profileIndex]?.username) {
          // Profile doesn't exist or has empty username, add with phone number
          if (profileIndex === -1) {
            updatedProfile.socialProfiles.push({
              platform,
              username: normalizedPhone,
              shareEnabled: true,
              filled: !!normalizedPhone
            });
          } else if (profileIndex >= 0) {
            updatedProfile.socialProfiles[profileIndex].username = normalizedPhone;
            updatedProfile.socialProfiles[profileIndex].filled = !!normalizedPhone;
          }
        }
      });
      
      // Auto-populate other social profiles with email username if they're empty
      const emailUsernameProfiles = ['facebook', 'instagram', 'twitter', 'linkedin', 'snapchat'] as const;
      emailUsernameProfiles.forEach(platform => {
        if (!updatedProfile.socialProfiles) {
          updatedProfile.socialProfiles = [];
        }
        
        const profileIndex = updatedProfile.socialProfiles.findIndex(
          p => p.platform === platform
        );
        
        if (profileIndex === -1 || !updatedProfile.socialProfiles[profileIndex]?.username) {
          // Profile doesn't exist or has empty username, add with email username
          if (profileIndex === -1) {
            updatedProfile.socialProfiles.push({
              platform,
              username: emailUsername,
              shareEnabled: true,
              filled: !!emailUsername
            });
          } else if (profileIndex >= 0) {
            updatedProfile.socialProfiles[profileIndex].username = emailUsername;
            updatedProfile.socialProfiles[profileIndex].filled = !!emailUsername;
          }
        }
      });
      
      // Save to local storage immediately for future loads
      localStorage.setItem('nektus_user_profile_cache', JSON.stringify({
        ...updatedProfile,
        lastUpdated: Date.now()
      }));
      
      console.log('Saving profile:', updatedProfile);
      
      // Save to context (which will save to Firestore)
      await saveProfile(updatedProfile);
      
      // Redirect to profile view
      router.push('/');
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Error saving profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div 
      className="min-h-screen flex flex-col items-center px-4 py-10"
      style={{
        backgroundImage: `url(${formData.backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <h1 className="text-2xl font-bold mb-6 text-center text-black">Edit Profile</h1>
      
      {/* Name Input */}
      <div className="mb-5 w-full max-w-md">
        <div className="flex items-center">
          <div className="mr-3 pointer-events-none">
            <label htmlFor="avatar-upload" className="relative cursor-pointer" onClick={() => {
              // Automatically trigger click on mobile
              document.getElementById('avatar-upload')?.click();
            }}>
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-gray-300">
                <img 
                  src={formData.picture || '/default-avatar.png'} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute bottom-0 right-0 bg-primary text-white p-0.5 rounded-full">
                <MdEdit size={8} />
              </div>
              <input 
                type="file" 
                id="avatar-upload" 
                className="hidden" 
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleImageUpload(e, 'avatar');
                  }
                }}
              />
            </label>
          </div>
          <input
            type="text"
            id="name"
            ref={nameInputRef}
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full p-2 border border-gray-300 rounded-md bg-white bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Name"
          />
        </div>
      </div>
      
      {/* Phone Input with Icon */}
      <div className="mb-5 w-full max-w-md">
        <div className="flex items-center">
          <div className="mr-3 pointer-events-none">
            <SocialIcon platform="phone" size="sm" />
          </div>
          <div className="flex-1">
            <CustomPhoneInput
              onChange={(value) => {
                setDigits(value);
              }}
              value={digits}
              placeholder="Phone number"
              className="w-full"
              inputProps={{
                id: "phone-input",
                autoComplete: "tel",
                className: "w-full p-2 border border-gray-300 rounded-none bg-white bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-primary"
              }}
            />
          </div>
        </div>
      </div>
      

      
      {/* Email Input with Icon */}
      <div className="mb-5 w-full max-w-md">
        <div className="flex items-center">
          <div className="mr-3 pointer-events-none">
            <SocialIcon platform="email" size="sm" />
          </div>
          <input
            type="email"
            id="email"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            className="w-full p-2 border border-gray-300 rounded-md bg-white bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Email"
          />
        </div>
      </div>
      
      {/* Social Media Inputs with Icons */}
      
      {/* Facebook */}
      <div className="mb-5 w-full max-w-md">
        <div className="flex items-center">
          <div className="mr-3 pointer-events-none">
            <SocialIcon platform="facebook" size="sm" />
          </div>
          <input
            type="text"
            id="facebook"
            value={getSocialProfileValue('facebook')}
            onChange={(e) => handleSocialChange('facebook', e.target.value)}
            placeholder="Facebook username"
            className="w-full p-2 border border-gray-300 rounded-md bg-white bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>
      
      {/* Instagram */}
      <div className="mb-5 w-full max-w-md">
        <div className="flex items-center">
          <div className="mr-3 pointer-events-none">
            <SocialIcon platform="instagram" size="sm" />
          </div>
          <input
            type="text"
            id="instagram"
            value={getSocialProfileValue('instagram')}
            onChange={(e) => handleSocialChange('instagram', e.target.value)}
            placeholder="Instagram username"
            className="w-full p-2 border border-gray-300 rounded-md bg-white bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>
      
      {/* Twitter */}
      <div className="mb-5 w-full max-w-md">
        <div className="flex items-center">
          <div className="mr-3 pointer-events-none">
            <SocialIcon platform="twitter" size="sm" />
          </div>
          <input
            type="text"
            id="twitter"
            value={getSocialProfileValue('twitter')}
            onChange={(e) => handleSocialChange('twitter', e.target.value)}
            placeholder="Twitter username"
            className="w-full p-2 border border-gray-300 rounded-md bg-white bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>
      
      {/* LinkedIn */}
      <div className="mb-5 w-full max-w-md">
        <div className="flex items-center">
          <div className="mr-3 pointer-events-none">
            <SocialIcon platform="linkedin" size="sm" />
          </div>
          <input
            type="text"
            id="linkedin"
            value={getSocialProfileValue('linkedin')}
            onChange={(e) => handleSocialChange('linkedin', e.target.value)}
            placeholder="LinkedIn username"
            className="w-full p-2 border border-gray-300 rounded-md bg-white bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>
      
      {/* Snapchat */}
      <div className="mb-5 w-full max-w-md">
        <div className="flex items-center">
          <div className="mr-3 pointer-events-none">
            <SocialIcon platform="snapchat" size="sm" />
          </div>
          <input
            type="text"
            id="snapchat"
            value={getSocialProfileValue('snapchat')}
            onChange={(e) => handleSocialChange('snapchat', e.target.value)}
            placeholder="Snapchat username"
            className="w-full p-2 border border-gray-300 rounded-md bg-white bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>
      
      {/* WhatsApp */}
      <div className="mb-5 w-full max-w-md">
        <div className="flex items-center">
          <div className="mr-3 pointer-events-none">
            <SocialIcon platform="whatsapp" size="sm" />
          </div>
          <input
            type="text"
            id="whatsapp"
            value={getSocialProfileValue('whatsapp')}
            onChange={(e) => handleSocialChange('whatsapp', e.target.value)}
            placeholder="WhatsApp number"
            className="w-full p-2 border border-gray-300 rounded-md bg-white bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>
      
      {/* Telegram */}
      <div className="mb-5 w-full max-w-md">
        <div className="flex items-center">
          <div className="mr-3 pointer-events-none">
            <SocialIcon platform="telegram" size="sm" />
          </div>
          <input
            type="text"
            id="telegram"
            value={getSocialProfileValue('telegram')}
            onChange={(e) => handleSocialChange('telegram', e.target.value)}
            placeholder="Telegram username"
            className="w-full p-2 border border-gray-300 rounded-md bg-white bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>
      
      {/* WeChat */}
      <div className="mb-5 w-full max-w-md">
        <div className="flex items-center">
          <div className="mr-3 pointer-events-none">
            <SocialIcon platform="wechat" size="sm" />
          </div>
          <input
            type="text"
            id="wechat"
            value={getSocialProfileValue('wechat')}
            onChange={(e) => handleSocialChange('wechat', e.target.value)}
            placeholder="WeChat ID"
            className="w-full p-2 border border-gray-300 rounded-md bg-white bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>
      
      {/* Edit Background */}
      <div className="mb-6 text-center w-full max-w-md">
        <label htmlFor="background-upload" className="text-white font-medium cursor-pointer hover:text-green-300 shadow-text">
          Edit Background
        </label>
        <input 
          type="file" 
          id="background-upload" 
          className="hidden" 
          accept="image/*"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleImageUpload(e, 'background');
            }
          }}
        />
      </div>
      
      {/* Save Button */}
      <div className="w-full max-w-md">
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-3 px-4 bg-primary text-white rounded-full font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <span className="inline-block mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
              Saving...
            </>
          ) : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export { EditProfile };
export default EditProfile;
