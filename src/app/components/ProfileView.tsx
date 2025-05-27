'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useProfile } from '../context/ProfileContext';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import SocialIcon from './SocialIcon';
import { useAdminModeActivator } from './AdminBanner';
import { toast } from 'react-hot-toast';

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
const PLACEHOLDER_BIO = "Generating your personalized bio...";

const getPlaceholderBio = () => {
  return PLACEHOLDER_BIO;
};

// Define extended UserProfile type with AI content fields
type ExtendedUserProfile = UserProfile;

const ProfileView: React.FC = () => {
  const { data: session } = useSession();
  const { profile, saveProfile } = useProfile();
  const [isLoading, setIsLoading] = useState(true);
  const adminModeProps = useAdminModeActivator(); // Get admin mode activation props
  
  const [localProfile, setLocalProfile] = useState<UserProfile>({
    userId: `user-${Date.now()}`,
    name: 'New User',
    bio: '',
    profileImage: '/default-avatar.png',
    backgroundImage: '',
    lastUpdated: Date.now(),
    contactChannels: {
      phoneInfo: { internationalPhone: '', nationalPhone: '', userConfirmed: false },
      email: { email: '', userConfirmed: false },
      facebook: { username: '', url: '', userConfirmed: false },
      instagram: { username: '', url: '', userConfirmed: false },
      x: { username: '', url: '', userConfirmed: false },
      whatsapp: { username: '', url: '', userConfirmed: false },
      snapchat: { username: '', url: '', userConfirmed: false },
      telegram: { username: '', url: '', userConfirmed: false },
      wechat: { username: '', url: '', userConfirmed: false },
      linkedin: { username: '', url: '', userConfirmed: false }
    }
  });
  
  // State for UI
  const [bio, setBio] = useState<string>('');
  const [bgImage, setBgImage] = useState<string>('/gradient-bg.jpg');
  
  // Function to generate bio using AI
  const generateBio = useCallback(async (profile: typeof localProfile) => {
    try {
      // Check if we have enough data to generate a meaningful bio
      const hasSocialInfo = Object.values(profile.contactChannels).some(
        (channel: any) => 
          (channel.username && channel.username !== '') || 
          (channel.email && channel.email !== '') ||
          (channel.internationalPhone && channel.internationalPhone !== '')
      );

      if (!hasSocialInfo) return;

      // Prepare the prompt data for ChatGPT
      const promptData = {
        type: 'bio',
        profile: {
          ...profile,
          // Map the contact channels to the format expected by the API
          facebookUsername: profile.contactChannels.facebook.username,
          instagramUsername: profile.contactChannels.instagram.username,
          xUsername: profile.contactChannels.x.username,
          linkedinUsername: profile.contactChannels.linkedin.username,
          snapchatUsername: profile.contactChannels.snapchat.username,
          whatsappUsername: profile.contactChannels.whatsapp.username,
          telegramUsername: profile.contactChannels.telegram.username,
          wechatUsername: profile.contactChannels.wechat.username,
          email: profile.contactChannels.email.email,
          phone: profile.contactChannels.phoneInfo.internationalPhone,
          name: profile.name,
        },
      };
      
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(promptData),

      });

      if (!response.ok) {
        throw new Error('Failed to generate bio');
      }

      const { bio: generatedBio } = await response.json();
      
      if (generatedBio) {
        // First, get the current profile from localStorage to ensure we have the latest data
        const currentProfile = localStorage.getItem('nektus_user_profile');
        let profileToUpdate = profile;
        
        if (currentProfile) {
          try {
            // Parse the current profile and merge with the new bio
            const parsedProfile = JSON.parse(currentProfile);
            profileToUpdate = {
              ...parsedProfile,
              bio: generatedBio,
              lastUpdated: Date.now()
            };
          } catch (e) {
            console.error('Error parsing current profile:', e);
            // Fallback to the passed profile if parsing fails
            profileToUpdate = {
              ...profile,
              bio: generatedBio,
              lastUpdated: Date.now()
            };
          }
        } else {
          // If no profile exists, create a new one with the bio
          profileToUpdate = {
            ...profile,
            bio: generatedBio,
            lastUpdated: Date.now()
          };
        }
        
        // Save the updated profile to localStorage
        localStorage.setItem('nektus_user_profile', JSON.stringify(profileToUpdate));
        
        // Update the local state
        setLocalProfile(profileToUpdate);
        setBio(generatedBio);
      }
    } catch (error) {
      console.error('Error generating bio:', error);
      toast.error('Failed to generate bio. Please try again later.');
    }
  }, [localProfile, profile]);

  // Handle loading state
  useEffect(() => {
    if (profile) {
      setIsLoading(false);
    }
  }, [profile]);

  // Track if we've attempted to generate a bio
  const hasGeneratedBio = React.useRef(false);

  // Handle loading state
  useEffect(() => {
    if (profile) {
      setLocalProfile(profile);
      if (profile.bio) setBio(profile.bio);
      if (profile.backgroundImage) setBgImage(profile.backgroundImage);
      setIsLoading(false);
    } else {
      // Try to load from localStorage if no profile in context
      try {
        const savedProfile = localStorage.getItem('nektus_user_profile');
        if (savedProfile) {
          const parsedProfile = JSON.parse(savedProfile);
          setLocalProfile(parsedProfile);
          if (parsedProfile.bio) setBio(parsedProfile.bio);
          if (parsedProfile.backgroundImage) setBgImage(parsedProfile.backgroundImage);
        }
      } catch (error) {
        console.error('Error loading profile from localStorage:', error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [profile]);
  
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
  
  if (isLoading || !profile) {
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
