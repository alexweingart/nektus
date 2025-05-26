'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useProfile, SocialProfile as ProfileSocialProfile } from '../context/ProfileContext';
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
  FaEnvelope,
  FaCamera
} from 'react-icons/fa';
import { MdEdit } from 'react-icons/md';

// Use the SocialProfile type from ProfileContext
type SocialProfile = ProfileSocialProfile;

type UserProfile = {
  userId: string;
  name: string;
  email: string;
  picture: string;
  phone: string;
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
  const [country, setCountry] = useState<'US' | 'CA' | 'GB' | 'AU' | 'DE' | 'FR' | 'IN'>('US');
  const [isSaving, setIsSaving] = useState(false);
  
  // Load profile data
  useEffect(() => {
    if (profile) {
      // Initialize form data with profile data
      setFormData({
        name: profile.name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        picture: profile.picture || '',
        socialProfiles: profile.socialProfiles || [],
        backgroundImage: profile.backgroundImage || '/gradient-bg.jpg',
      });
      
      // Parse phone number to display in the input
      if (profile.phone) {
        const parsedPhone = parsePhoneNumberFromString(profile.phone);
        if (parsedPhone) {
          setDigits(parsedPhone.nationalNumber);
          setCountry(parsedPhone.country as any || 'US');
        }
      }
    }
  }, [profile]);
  
  // Auto-focus name input on load
  useEffect(() => {
    if (nameInputRef.current) {
      nameInputRef.current.focus();
    }
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
  const handleSocialChange = (platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'snapchat' | 'whatsapp' | 'telegram' | 'x', value: string) => {
    setFormData(prev => {
      const updatedProfiles = [...prev.socialProfiles];
      const profileIndex = updatedProfiles.findIndex(p => p.platform === platform);
      
      if (profileIndex >= 0) {
        updatedProfiles[profileIndex] = {
          ...updatedProfiles[profileIndex],
          username: value,
          filled: value.trim() !== ''
        };
      } else {
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
  const getSocialProfileValue = (platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'snapchat' | 'whatsapp' | 'telegram' | 'x'): string => {
    const profile = formData.socialProfiles.find(p => p.platform === platform);
    return profile?.username || '';
  };
  
  // Handle save profile
  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      // Convert national phone number to E.164 format
      let fullNumber = formData.phone;
      if (digits) {
        const parsed = parsePhoneNumberFromString(digits, country);
        if (parsed?.isValid()) {
          fullNumber = parsed.number;
        }
      }
      
      // Create profile data for saving
      const profileData = {
        name: formData.name,
        email: formData.email,
        phone: fullNumber,
        picture: formData.picture,
        socialProfiles: formData.socialProfiles,
        backgroundImage: formData.backgroundImage
      };
      
      // Save profile
      await saveProfile(profileData);
      
      // Update local storage cache
      if (session?.user?.email) {
        const cachedProfile = {
          userId: session.user.email,
          name: formData.name,
          email: formData.email,
          picture: formData.picture,
          phone: fullNumber,
          socialProfiles: formData.socialProfiles,
          backgroundImage: formData.backgroundImage,
          lastUpdated: Date.now(),
        };
        localStorage.setItem('nektus_user_profile_cache', JSON.stringify(cachedProfile));
      }
      
      // Navigate back to profile page
      router.push('/');
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div 
      className="min-h-screen flex flex-col items-center"
      style={{
        backgroundImage: `url(${formData.backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="w-full max-w-md p-6 bg-white bg-opacity-95 rounded-lg shadow-lg my-8">
        <h1 className="text-2xl font-bold mb-6 text-center">Edit Profile</h1>
        
        {/* Name Input with Profile Photo */}
        <div className="mb-4">
          <div className="flex items-center">
            <label htmlFor="avatar-upload" className="relative cursor-pointer mr-3">
              <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                <img 
                  src={formData.picture || '/default-avatar.png'} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute bottom-0 right-0 bg-primary text-white p-1 rounded-full">
                <MdEdit size={10} />
              </div>
              <input 
                type="file" 
                id="avatar-upload" 
                className="hidden" 
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'avatar')}
              />
            </label>
            <input
              type="text"
              id="name"
              ref={nameInputRef}
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full p-2 pl-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Name"
            />
          </div>
        </div>
        
        {/* Phone Input with Icon */}
        <div className="mb-4">
          <div className="flex items-center">
            <div className="mr-3 text-gray-500">
              <span className="flex items-center justify-center w-10 h-10">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 16.42V19.956C21.0001 20.2092 20.9587 20.4604 20.8781 20.6979C20.7976 20.9353 20.6794 21.1551 20.5288 21.3465C20.3783 21.5379 20.1983 21.6974 19.9982 21.8163C19.7982 21.9351 19.5812 22.0113 19.356 22.041C16.1249 22.5538 12.7862 21.5112 10.0289 19.5289C7.4615 17.6949 5.3259 15.2379 3.89705 12.355C2.37385 9.1368 1.56498 5.67281 2.05901 2.646C2.08875 2.41315 2.16557 2.1864 2.28512 1.97825C2.40468 1.77011 2.56481 1.58277 2.75672 1.42911C2.94864 1.27545 3.16957 1.15812 3.4067 1.08308C3.64384 1.00804 3.89397 0.976896 4.145 0.991003H7.445C7.90825 0.985953 8.35578 1.15197 8.70824 1.45442C9.06071 1.75688 9.29379 2.17511 9.36 2.63L9.778 5.382C9.83262 5.80273 9.7689 6.23232 9.5953 6.6189C9.4217 7.00549 9.144 7.33425 8.797 7.566L7.312 8.683C8.44432 10.2096 9.8389 11.5263 11.4371 12.586L12.552 11.101C12.7837 10.754 13.1125 10.4763 13.4991 10.3027C13.8856 10.1291 14.3152 10.0654 14.736 10.12L17.488 10.538C17.9443 10.6053 18.3633 10.8409 18.6647 11.1963C18.9662 11.5517 19.1294 12.0023 19.119 12.465L21 16.42Z" stroke="#495057" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            </div>
            <div className="flex-1">
              <CustomPhoneInput
                onChange={(value) => {
                  setDigits(value);
                }}
                value={digits}
                placeholder="Phone number"
                inputProps={{
                  id: "phone-input",
                  autoComplete: "tel",
                  className: "w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                }}
              />
            </div>
          </div>
        </div>
        
        {/* Email Input with Icon */}
        <div className="mb-4">
          <div className="flex items-center">
            <div className="mr-3 text-gray-500">
              <span className="flex items-center justify-center w-10 h-10">
                <FaEnvelope size={20} />
              </span>
            </div>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Email"
            />
          </div>
        </div>
        
        {/* Social Media Inputs with Icons */}
        
        {/* Facebook */}
        <div className="mb-4">
          <div className="flex items-center">
            <div className="mr-3 text-blue-600">
              <span className="flex items-center justify-center w-10 h-10">
                <FaFacebook size={24} />
              </span>
            </div>
            <input
              type="text"
              id="facebook"
              value={getSocialProfileValue('facebook')}
              onChange={(e) => handleSocialChange('facebook', e.target.value)}
              placeholder="Facebook username"
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        
        {/* Instagram */}
        <div className="mb-4">
          <div className="flex items-center">
            <div className="mr-3 text-pink-600">
              <span className="flex items-center justify-center w-10 h-10">
                <FaInstagram size={24} />
              </span>
            </div>
            <input
              type="text"
              id="instagram"
              value={getSocialProfileValue('instagram')}
              onChange={(e) => handleSocialChange('instagram', e.target.value)}
              placeholder="Instagram username"
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        
        {/* Twitter */}
        <div className="mb-4">
          <div className="flex items-center">
            <div className="mr-3 text-blue-400">
              <span className="flex items-center justify-center w-10 h-10">
                <FaTwitter size={22} />
              </span>
            </div>
            <input
              type="text"
              id="twitter"
              value={getSocialProfileValue('twitter')}
              onChange={(e) => handleSocialChange('twitter', e.target.value)}
              placeholder="Twitter username"
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        
        {/* LinkedIn */}
        <div className="mb-4">
          <div className="flex items-center">
            <div className="mr-3 text-blue-800">
              <span className="flex items-center justify-center w-10 h-10">
                <FaLinkedin size={22} />
              </span>
            </div>
            <input
              type="text"
              id="linkedin"
              value={getSocialProfileValue('linkedin')}
              onChange={(e) => handleSocialChange('linkedin', e.target.value)}
              placeholder="LinkedIn username"
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        
        {/* Snapchat */}
        <div className="mb-4">
          <div className="flex items-center">
            <div className="mr-3 text-yellow-400">
              <span className="flex items-center justify-center w-10 h-10">
                <FaSnapchat size={24} />
              </span>
            </div>
            <input
              type="text"
              id="snapchat"
              value={getSocialProfileValue('snapchat')}
              onChange={(e) => handleSocialChange('snapchat', e.target.value)}
              placeholder="Snapchat username"
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        
        {/* WhatsApp */}
        <div className="mb-4">
          <div className="flex items-center">
            <div className="mr-3 text-green-500">
              <span className="flex items-center justify-center w-10 h-10">
                <FaWhatsapp size={24} />
              </span>
            </div>
            <input
              type="text"
              id="whatsapp"
              value={getSocialProfileValue('whatsapp')}
              onChange={(e) => handleSocialChange('whatsapp', e.target.value)}
              placeholder="WhatsApp number"
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        
        {/* Telegram */}
        <div className="mb-4">
          <div className="flex items-center">
            <div className="mr-3 text-blue-500">
              <span className="flex items-center justify-center w-10 h-10">
                <FaTelegram size={24} />
              </span>
            </div>
            <input
              type="text"
              id="telegram"
              value={getSocialProfileValue('telegram')}
              onChange={(e) => handleSocialChange('telegram', e.target.value)}
              placeholder="Telegram username"
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        
        {/* Edit Background */}
        <div className="mb-6 text-center">
          <label htmlFor="background-upload" className="text-green-600 cursor-pointer hover:text-green-800">
            Edit Background
          </label>
          <input 
            type="file" 
            id="background-upload" 
            className="hidden" 
            accept="image/*"
            onChange={(e) => handleImageUpload(e, 'background')}
          />
        </div>
        
        {/* Save Button */}
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-2 px-4 bg-primary text-white rounded-md font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
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
