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
        
        {/* Avatar with edit icon */}
        <div className="flex justify-center mb-6 relative">
          <div className="w-24 h-24 rounded-full overflow-hidden">
            <img 
              src={formData.picture || '/default-avatar.png'} 
              alt="Profile" 
              className="w-full h-full object-cover"
            />
          </div>
          <label htmlFor="avatar-upload" className="absolute bottom-0 right-0 bg-primary text-white p-2 rounded-full cursor-pointer hover:bg-green-600 transition-colors">
            <FaCamera size={16} />
          </label>
          <input 
            type="file" 
            id="avatar-upload" 
            className="hidden" 
            accept="image/*"
            onChange={(e) => handleImageUpload(e, 'avatar')}
          />
        </div>
        
        {/* Name Input */}
        <div className="mb-4">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            id="name"
            ref={nameInputRef}
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        
        {/* Phone Input */}
        <div className="mb-4">
          <label htmlFor="phone-input" className="block text-sm font-medium text-gray-700 mb-1">Phone number</label>
          <CustomPhoneInput
            onChange={(value) => {
              setDigits(value);
            }}
            value={digits}
            placeholder="Enter phone number"
            inputProps={{
              id: "phone-input",
              autoComplete: "tel"
            }}
          />
        </div>
        
        {/* Email Input */}
        <div className="mb-4">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            id="email"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        
        {/* Social Media Inputs */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Social Profiles</h2>
          
          {/* Facebook */}
          <div className="mb-3">
            <label htmlFor="facebook" className="flex items-center text-sm font-medium text-gray-700 mb-1">
              <FaFacebook className="mr-2 text-blue-600" /> Facebook
            </label>
            <input
              type="text"
              id="facebook"
              value={getSocialProfileValue('facebook')}
              onChange={(e) => handleSocialChange('facebook', e.target.value)}
              placeholder="Username"
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          
          {/* Instagram */}
          <div className="mb-3">
            <label htmlFor="instagram" className="flex items-center text-sm font-medium text-gray-700 mb-1">
              <FaInstagram className="mr-2 text-pink-600" /> Instagram
            </label>
            <input
              type="text"
              id="instagram"
              value={getSocialProfileValue('instagram')}
              onChange={(e) => handleSocialChange('instagram', e.target.value)}
              placeholder="Username"
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          
          {/* Twitter */}
          <div className="mb-3">
            <label htmlFor="twitter" className="flex items-center text-sm font-medium text-gray-700 mb-1">
              <FaTwitter className="mr-2 text-blue-400" /> Twitter
            </label>
            <input
              type="text"
              id="twitter"
              value={getSocialProfileValue('twitter')}
              onChange={(e) => handleSocialChange('twitter', e.target.value)}
              placeholder="Username"
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          
          {/* LinkedIn */}
          <div className="mb-3">
            <label htmlFor="linkedin" className="flex items-center text-sm font-medium text-gray-700 mb-1">
              <FaLinkedin className="mr-2 text-blue-800" /> LinkedIn
            </label>
            <input
              type="text"
              id="linkedin"
              value={getSocialProfileValue('linkedin')}
              onChange={(e) => handleSocialChange('linkedin', e.target.value)}
              placeholder="Username"
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          
          {/* Snapchat */}
          <div className="mb-3">
            <label htmlFor="snapchat" className="flex items-center text-sm font-medium text-gray-700 mb-1">
              <FaSnapchat className="mr-2 text-yellow-400" /> Snapchat
            </label>
            <input
              type="text"
              id="snapchat"
              value={getSocialProfileValue('snapchat')}
              onChange={(e) => handleSocialChange('snapchat', e.target.value)}
              placeholder="Username"
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          
          {/* WhatsApp */}
          <div className="mb-3">
            <label htmlFor="whatsapp" className="flex items-center text-sm font-medium text-gray-700 mb-1">
              <FaWhatsapp className="mr-2 text-green-500" /> WhatsApp
            </label>
            <input
              type="text"
              id="whatsapp"
              value={getSocialProfileValue('whatsapp')}
              onChange={(e) => handleSocialChange('whatsapp', e.target.value)}
              placeholder="Phone number"
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          
          {/* Telegram */}
          <div className="mb-3">
            <label htmlFor="telegram" className="flex items-center text-sm font-medium text-gray-700 mb-1">
              <FaTelegram className="mr-2 text-blue-500" /> Telegram
            </label>
            <input
              type="text"
              id="telegram"
              value={getSocialProfileValue('telegram')}
              onChange={(e) => handleSocialChange('telegram', e.target.value)}
              placeholder="Username"
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
