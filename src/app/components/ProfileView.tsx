'use client';

import React, { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import SocialIcon from './SocialIcon';
import { useAdminModeActivator } from './AdminBanner';

// Import types from ProfileContext
import { UserProfile } from '../context/ProfileContext';

// Hardcoded profile data for now
const HARDCODED_PROFILE: UserProfile = {
  userId: 'temp-user-id',
  name: 'User',
  bio: '',
  profileImage: '/default-avatar.png',
  backgroundImage: '',
  lastUpdated: Date.now(),
  contactChannels: {
    phoneInfo: {
      internationalPhone: '',
      nationalPhone: '',
      userConfirmed: false
    },
    email: {
      email: 'user@example.com',
      userConfirmed: false
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

// Single instructional placeholder bio
const PLACEHOLDER_BIO = "AI will create a bio here for you, or tap edit profile to write your own";

const getPlaceholderBio = () => {
  return PLACEHOLDER_BIO;
};

// Define extended UserProfile type with AI content fields
type ExtendedUserProfile = UserProfile;

const ProfileView: React.FC = () => {
  const { data: session } = useSession();
  const profileContextData = useProfile();
  const { saveProfile } = profileContextData;
  const adminModeProps = useAdminModeActivator(); // Get admin mode activation props
  
  const [localProfile, setLocalProfile] = useState<UserProfile>(HARDCODED_PROFILE);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // State for UI
  const [bio, setBio] = useState<string>('');
  const [bgImage, setBgImage] = useState<string>('/gradient-bg.jpg');
  
  // Load profile from localStorage
  useEffect(() => {
    const loadProfile = () => {
      try {
        const savedProfile = localStorage.getItem('nektus_user_profile');
        if (savedProfile) {
          const parsedProfile = JSON.parse(savedProfile);
          setLocalProfile(prev => ({
            ...HARDCODED_PROFILE,
            ...parsedProfile,
            contactChannels: {
              ...HARDCODED_PROFILE.contactChannels,
              ...(parsedProfile.contactChannels || {})
            }
          }));
          
          // Set individual UI states
          if (parsedProfile.bio) setBio(parsedProfile.bio);
          if (parsedProfile.backgroundImage) setBgImage(parsedProfile.backgroundImage);
        }
      } catch (error) {
        console.error('Error loading profile from localStorage:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadProfile();
    
    // Optional: Listen for storage events to update when profile changes in another tab
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'nektus_user_profile') {
        loadProfile();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
  
  // Format phone number for display
  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '';
    
    // For US numbers, format as (123) 456-7890
    if (phone.startsWith('+1') && phone.length === 12) {
      const cleaned = phone.replace(/\D/g, '').substring(1); // Remove +1
      const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
      if (match) {
        return `(${match[1]}) ${match[2]}-${match[3]}`;
      }
    }
    
    // For other numbers, just use as-is
    return phone;
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-b from-green-400 to-blue-500">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }
  
  return (
    <div 
      className="min-h-screen flex flex-col items-center px-4 py-6"
      style={{
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Admin Mode is now triggered by double-clicking on the name */}
      
      <div className="w-full max-w-md flex flex-col items-center">
        {/* Profile Image */}
        <div className="mb-4">
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg">
            <img 
              src={localProfile.profileImage} 
              alt={localProfile.name} 
              className="w-full h-full object-cover"
            />
          </div>
        </div>
        
        {/* Profile Name - Double click to activate admin mode */}
        <h1 className="text-2xl font-bold mb-1 text-center text-black cursor-pointer" {...adminModeProps}>
          {localProfile.name}
        </h1>
        
        {/* Bio */}
        <p className="text-sm text-black mb-6 text-center max-w-xs">
          {bio || getPlaceholderBio()}
        </p>
        
        {/* Contact Icons */}
        <div className="mb-8 w-full max-w-xs mx-auto">
          {/* First row - 5 icons with equal spacing */}
          <div className="flex justify-between mb-5">
            {/* Phone Icon */}
            <div className="flex justify-center">
              <div className="relative">
                {!localProfile.contactChannels.phoneInfo.userConfirmed && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white animate-pulse"></div>
                )}
                <SocialIcon
                  platform="phone"
                  username={localProfile.contactChannels.phoneInfo.internationalPhone}
                  size="md"
                />
              </div>
            </div>
            
            {/* Email Icon */}
            <div className="flex justify-center">
              <div className="relative">
                {!localProfile.contactChannels.email.userConfirmed && localProfile.contactChannels.email.email && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white animate-pulse"></div>
                )}
                <SocialIcon
                  platform="email"
                  username={localProfile.contactChannels.email.email}
                  size="md"
                />
              </div>
            </div>
            
            {/* Facebook Icon */}
            <div className="flex justify-center">
              <div className="relative">
                {localProfile.contactChannels.facebook.username && !localProfile.contactChannels.facebook.userConfirmed && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white animate-pulse"></div>
                )}
                <SocialIcon
                  platform="facebook"
                  username={localProfile.contactChannels.facebook.username}
                  size="md"
                />
              </div>
            </div>
            
            {/* Instagram Icon */}
            <div className="flex justify-center">
              <div className="relative">
                {localProfile.contactChannels.instagram.username && !localProfile.contactChannels.instagram.userConfirmed && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white animate-pulse"></div>
                )}
                <SocialIcon
                  platform="instagram"
                  username={localProfile.contactChannels.instagram.username}
                  size="md"
                />
              </div>
            </div>
            
            {/* X Icon */}
            <div className="flex justify-center">
              <div className="relative">
                {localProfile.contactChannels.x.username && !localProfile.contactChannels.x.userConfirmed && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white animate-pulse"></div>
                )}
                <SocialIcon
                  platform="x"
                  username={localProfile.contactChannels.x.username}
                  size="md"
                />
              </div>
            </div>
          </div>
          
          {/* Second row - 5 icons with equal spacing */}
          <div className="flex justify-between">
            {/* WhatsApp Icon */}
            <div className="flex justify-center">
              <div className="relative">
                {localProfile.contactChannels.whatsapp.username && !localProfile.contactChannels.whatsapp.userConfirmed && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white animate-pulse"></div>
                )}
                <SocialIcon
                  platform="whatsapp"
                  username={localProfile.contactChannels.whatsapp.username}
                  size="md"
                />
              </div>
            </div>
            
            {/* Snapchat Icon */}
            <div className="flex justify-center">
              <div className="relative">
                {localProfile.contactChannels.snapchat.username && !localProfile.contactChannels.snapchat.userConfirmed && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white animate-pulse"></div>
                )}
                <SocialIcon
                  platform="snapchat"
                  username={localProfile.contactChannels.snapchat.username}
                  size="md"
                />
              </div>
            </div>
            
            {/* Telegram Icon */}
            <div className="flex justify-center">
              <div className="relative">
                {localProfile.contactChannels.telegram.username && !localProfile.contactChannels.telegram.userConfirmed && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white animate-pulse"></div>
                )}
                <SocialIcon
                  platform="telegram"
                  username={localProfile.contactChannels.telegram.username}
                  size="md"
                />
              </div>
            </div>
            
            {/* WeChat Icon */}
            <div className="flex justify-center">
              <div className="relative">
                {localProfile.contactChannels.wechat.username && !localProfile.contactChannels.wechat.userConfirmed && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white animate-pulse"></div>
                )}
                <SocialIcon
                  platform="wechat"
                  username={localProfile.contactChannels.wechat.username}
                  size="md"
                />
              </div>
            </div>
            
            {/* LinkedIn Icon */}
            <div className="flex justify-center">
              <div className="relative">
                {localProfile.contactChannels.linkedin.username && !localProfile.contactChannels.linkedin.userConfirmed && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white animate-pulse"></div>
                )}
                <SocialIcon
                  platform="linkedin"
                  username={localProfile.contactChannels.linkedin.username}
                  size="md"
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Link 
            href="/connect"
            className="nekt-button w-full text-center"
          >
            Nekt
          </Link>
          <Link 
            href="/edit" 
            className="w-full text-center py-2 px-4 text-sm font-medium text-green-600 hover:text-green-700"
          >
            Edit Profile
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ProfileView;
