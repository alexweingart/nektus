'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import SocialIcon from './SocialIcon';
import { MdEdit } from 'react-icons/md';

// Hardcoded social profiles for the form
const socialPlatforms = [
  { id: 'facebook', label: 'Facebook', icon: 'facebook' },
  { id: 'instagram', label: 'Instagram', icon: 'instagram' },
  { id: 'x', label: 'X (Twitter)', icon: 'x' },
  { id: 'linkedin', label: 'LinkedIn', icon: 'linkedin' },
  { id: 'github', label: 'GitHub', icon: 'github' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp' },
  { id: 'telegram', label: 'Telegram', icon: 'telegram' },
  { id: 'tiktok', label: 'TikTok', icon: 'tiktok' },
];

const EditProfile: React.FC = () => {
  const router = useRouter();
  const nameInputRef = useRef<HTMLInputElement>(null);
  
  // Hardcoded form data
  const [formData, setFormData] = useState({
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1 (555) 123-4567',
    title: 'Software Engineer',
    company: 'Tech Corp',
    location: 'San Francisco, CA',
    bio: 'Passionate developer building amazing web experiences',
    profileImage: '',
    backgroundImage: '/gradient-bg.jpg',
    socials: {
      facebook: 'johndoe',
  });
  
  const [isSaving, setIsSaving] = useState(false);
  
  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle social media changes
  const handleSocialChange = (platform: string, value: string) => {
    setSocials(prev => ({
      ...prev,
      [platform]: value
    }));
  };
  
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

  // Simple phone input component for the hardcoded version
  const PhoneInput = ({ value, onChange, ...props }: any) => (
    <input
      type="tel"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full p-2 border border-gray-300 rounded-md bg-white bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-primary"
      {...props}
    />
  );

  return (
    // Your JSX code here
  );
};

export default EditProfile;
      // Add phone if available
      if (contactChannels.phoneInfo) {
        socialProfiles.push({
          platform: 'phone',
          username: contactChannels.phoneInfo.nationalPhone || '',
          shareEnabled: true,
          filled: !!contactChannels.phoneInfo.nationalPhone,
          confirmed: contactChannels.phoneInfo.userConfirmed
        });
      }
      
      // Add email if available
      if (contactChannels.email) {
        socialProfiles.push({
          platform: 'email',
          username: contactChannels.email.email || '',
          shareEnabled: true,
          filled: !!contactChannels.email.email,
          confirmed: contactChannels.email.userConfirmed
        });
      }
      
      // Add social profiles
      const socialPlatforms = ['facebook', 'instagram', 'x', 'whatsapp', 'snapchat', 'telegram', 'wechat', 'linkedin'];
      socialPlatforms.forEach(platform => {
        const channel = contactChannels[platform];
        if (channel && channel.username) {
          socialProfiles.push({
            platform: platform as any,
            username: channel.username,
            shareEnabled: true,
            filled: !!channel.username,
            confirmed: channel.userConfirmed
          });
        }
      });
    } else if (profileData.socialProfiles) {
      // Old structure, use as is
      socialProfiles = [...profileData.socialProfiles];
    }
    
    setFormData({
      name,
      email,
      picture,
      socialProfiles,
      backgroundImage
    });
    
    // Initialize the phone number input from nationalPhone
    if (profileData.nationalPhone) {
      // Use the already parsed national phone number if available
      console.log('Using stored national number:', profileData.nationalPhone);
      setDigits(profileData.nationalPhone);
      
      // Use stored country if available
      if (profileData.country && profileData.countryUserConfirmed) {
        console.log('Using stored country:', profileData.country);
        setPhoneCountry(profileData.country as any);
      } else {
        // Fallback to default country
        setPhoneCountry('US');
      }
    } else if (profileData.internationalPhone) {
      // Fallback to parsing from internationalPhone
      console.log('Attempting to parse phone number:', profileData.internationalPhone);
      try {
        const parsedPhone = parsePhoneNumberFromString(profileData.internationalPhone);
        console.log('Parsed phone result:', parsedPhone);
        
        if (parsedPhone) {
          console.log('National number:', parsedPhone.nationalNumber);
          console.log('Country:', parsedPhone.country);
          setDigits(parsedPhone.nationalNumber);
          setPhoneCountry(parsedPhone.country as any || 'US');
        } else {
          // If the number can't be parsed, set empty
          setDigits('');
          setPhoneCountry('US');
        }
      } catch (error) {
        console.error('Error parsing phone number:', error);
        // Fallback: set empty
        setDigits('');
        setPhoneCountry('US');
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
      
      // Extract email username (for auto-populating social profiles)
      const emailUsername = session.user.email.split('@')[0] || '';
      
      // Create a merged profile with updated data first
      const updatedProfile = {
        userId: session.user.email,
        name: formData.name,
        email: formData.email,
        picture: formData.picture,
        // Remove phone field per requirements
        internationalPhone: '',
        nationalPhone: '',
        internationalPhoneUserConfirmed: true,
        nationalPhoneUserConfirmed: true,
        country: phoneCountry as string,
        countryUserConfirmed: true,
        socialProfiles: formData.socialProfiles,
        backgroundImage: formData.backgroundImage,
        handle: '',
        lastUpdated: Date.now()
      };
      
      // Format phone number with country code
      let phoneNumber = '';
      if (digits) {
        try {
          // Try to parse with the country code
          const parsed = parsePhoneNumberFromString(digits, phoneCountry as any);
          if (parsed?.isValid()) {
            phoneNumber = parsed.format('E.164'); // +12133734253
            const nationalNumber = parsed.nationalNumber; // Store the national format
            const countryCode = parsed.country || phoneCountry;
            
            // Store both formats along with country information
            updatedProfile.internationalPhone = phoneNumber;
            updatedProfile.nationalPhone = nationalNumber;
            updatedProfile.internationalPhoneUserConfirmed = true;
            updatedProfile.nationalPhoneUserConfirmed = true;
            updatedProfile.country = countryCode;
            updatedProfile.countryUserConfirmed = true;
          } else {
            // Basic fallback
            phoneNumber = digits.replace(/[^0-9]/g, '');
            if (!phoneNumber.startsWith('+')) {
              phoneNumber = `+${phoneNumber}`;
            }
            // Still set both formats with basic values
            updatedProfile.internationalPhone = phoneNumber;
            updatedProfile.nationalPhone = digits;
            updatedProfile.internationalPhoneUserConfirmed = true;
            updatedProfile.nationalPhoneUserConfirmed = true;
            updatedProfile.country = phoneCountry; 
            updatedProfile.countryUserConfirmed = true;
          }
        } catch (error) {
          console.error('Error formatting phone:', error);
          // Simple fallback
          phoneNumber = digits;
          updatedProfile.internationalPhone = phoneNumber;
          updatedProfile.nationalPhone = digits;
          updatedProfile.internationalPhoneUserConfirmed = true;
          updatedProfile.nationalPhoneUserConfirmed = true;
          updatedProfile.country = phoneCountry;
          updatedProfile.countryUserConfirmed = true;
        }
      }
      
      // Normalize phone number for social profiles
      const normalizedPhone = phoneNumber.replace(/[^0-9]/g, '');
      
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
      const emailUsernameProfiles = ['facebook', 'instagram', 'x', 'linkedin', 'snapchat'] as const;
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
      
      // Create contact channels from the updated profile
      const contactChannels = {
        phoneInfo: {
          internationalPhone: updatedProfile.internationalPhone || '',
          nationalPhone: updatedProfile.nationalPhone || '',
          userConfirmed: true
        },
        email: {
          email: updatedProfile.email || '',
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
      };

      // Populate social channels from socialProfiles
      if (updatedProfile.socialProfiles) {
        updatedProfile.socialProfiles.forEach(profile => {
          const platform = profile.platform;
          if (platform === 'email' || platform === 'phone') return;
          
          // Only process known social platforms
          if (['facebook', 'instagram', 'x', 'whatsapp', 'snapchat', 'telegram', 'wechat', 'linkedin'].includes(platform)) {
            const socialPlatform = platform as 'facebook' | 'instagram' | 'x' | 'whatsapp' | 'snapchat' | 'telegram' | 'wechat' | 'linkedin';
            contactChannels[socialPlatform] = {
              username: profile.username || '',
              url: profile.username ? `${getSocialPrefix(platform as any)}${profile.username}` : '',
              userConfirmed: !!profile.filled
            };
          }
        });
      }

      // Create the cached profile with the new structure
      const cachedProfile = {
        backgroundImage: updatedProfile.backgroundImage || '',
        profileImage: updatedProfile.picture || '',
        bio: '',
        name: updatedProfile.name || '',
        lastUpdated: Date.now(),
        contactChannels
      };

      // Save to local storage
      localStorage.setItem('nektus_user_profile_cache', JSON.stringify(cachedProfile));
      
      console.log('Saving profile:', updatedProfile);
      
      // Save to context (which will save to Firestore)
      await saveProfile(updatedProfile as Partial<UserProfile>);
      
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
