'use client';
/** @jsxImportSource react */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useProfile, UserProfile } from '../context/ProfileContext';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { Button } from '@/ui/Button';
import CustomInput from './ui/CustomInput';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import CustomPhoneInput from './ui/CustomPhoneInput';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import SocialIcon from './ui/SocialIcon';
import { MdEdit } from 'react-icons/md';
import EditTitleBar from './ui/EditTitleBar';
import TextArea from './ui/TextArea';

// Define the social platform type
type SocialPlatform = 
  | 'facebook' 
  | 'instagram' 
  | 'x' 
  | 'linkedin' 
  | 'snapchat' 
  | 'whatsapp' 
  | 'telegram' 
  | 'wechat' 
  | 'email' 
  | 'phone';

// Array of all social platforms for type-safe iteration
const ALL_SOCIAL_PLATFORMS: SocialPlatform[] = [
  'facebook',
  'instagram',
  'x',
  'linkedin',
  'snapchat',
  'whatsapp',
  'telegram',
  'wechat',
  'email',
  'phone'
];

// Define the SocialProfile type for the form
type SocialProfile = {
  platform: string;
  username: string;
  shareEnabled: boolean;
  filled?: boolean;
  confirmed?: boolean;
};

// Define the form data interface
interface FormDataState {
  name: string;
  bio: string;
  email: string;
  picture: string;
  socialProfiles: Array<SocialProfile & { filled?: boolean }>;
  backgroundImage: string;
}

// Define the base social channel type
interface BaseSocialChannel {
  username?: string;
  url?: string;
  userConfirmed?: boolean;
}

// Define the contact channels interface
interface ContactChannels {
  email?: {
    email?: string;
    userConfirmed?: boolean;
  };
  phoneInfo?: {
    nationalPhone?: string;
    internationalPhone?: string;
    phoneNumber?: string;
    phone?: string;
    userConfirmed?: boolean;
    countryCode?: string;
  };
  // Social platforms
  facebook?: BaseSocialChannel;
  instagram?: BaseSocialChannel;
  x?: BaseSocialChannel;
  whatsapp?: BaseSocialChannel;
  snapchat?: BaseSocialChannel;
  telegram?: BaseSocialChannel;
  wechat?: BaseSocialChannel;
  linkedin?: BaseSocialChannel;
  // Index signature for dynamic access
  [key: string]: any;
}

// Define the profile data interface
interface ProfileData {
  name?: string;
  bio?: string;
  contactChannels?: ContactChannels;
  profileImage?: string;
  backgroundImage?: string;
  socialProfiles?: SocialProfile[];
}

const EditProfile: React.FC = () => {
  const { data: session } = useSession();
  const { profile, saveProfile } = useProfile();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  
  // State for form data
  const [formData, setFormData] = useState<FormDataState>({
    name: '',
    bio: '',
    email: '',
    picture: '',
    socialProfiles: [],
    backgroundImage: '',
  });
  
  const [digits, setDigits] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<'US' | 'CA' | 'GB' | 'AU' | 'DE' | 'FR' | 'IN'>('US');
  const [isSaving, setIsSaving] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  // Helper function to initialize form data from profile
  const initializeFormData = useCallback((profileData: ProfileData) => {
    // Initialize form data with profile data
    const name = profileData.name || session?.user?.name || '';
    const bio = profileData.bio || '';
    const email = profileData.contactChannels?.email?.email || session?.user?.email || '';
    const picture = profileData.profileImage || session?.user?.image || '/default-avatar.png';
    const backgroundImage = profileData.backgroundImage || '';
    
    // Initialize social profiles from contactChannels
    const socialProfiles: Array<SocialProfile & { filled?: boolean }> = [];
    
    // Add phone if available
    if (profileData.contactChannels?.phoneInfo) {
      socialProfiles.push({
        platform: 'phone',
        username: profileData.contactChannels.phoneInfo.nationalPhone || '',
        shareEnabled: true,
        filled: !!profileData.contactChannels.phoneInfo.nationalPhone,
        confirmed: profileData.contactChannels.phoneInfo.userConfirmed
      });
    }
    
    // Add email
    if (profileData.contactChannels?.email) {
      socialProfiles.push({
        platform: 'email',
        username: profileData.contactChannels.email.email || '',
        shareEnabled: true,
        filled: !!profileData.contactChannels.email.email,
        confirmed: profileData.contactChannels.email.userConfirmed
      });
    }
    
    // Add social profiles
    const socialPlatforms: SocialPlatform[] = ['facebook', 'instagram', 'x', 'whatsapp', 'snapchat', 'telegram', 'wechat', 'linkedin'];
    socialPlatforms.forEach(platform => {
      const channel = profileData.contactChannels?.[platform] as { username?: string; userConfirmed?: boolean } | undefined;
      if (channel?.username !== undefined) {
        socialProfiles.push({
          platform,
          username: channel.username || '',
          shareEnabled: true,
          filled: !!channel.username,
          confirmed: channel.userConfirmed || false
        });
      }
    });
    
    setFormData({
      name,
      bio,
      email,
      picture,
      socialProfiles,
      backgroundImage
    });
    
    // Check if we have phone info in the expected location
    const phoneInfo = profileData.contactChannels?.phoneInfo || 
                    (profileData && 'phoneInfo' in profileData ? 
                      profileData.phoneInfo as ContactChannels['phoneInfo'] : undefined);
    
    if (phoneInfo) {
      // Try to get the phone number from various possible locations
      // Prefer national phone number as it's already formatted for display
      const phoneNumber = phoneInfo.nationalPhone || 
                         phoneInfo.internationalPhone?.replace(/^\+1/, '') || // Remove +1 from international
                         phoneInfo.phoneNumber || 
                         phoneInfo.phone ||
                         '';
      
      if (phoneNumber) {
        // Clean the phone number to remove any non-digit characters
        const cleanedNumber = phoneNumber.replace(/\D/g, '');
        
        // Only update digits if we don't already have a value (to prevent overwriting user input)
        if (!digits) {
          setDigits(cleanedNumber);
          setPhoneCountry('US'); // Default to US if no country is set
        } else {
          // Skip phone number update as it already has a value
        }
      } else {
        // No valid phone number found in phoneInfo
      }
    } else {
      // No phoneInfo found in profile data
    }
  }, [session?.user?.name, session?.user?.email, session?.user?.image, digits]);
  
  // Load profile data
  useEffect(() => {
    if (profile) {
      initializeFormData(profile);
    }
  }, [profile, initializeFormData]);
  
  // Initialize form with session data if profile is empty
  useEffect(() => {
    if (session?.user && !profile) {
      setFormData((prev: FormDataState) => ({
        ...prev,
        name: session.user?.name || '',
        email: session.user?.email || '',
        picture: session.user?.image || '',
      }));
    }
  }, [session, profile, setFormData]);
  
  // Helper function to get social prefix for a platform
  const getSocialPrefix = (platform: SocialPlatform): string => {
    const prefixMap: Record<SocialPlatform, string> = {
      'facebook': 'facebook.com/',
      'instagram': 'instagram.com/',
      'x': 'x.com/',
      'snapchat': 'snapchat.com/add/',
      'linkedin': 'linkedin.com/in/',
      'whatsapp': '+',
      'telegram': 't.me/',
      'wechat': '',
      'email': '',
      'phone': ''
    };
    
    return prefixMap[platform] || '';
  };

  useEffect(() => {
    if (session?.user && !profile) {
      setFormData((prev) => ({
        ...prev,
        name: session.user?.name || '',
        email: session.user?.email || '',
        picture: session.user?.image || '',
      }));
    }
  }, [session, profile]);

  // Auto-focus name input on mount for mobile convenience
  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  // Handle image upload
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'background') => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      const result = e.target?.result as string;
      if (type === 'avatar') {
        setFormData((prev: FormDataState) => ({ ...prev, picture: result }));
      } else {
        setFormData((prev: FormDataState) => ({ ...prev, backgroundImage: result }));
      }
    };
    reader.onerror = (e) => {
      console.error('Error reading file:', e);
    };
    reader.readAsDataURL(file);
  };
  
  // Handle social profile input change
  const handleSocialChange = (platform: SocialPlatform, value: string) => {
    setFormData((prev: FormDataState) => {
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
  const getSocialProfileValue = (platform: string): string => {
    const profile = formData.socialProfiles.find(p => p.platform === platform);
    return profile?.username || '';
  };
  
  // Handle save profile
  const handleSave = async (): Promise<void> => {
    if (!setIsSaving) {
      console.warn('setIsSaving is not available');
      return;
    }
    
    setIsSaving(true);
    
    try {
      if (!session?.user?.email) {
        throw new Error('No user session found');
      }
      
      // Format phone number with country code
      let phoneNumber = '';
      let nationalNumber = '';
      
      // Process phone number if available
      if (digits) {
        try {
          // Clean the digits first (remove any non-digit characters except +)
          const cleanedDigits = digits.replace(/[^0-9+]/g, '');
          
          // If it starts with +, it's already in international format
          if (cleanedDigits.startsWith('+')) {
            const parsed = parsePhoneNumberFromString(cleanedDigits);
            if (parsed?.isValid()) {
              phoneNumber = parsed.format('E.164') || '';
              nationalNumber = parsed.nationalNumber || '';
            } else {
              // If parsing fails, use the cleaned digits as is
              phoneNumber = cleanedDigits;
              nationalNumber = cleanedDigits.replace(/^\+?\d+/, ''); // Remove country code for national
            }
          } else {
            // For national numbers, use the selected country code
            const parsed = parsePhoneNumberFromString(cleanedDigits, phoneCountry);
            if (parsed?.isValid()) {
              phoneNumber = parsed.format('E.164') || '';
              nationalNumber = parsed.nationalNumber || '';
            } else {
              // Fallback to raw digits if parsing fails
              phoneNumber = `+${cleanedDigits}`;
              nationalNumber = cleanedDigits;
            }
          }
          
          // Phone number successfully formatted
          
        } catch (error) {
          console.error('Error formatting phone:', error);
          // Fallback to raw digits
          phoneNumber = digits.startsWith('+') ? digits : `+${digits}`;
          nationalNumber = digits;
        }
      }
      
      // Define the social channel type for the form
      type FormSocialChannel = {
        username: string;
        url: string;
        userConfirmed: boolean;
      };

      // Define the contact channels type for the form
      interface FormContactChannels {
        phoneInfo: {
          internationalPhone: string;
          nationalPhone: string;
          userConfirmed: boolean;
        };
        email: {
          email: string;
          userConfirmed: boolean;
        };
        facebook: FormSocialChannel;
        instagram: FormSocialChannel;
        x: FormSocialChannel;
        whatsapp: FormSocialChannel;
        snapchat: FormSocialChannel;
        telegram: FormSocialChannel;
        wechat: FormSocialChannel;
        linkedin: FormSocialChannel;
        [key: string]: FormSocialChannel | {
          email: string;
          userConfirmed: boolean;
        } | {
          internationalPhone: string;
          nationalPhone: string;
          userConfirmed: boolean;
        };
      }

      // Create the base contact channels with all required fields
      const baseContactChannels: ContactChannels = {
        ...(profile?.contactChannels || {})
      };
      
      // Initialize required fields if they don't exist
      if (!baseContactChannels.phoneInfo) {
        baseContactChannels.phoneInfo = {
          internationalPhone: '',
          nationalPhone: '',
          phoneNumber: '',
          phone: '',
          userConfirmed: false
        };
      }
      
      if (!baseContactChannels.email) {
        baseContactChannels.email = {
          email: '',
          userConfirmed: false
        };
      }
      
      // Initialize social channels with empty values if they don't exist
      const socialPlatforms = ['facebook', 'instagram', 'x', 'whatsapp', 'snapchat', 'telegram', 'wechat', 'linkedin'];
      socialPlatforms.forEach(platform => {
        if (!baseContactChannels[platform]) {
          baseContactChannels[platform] = { username: '', url: '', userConfirmed: false };
        }
      });

      // Update with form data
      if (formData.email) {
        baseContactChannels.email = {
          ...baseContactChannels.email,
          email: formData.email,
          userConfirmed: true
        };
      }

      if (digits) {
        baseContactChannels.phoneInfo = {
          ...baseContactChannels.phoneInfo,
          internationalPhone: phoneNumber,
          nationalPhone: nationalNumber,
          userConfirmed: true
        };
      }

      // Create the updated profile
      const updatedProfile: Partial<UserProfile> = {
        ...profile, // Preserve existing profile data
        name: formData.name,
        profileImage: formData.picture,
        // Only update backgroundImage if there's a new one, otherwise preserve existing
        backgroundImage: formData.backgroundImage || profile?.backgroundImage || '',
        lastUpdated: Date.now(),
        contactChannels: baseContactChannels
      } as UserProfile;
      
      // Update social profiles from form data
      const updatedContactChannels = { ...updatedProfile.contactChannels } as ContactChannels;
      
      // First, collect all social platforms that are present in the form data
      const presentPlatforms = new Set(formData.socialProfiles.map(p => p.platform));
      
      // Process all known social platforms
      ALL_SOCIAL_PLATFORMS.forEach(platform => {
        // If platform is not in present platforms, set it to empty
        if (!presentPlatforms.has(platform)) {
          updatedContactChannels[platform] = { username: '', url: '', userConfirmed: false };
        }
      });
      
      // Then process the ones that are in the form data
      formData.socialProfiles.forEach(profile => {
        const { platform, username } = profile;
        
        // Handle email separately
        if (platform === 'email') {
          updatedContactChannels.email = {
            ...(updatedContactChannels.email || {}),
            email: username,
            userConfirmed: true
          };
          return;
        }
        
        // Skip phone as it's handled separately
        if (platform === 'phone') {
          return;
        }
        
        // Handle other social platforms
        if (ALL_SOCIAL_PLATFORMS.includes(platform as SocialPlatform)) {
          const socialPlatform = platform as SocialPlatform;
          const url = username ? `${getSocialPrefix(socialPlatform)}${username}` : '';
          
          // For empty usernames, explicitly set to empty string to ensure they're removed
          const socialChannel: BaseSocialChannel = {
            username: username || '',  // Explicitly set empty string for empty usernames
            url,
            userConfirmed: true
          };
          
          // Type-safe way to update the social channel
          switch (platform) {
            case 'facebook':
              updatedContactChannels.facebook = socialChannel;
              break;
            case 'instagram':
              updatedContactChannels.instagram = socialChannel;
              break;
            case 'x':
              updatedContactChannels.x = socialChannel;
              break;
            case 'whatsapp':
              updatedContactChannels.whatsapp = socialChannel;
              break;
            case 'snapchat':
              updatedContactChannels.snapchat = socialChannel;
              break;
            case 'telegram':
              updatedContactChannels.telegram = socialChannel;
              break;
            case 'wechat':
              updatedContactChannels.wechat = socialChannel;
              break;
            case 'linkedin':
              updatedContactChannels.linkedin = socialChannel;
              break;
          }
        }
      });
      
      // Update the profile with the merged contact channels
      // Ensure all required fields are present with defaults if needed
      updatedProfile.contactChannels = {
        // Start with default values for required fields
        phoneInfo: {
          internationalPhone: '',
          nationalPhone: '',
          userConfirmed: false,
          ...(updatedContactChannels.phoneInfo || {})
        },
        email: {
          email: '',
          userConfirmed: false,
          ...(updatedContactChannels.email || {})
        },
        // Include all social channels with defaults
        facebook: { username: '', url: '', userConfirmed: false, ...(updatedContactChannels.facebook || {}) },
        instagram: { username: '', url: '', userConfirmed: false, ...(updatedContactChannels.instagram || {}) },
        x: { username: '', url: '', userConfirmed: false, ...(updatedContactChannels.x || {}) },
        whatsapp: { username: '', url: '', userConfirmed: false, ...(updatedContactChannels.whatsapp || {}) },
        snapchat: { username: '', url: '', userConfirmed: false, ...(updatedContactChannels.snapchat || {}) },
        telegram: { username: '', url: '', userConfirmed: false, ...(updatedContactChannels.telegram || {}) },
        wechat: { username: '', url: '', userConfirmed: false, ...(updatedContactChannels.wechat || {}) },
        linkedin: { username: '', url: '', userConfirmed: false, ...(updatedContactChannels.linkedin || {}) },
      };
      
      // Save the updated profile
      if (!saveProfile) {
        throw new Error('saveProfile function is not available');
      }
      
      console.log('=== EDIT PROFILE SAVE START ===');
      console.log('Updated profile before save:', JSON.parse(JSON.stringify(updatedProfile)));
      
      // Save to context (which will save to localStorage)
      // Use directUpdate: true to ensure we do a direct update
      await saveProfile(updatedProfile, { directUpdate: true });
      
      console.log('=== EDIT PROFILE SAVE COMPLETE ===');
      
      // Redirect to profile view
      if (router) {
        router.push('/');
      } else {
        console.warn('Router is not available');
        // Fallback to window.location if router is not available
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      // Use a more user-friendly error handling approach
      if (error instanceof Error) {
        alert(`Error saving profile: ${error.message}`);
      } else {
        alert('An unknown error occurred while saving the profile');
      }
    } finally {
      if (setIsSaving) {
        setIsSaving(false);
      }
    }
  };
  
  return (
    <div 
      className="min-h-screen flex flex-col items-center px-4 py-4"
      style={{
        backgroundImage: formData.backgroundImage ? `url(${formData.backgroundImage})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#004D40' // Theme background color that shows while image loads
      }}
    >
      <div className="w-full max-w-md mb-6">
        <EditTitleBar 
          onBack={() => router.back()}
          onSave={handleSave}
          isSaving={isSaving}
        />
      </div>
      
      {/* Name Input with Profile Image */}
      <div className="mb-5 w-full max-w-md">
        <CustomInput
          ref={nameInputRef}
          type="text"
          id="name"
          value={formData.name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
            setFormData(prev => ({ ...prev, name: e.target.value }))
          }
          placeholder="Full Name"
          className="w-full"
          icon={
            <label className="cursor-pointer flex items-center justify-center w-full h-full">
              {formData.picture ? (
                <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white">
                  <Image
                    src={formData.picture}
                    alt="Profile"
                    width={32}
                    height={32}
                    className="object-cover w-full h-full"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.style.display = 'none';
                      setFormData(prev => ({ ...prev, picture: '' }));
                    }}
                  />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <span className="text-gray-400 text-xl">👤</span>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageUpload(e, 'avatar')}
              />
            </label>
          }
        />
      </div>

      {/* Bio Input */}
      <div className="mb-5 w-full max-w-md">
        <TextArea
          id="bio"
          value={formData.bio}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
            setFormData(prev => ({ ...prev, bio: e.target.value }))
          }
          placeholder="Add a short bio..."
          className="w-full"
          maxLength={280}
        />
      </div>

      {/* Phone Input */}
      <div className="mb-5 w-full max-w-md">
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
            className: "w-full p-2 border border-gray-300 rounded-md bg-white bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-primary"
          }}
        />
      </div>

      {/* Social Media Inputs */}
      {['facebook', 'instagram', 'x', 'linkedin', 'snapchat', 'whatsapp', 'telegram', 'wechat'].map((platform) => {
        const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
        const placeholder = 
          platform === 'x' ? 'X username' : 
          platform === 'wechat' ? 'WeChat ID' :
          platform === 'whatsapp' ? 'WhatsApp number' :
          `${platformName} username`;
          
        return (
          <div key={platform} className="mb-5 w-full max-w-md">
            <CustomInput
              type="text"
              id={platform}
              value={getSocialProfileValue(platform)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                handleSocialChange(platform as SocialPlatform, e.target.value);
              }}
              placeholder={placeholder}
              className="w-full"
              inputClassName="pl-2 text-base"
              icon={
                <div className="w-5 h-5 flex items-center justify-center">
                  <SocialIcon 
                    platform={platform as SocialPlatform} 
                    username={getSocialProfileValue(platform)}
                    size="sm" 
                  />
                </div>
              }
              iconClassName="text-gray-600"
            />
          </div>
        );
      })}
      
      {/* Edit Background */}
      <div className="mb-6 text-center w-full max-w-md">
        <label htmlFor="background-upload" className="text-theme hover:text-theme-dark font-medium cursor-pointer transition-colors">
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
      

    </div>
  );
};

export default EditProfile;
