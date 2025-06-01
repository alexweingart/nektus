'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useProfile, UserProfile as ProfileContextUserProfile } from '../context/ProfileContext';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { Button } from './ui/Button';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import CustomPhoneInput from './ui/CustomPhoneInput';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import SocialIcon from './ui/SocialIcon';
import { MdEdit } from 'react-icons/md';

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
  [key: string]: 
    | { email?: string; userConfirmed?: boolean }
    | { username?: string; url?: string; userConfirmed?: boolean }
    | { nationalPhone?: string; internationalPhone?: string; userConfirmed?: boolean }
    | undefined;
}

// Define the profile data interface
interface ProfileData {
  name?: string;
  contactChannels?: ContactChannels;
  profileImage?: string;
  backgroundImage?: string;
  socialProfiles?: SocialProfile[];
}

const EditProfile: React.FC = () => {
  const { data: session } = useSession();
  const { profile, saveProfile } = useProfile();
  const router = useRouter();
  const nameInputRef = useRef<HTMLInputElement>(null);
  
  // State for form data
  const [formData, setFormData] = useState<FormDataState>({
    name: '',
    email: '',
    picture: '',
    socialProfiles: [],
    backgroundImage: '',
  });
  
  const [digits, setDigits] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<'US' | 'CA' | 'GB' | 'AU' | 'DE' | 'FR' | 'IN'>('US');
  const [isSaving, setIsSaving] = useState(false);
  
  // Helper function to initialize form data from profile
  const initializeFormData = useCallback((profileData: ProfileData) => {
    // Initialize form data with profile data
    const name = profileData.name || session?.user?.name || '';
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
  const getSocialProfileValue = (platform: SocialPlatform): string => {
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

      // Create the updated profile with the correct structure for UserProfile
      const updatedProfile: Partial<ProfileContextUserProfile> & { contactChannels: FormContactChannels } = {
        name: formData.name,
        profileImage: formData.picture,
        backgroundImage: formData.backgroundImage,
        lastUpdated: Date.now(),
        contactChannels: {
          phoneInfo: {
            internationalPhone: phoneNumber,
            nationalPhone: nationalNumber,
            userConfirmed: true
          },
          email: {
            email: formData.email,
            userConfirmed: true
          },
          // Initialize all social channels with empty data
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
      
      // Update social profiles from form data
      formData.socialProfiles.forEach(profile => {
        const { platform, username } = profile;
        
        // Handle email separately
        if (platform === 'email') {
          updatedProfile.contactChannels.email = {
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
          const socialKey = platform as keyof typeof updatedProfile.contactChannels;
          const socialPlatform = platform as SocialPlatform;
          const url = username ? `${getSocialPrefix(socialPlatform)}${username}` : '';
          
          // Update the social channel with type safety
          const updatedChannel: FormSocialChannel = {
            username,
            url,
            userConfirmed: true
          };
          
          // Type-safe assignment
          if (socialKey in updatedProfile.contactChannels) {
            (updatedProfile.contactChannels[socialKey] as FormSocialChannel) = updatedChannel;
          }
        }
      });
      
      // Save the updated profile
      if (!saveProfile) {
        throw new Error('saveProfile function is not available');
      }
      
      // Save to context (which will save to localStorage)
      await saveProfile(updatedProfile);
      
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
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-gray-300 relative">
                {formData.picture ? (
                  <>
                    <div className="absolute inset-0 w-full h-full">
                      <Image
                        src={formData.picture}
                        alt="Profile"
                        fill
                        className="object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.onerror = null;
                          target.style.display = 'none';
                          const fallback = document.getElementById('edit-avatar-fallback');
                          if (fallback) fallback.style.display = 'flex';
                        }}
                        onLoadingComplete={(img) => {
                          img.style.opacity = '1';
                        }}
                        style={{
                          opacity: 0,
                          transition: 'opacity 0.3s ease-in-out'
                        }}
                        unoptimized={formData.picture.startsWith('data:')}
                      />
                    </div>
                    <div 
                      id="edit-avatar-fallback"
                      className="w-full h-full flex items-center justify-center bg-white hidden"
                    >
                      <div className="w-6 h-6 rounded-full bg-gray-100"></div>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-white">
                    <div className="w-6 h-6 rounded-full bg-gray-100"></div>
                  </div>
                )}
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
      
      {/* X (formerly Twitter) */}
      <div className="mb-5 w-full max-w-md">
        <div className="flex items-center">
          <div className="mr-3 pointer-events-none">
            <SocialIcon platform="x" size="sm" />
          </div>
          <input
            type="text"
            id="x"
            value={getSocialProfileValue('x')}
            onChange={(e) => {
              handleSocialChange('x', e.target.value);
              // Update X profile
            }}
            placeholder="𝕏 username"
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
        <label htmlFor="background-upload" className="text-green-600 hover:text-green-800 font-medium cursor-pointer transition-colors">
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
        <Button 
          onClick={handleSave}
          variant="theme"
          size="lg"
          disabled={isSaving}
          className="w-full font-medium"
        >
          {isSaving ? (
            <>
              <LoadingSpinner size="sm" className="inline-block mr-2 text-white" />
              Saving...
            </>
          ) : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
};

export { EditProfile };
export default EditProfile;
