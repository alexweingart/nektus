'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useProfile, UserProfile as ProfileContextUserProfile } from '../context/ProfileContext';

// Define the SocialProfile type for the form
type SocialProfile = {
  platform: string;
  username: string;
  shareEnabled: boolean;
  filled?: boolean;
  confirmed?: boolean;
};
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import CustomPhoneInput from './CustomPhoneInput';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import SocialIcon from './SocialIcon';
import { MdEdit } from 'react-icons/md';

// Extend the ProfileContextUserProfile type with our additional fields
type UserProfile = ProfileContextUserProfile & {
  socialProfiles: Array<SocialProfile & { filled?: boolean }>;
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
    picture: string;
    socialProfiles: Array<SocialProfile & { filled?: boolean }>;
    backgroundImage: string;
  }>({
    name: '',
    email: '',
    picture: '',
    socialProfiles: [],
    backgroundImage: '',
  });
  
  const [digits, setDigits] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<'US' | 'CA' | 'GB' | 'AU' | 'DE' | 'FR' | 'IN'>('US');
  const [isSaving, setIsSaving] = useState(false);
  
  // Load profile data
  useEffect(() => {
    // Load from profile context which uses the correct storage key
    if (profile) {
      initializeFormData(profile);
    }
  }, [profile]);
  
  // Initialize form with session data if profile is empty
  useEffect(() => {
    if (session?.user && !profile) {
      setFormData(prev => ({
        ...prev,
        name: session.user?.name || '',
        email: session.user?.email || '',
        picture: session.user?.image || ''
      }));
    }
  }, [session, profile]);
  
  // Helper function to get social prefix for a platform
  const getSocialPrefix = (platform: string) => {
    switch (platform) {
      case 'facebook':
        return 'facebook.com/';
      case 'instagram':
        return 'instagram.com/';
      case 'x':
        return 'x.com/';
      case 'snapchat':
        return 'snapchat.com/add/';
      case 'linkedin':
        return 'linkedin.com/in/';
      case 'whatsapp':
        return '+';
      case 'telegram':
        return 't.me/';
      case 'wechat':
        return '';
      default:
        return '';
    }
  };

  // Helper function to initialize form data from profile
  const initializeFormData = (profileData: any) => {
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
    const socialPlatforms = ['facebook', 'instagram', 'x', 'whatsapp', 'snapchat', 'telegram', 'wechat', 'linkedin'];
    socialPlatforms.forEach(platform => {
      const channel = profileData.contactChannels?.[platform];
      if (channel?.username) {
        socialProfiles.push({
          platform: platform as any,
          username: channel.username,
          shareEnabled: true,
          filled: !!channel.username,
          confirmed: channel.userConfirmed
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
                    (profileData as any).phoneInfo; // Fallback to root level
    
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
          console.log('Skipping phone number update, already has value:', digits);
        }
      } else {
        console.log('No valid phone number found in phoneInfo');
      }
    } else {
      console.log('No phoneInfo found in profile data');
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
  const handleSocialChange = (platform: 'facebook' | 'instagram' | 'x' | 'linkedin' | 'snapchat' | 'whatsapp' | 'telegram' | 'wechat', value: string) => {
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
  const getSocialProfileValue = (platform: 'facebook' | 'instagram' | 'x' | 'linkedin' | 'snapchat' | 'whatsapp' | 'telegram' | 'wechat'): string => {
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
      
      // Format phone number with country code
      let phoneNumber = '';
      let nationalNumber = '';
      
      console.log('Saving phone number, digits:', digits);
      
      if (digits) {
        try {
          // Clean the digits first (remove any non-digit characters except +)
          const cleanedDigits = digits.replace(/[^0-9+]/g, '');
          
          // If it starts with +, it's already in international format
          if (cleanedDigits.startsWith('+')) {
            const parsed = parsePhoneNumberFromString(cleanedDigits);
            if (parsed?.isValid()) {
              phoneNumber = parsed.format('E.164');
              nationalNumber = parsed.nationalNumber;
            } else {
              // If parsing fails, use the cleaned digits as is
              phoneNumber = cleanedDigits;
              nationalNumber = cleanedDigits.replace(/^\+?\d+/, ''); // Remove country code for national
            }
          } else {
            // For national numbers, use the selected country code
            const parsed = parsePhoneNumberFromString(cleanedDigits, phoneCountry as any);
            if (parsed?.isValid()) {
              phoneNumber = parsed.format('E.164');
              nationalNumber = parsed.nationalNumber;
            } else {
              // Fallback to raw digits if parsing fails
              phoneNumber = `+${cleanedDigits}`;
              nationalNumber = cleanedDigits;
            }
          }
          
          console.log('Formatted phone number:', { phoneNumber, nationalNumber, digits });
          
        } catch (error) {
          console.error('Error formatting phone:', error);
          // Fallback to raw digits
          phoneNumber = digits.startsWith('+') ? digits : `+${digits}`;
          nationalNumber = digits;
        }
      }
      
      // Create the updated profile with the correct structure for UserProfile
      const updatedProfile: Partial<ProfileContextUserProfile> & { contactChannels: any } = {
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
      if (updatedProfile.contactChannels) {
        formData.socialProfiles.forEach(profile => {
          const platform = profile.platform;
          if (platform === 'email') {
            updatedProfile.contactChannels.email = {
              email: profile.username,
              userConfirmed: true
            };
          } else if (platform === 'phone') {
            // Already handled above
          } else if (['facebook', 'instagram', 'x', 'whatsapp', 'snapchat', 'telegram', 'wechat', 'linkedin'].includes(platform)) {
            const socialPlatform = platform as keyof typeof updatedProfile.contactChannels;
            if (socialPlatform in updatedProfile.contactChannels) {
              (updatedProfile.contactChannels as any)[socialPlatform] = {
                username: profile.username,
                url: profile.username ? `${getSocialPrefix(platform as any)}${profile.username}` : '',
                userConfirmed: true
              };
            }
          }
        });
      }
      
      console.log('Saving profile:', updatedProfile);
      
      // Save to context (which will save to localStorage)
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
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-gray-300 relative">
                {formData.picture ? (
                  <>
                    <img 
                      src={formData.picture} 
                      alt="Profile" 
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.style.display = 'none';
                        const fallback = document.getElementById('edit-avatar-fallback');
                        if (fallback) fallback.style.display = 'flex';
                      }}
                      onLoad={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.opacity = '1';
                      }}
                      style={{
                        opacity: 0,
                        transition: 'opacity 0.3s ease-in-out'
                      }}
                    />
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
