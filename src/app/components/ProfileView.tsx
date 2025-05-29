'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useProfile } from '../context/ProfileContext';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Avatar from './ui/Avatar';
import SocialIcon from './SocialIcon';
import { useAdminModeActivator } from './AdminBanner';
import { toast } from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';


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
  const { profile, saveProfile, generateBio, generateBackgroundImage } = useProfile();
  const [isLoading, setIsLoading] = useState(true);
  const adminModeProps = useAdminModeActivator(); // Get admin mode activation props
  
  // State for UI
  const [bio, setBio] = useState<string>('');
  
  // Reference to track if we've loaded the bio in this session
  const hasLoadedBio = useRef(false);
  
  // Initialize local profile with session data if available
  const [localProfile, setLocalProfile] = useState<UserProfile>(() => ({
    userId: `user-${Date.now()}`,
    name: session?.user?.name || 'New User',
    bio: '',
    profileImage: session?.user?.image || '/default-avatar.png',
    backgroundImage: '',
    lastUpdated: Date.now(),
    contactChannels: {
      phoneInfo: { internationalPhone: '', nationalPhone: '', userConfirmed: false },
      email: { 
        email: session?.user?.email || '', 
        userConfirmed: !!session?.user?.email 
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
  }));

  // Update local profile when the context profile changes
  useEffect(() => {
    if (profile) {
      setLocalProfile(prev => {

        
        // Improved bio preservation logic:
        // 1. Use profile.bio if it exists
        // 2. Otherwise use the current bio state if it's not a placeholder
        // 3. Otherwise use prev.bio
        // 4. If all else fails, use empty string
        let bioToUse = '';
        
        if (profile.bio && profile.bio.trim() !== '') {
          bioToUse = profile.bio;
        } else if (bio && bio !== PLACEHOLDER_BIO) {
          bioToUse = bio;
        } else if (prev.bio && prev.bio.trim() !== '') {
          bioToUse = prev.bio;
        }
        
        // If we're keeping a non-empty bio, update the state too
        if (bioToUse && bioToUse !== bio) {
          setBio(bioToUse);
          hasLoadedBio.current = true;
        }
        
        const updatedProfile = {
          ...prev,
          ...profile,
          // Always use our carefully preserved bio
          bio: bioToUse,
          // Ensure we have a profile image
          profileImage: profile.profileImage || session?.user?.image || '/default-avatar.png',
          contactChannels: {
            ...prev.contactChannels,
            ...profile.contactChannels,
            // Ensure email is properly set from session
            email: {
              ...prev.contactChannels.email,
              ...(profile.contactChannels?.email || {})
            }
          }
        };
        

        return updatedProfile;
      });
    }
  }, [profile, session?.user?.image, bio]);
  


  // Handle loading state and bio generation
  useEffect(() => {
    const loadProfile = async () => {
      try {
        let currentProfile = profile;
        
        // If no profile in context, try loading from localStorage
        if (!currentProfile) {
          const savedProfile = localStorage.getItem('nektus_user_profile');
          if (savedProfile) {
            currentProfile = JSON.parse(savedProfile);
          }
        }

        // If we have a profile, update the state
        if (currentProfile) {
          setLocalProfile(currentProfile);
          
          // Set bio from profile if it exists
          if (currentProfile.bio) {

            setBio(currentProfile.bio);
            hasLoadedBio.current = true;
          } else {
            // The bio will be generated by ProfileContext if needed
            setBio(PLACEHOLDER_BIO);
          }
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [profile]);

  // Effect to update bio state when profile changes
  useEffect(() => {
    // Only update bio if we have a non-empty profile bio and either:
    // 1. We haven't loaded a bio yet, or
    // 2. The current bio is the placeholder
    if (profile?.bio && (bio === PLACEHOLDER_BIO || !hasLoadedBio.current)) {

      setBio(profile.bio);
      hasLoadedBio.current = true;
    } else if (profile?.bio) {
      // We're not updating the bio because it already exists
    }
  }, [profile?.bio, bio]);

  // Handle loading state
  useEffect(() => {
    if (profile) {
      setIsLoading(false);
    }
  }, [profile]);

  // Memoize the bio content to prevent re-renders
  // Important: This must be before any conditional returns to avoid breaking React's rules of hooks
  const bioContent = useMemo(() => {
    return bio || getPlaceholderBio();
  }, [bio]);

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
        backgroundImage: localProfile.backgroundImage ? `url(${localProfile.backgroundImage})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#f4f9f4'
      }}
    >
      {/* Admin Mode is now triggered by double-clicking on the name */}
      
      <div className="w-full max-w-md flex flex-col items-center">
        {/* Profile Image */}
        <div className="mb-4">
          <div className="border-4 border-white shadow-lg rounded-full">
            <Avatar 
              src={profile?.profileImage || localProfile?.profileImage} 
              alt={profile?.name || localProfile?.name || 'Profile'}
              size="lg"
            />
          </div>
        </div>
        
        {/* Profile Name - Double click to activate admin mode */}
        <h1 className="text-2xl font-bold mb-1 text-center text-black cursor-pointer" {...adminModeProps}>
          {localProfile.name}
        </h1>
        
        {/* Bio with markdown support */}
        <div className="text-sm text-black mb-6 text-center max-w-xs">
          <style jsx>{`
            .bio-content a {
              color: #16a34a; /* green-600 */
              text-decoration: none;
            }
            .bio-content a:hover {
              color: #166534; /* green-800 */
            }
          `}</style>
          <div className="bio-content">
            <ReactMarkdown 
              components={{
                a: ({node, ...props}) => (
                  <a {...props} target="_blank" rel="noopener noreferrer" />
                )
              }}
            >
              {bioContent}
            </ReactMarkdown>
          </div>
        </div>
        
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
