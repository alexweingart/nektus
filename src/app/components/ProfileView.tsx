'use client';

import React, { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import SocialIcon from './SocialIcon';
import { useAdminModeActivator } from './AdminBanner';

// Import types from ProfileContext
import { SocialProfile, UserProfile as ProfileContextUserProfile } from '../context/ProfileContext';

type UserProfile = {
  userId: string;
  name: string;
  email: string;
  picture: string;
  // Replace phone with the new fields
  internationalPhone: string;
  nationalPhone: string;
  internationalPhoneUserConfirmed?: boolean;
  nationalPhoneUserConfirmed?: boolean;
  emailUserConfirmed?: boolean;
  country?: string;
  countryUserConfirmed?: boolean;
  handle?: string;
  socialProfiles: Array<SocialProfile & { filled?: boolean }>;
  lastUpdated?: any;
  bio?: string;
  backgroundImage?: string; // Add backgroundImage to UserProfile type
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
  
  // Local state to manage profile data from multiple sources
  const [localProfile, setLocalProfile] = useState<ExtendedUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // State for progressively loaded content
  const [bio, setBio] = useState<string>("");
  const [bgImage, setBgImage] = useState<string>("/gradient-bg.jpg");
  const [isAIContentLoading, setIsAIContentLoading] = useState<boolean>(false);
  
  // Create a minimal profile from session data
  const createMinimalProfileFromSession = () => {
    if (session?.user) {
      // Create minimal profile with session data
      const minimalProfile: UserProfile = {
        userId: session.user.email || `user-${Date.now()}`, // Fallback ID if email is missing
        name: session.user.name || 'User',
        email: session.user.email || '',
        picture: session.user.image || '',
        internationalPhone: '',
        nationalPhone: '',
        internationalPhoneUserConfirmed: false,
        nationalPhoneUserConfirmed: false,
        country: 'US',
        countryUserConfirmed: false,
        handle: '',
        // Initialize all social profiles with empty values but proper structure
        socialProfiles: [
          { platform: 'facebook', username: '', shareEnabled: true, filled: false },
          { platform: 'instagram', username: '', shareEnabled: true, filled: false },
          { platform: 'x', username: '', shareEnabled: true, filled: false },
          { platform: 'linkedin', username: '', shareEnabled: true, filled: false },
          { platform: 'snapchat', username: '', shareEnabled: true, filled: false },
          { platform: 'whatsapp', username: '', shareEnabled: true, filled: false },
          { platform: 'telegram', username: '', shareEnabled: true, filled: false },
          { platform: 'wechat', username: '', shareEnabled: true, filled: false }
        ] as Array<SocialProfile & { filled?: boolean }>,
        backgroundImage: '/gradient-bg.jpg',
        lastUpdated: Date.now()
      };
      
      // Save to local storage immediately for future loads
      localStorage.setItem('nektus_user_profile_cache', JSON.stringify(minimalProfile));
      
      setLocalProfile(minimalProfile);
      setIsLoading(false);
      
      // Set placeholder bio right away
      setBio(getPlaceholderBio());
      
      // Skip AI content loading on minimal profile creation
      // We'll only load AI content after proper profile setup
    } else {
      setIsLoading(false); // No session available
    }
  };
  
  // Load profile data following the three-step approach:
  // 1. First time: render client-side and save to database
  // 2. Subsequent visits: load from client cache/cookies
  // 3. New device: load from database
  useEffect(() => {
    const loadProfile = () => {
      try {
        // Check if user just completed profile setup - this is a flag set by ProfileSetup
        const justCompletedSetup = sessionStorage.getItem('nektus_profile_setup_completed');
        const triggerAiContent = justCompletedSetup === 'true';
        
        // STEP 1: Try to load from localStorage first (ultra-fast)
        const cachedProfileStr = localStorage.getItem('nektus_user_profile_cache');
        
        if (cachedProfileStr) {
          try {
            const cachedProfile = JSON.parse(cachedProfileStr) as UserProfile;
            
            // Only use the cache if it's for the current user
            // This handles the case where a different user logs in on the same device
            if (session?.user?.email && cachedProfile.userId === session.user.email) {
              console.log('Using profile from local storage cache');
              setLocalProfile(cachedProfile);
              setIsLoading(false);
              
              // Load background image if available
              if (cachedProfile.backgroundImage) {
                setBgImage(cachedProfile.backgroundImage);
              }
              
              // Set bio placeholder - will be replaced with AI content if needed
              setBio(cachedProfile.bio || getPlaceholderBio());
              
              // Generate AI content if any fields are missing
              if (!cachedProfile.bio || !cachedProfile.backgroundImage || !cachedProfile.picture) {
                generateAIContent(cachedProfile);
              }
              
              return; // Successfully loaded from cache
            }
          } catch (error) {
            console.error('Error parsing local storage cache:', error);
            // Continue to other methods if local cache parsing fails
          }
        }
        
        // STEP 2: If no valid cache, check if we have profile data from context
        if (profileContextData.profile) {
          console.log('Using profile from context');
          const profile = profileContextData.profile;
          setLocalProfile(profile);
          setIsLoading(false);
          
          // Load background image if available
          if (profile.backgroundImage) {
            setBgImage(profile.backgroundImage);
          }
          
          // Set bio
          setBio(profile.bio || getPlaceholderBio());
          
          // Save to local storage for future loads
          localStorage.setItem('nektus_user_profile_cache', JSON.stringify(profile));
          
          // Generate AI content if any fields are missing
          if (!profile.bio || !profile.backgroundImage || !profile.picture) {
            generateAIContent(profile);
          }
          
          return; // Successfully loaded from context
        }
        
        // STEP 3: If nothing found, create a minimal profile from session
        if (session?.user) {
          console.log('Creating minimal profile from session data');
          createMinimalProfileFromSession();
        } else {
          setIsLoading(false); // No session available
        }
      } catch (error) {
        console.error('Error in profile loading process:', error);
        // Fallback to minimal profile if anything fails
        if (session?.user) {
          createMinimalProfileFromSession();
        } else {
          setIsLoading(false);
        }
      }
    };
    
    if (typeof window !== 'undefined') {
      loadProfile();
    }
  }, [session, profileContextData.profile]);
  
  // Generate AI content for the profile if needed
  const generateAIContent = async (profile: UserProfile) => {
    if (!profile || isAIContentLoading) return;
    
    // Check if we have the minimum required fields for generation
    if (!profile.name || !profile.email) {
      console.log('Skipping AI content generation - missing required profile data');
      return;
    }
    
    // Set loading state
    setIsAIContentLoading(true);
    
    // Process bio generation request
    const generateBio = async () => {
      try {
        // Only generate if we don't already have a bio
        if (!profile.bio || profile.bio === PLACEHOLDER_BIO) {
          console.log('Generating AI bio...');
          
          const bioResponse = await fetch('/api/ai/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: `Create a brief, friendly bio for ${profile.name}. Keep it general and positive.`,
              type: 'bio',
              profile: profile // Pass the full profile for context
            })
          });
          
          if (bioResponse.ok) {
            const data = await bioResponse.json();
            if (data.content) {
              setBio(data.content);
              
              // Save the generated bio to profile
              if (saveProfile) {
                await saveProfile({ bio: data.content });
              }
            }
          }
        }
      } catch (error) {
        console.error('Error generating bio:', error);
      }
    };
    
    // Process background image generation request
    const generateBackground = async () => {
      try {
        // Only generate if we don't already have a custom background
        if (!profile.backgroundImage || profile.backgroundImage === '/gradient-bg.jpg') {
          console.log('Generating AI background...');
          
          const bgResponse = await fetch('/api/ai/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: `Create a subtle, abstract background gradient for ${profile.name}'s profile.`,
              type: 'background',
              profile: profile // Pass the full profile for context
            })
          });
          
          if (bgResponse.ok) {
            const data = await bgResponse.json();
            if (data.imageUrl) {
              setBgImage(data.imageUrl);
              
              // Save the generated background to profile
              if (saveProfile) {
                await saveProfile({ backgroundImage: data.imageUrl });
              }
            }
          }
        }
      } catch (error) {
        console.error('Error generating background:', error);
      }
    };
    
    // Process avatar generation request - only if we don't already have a Google profile picture
    const generateAvatar = async () => {
      try {
        // Only generate if we don't have a profile picture from Google
        if (!profile.picture || profile.picture === '') {
          console.log('Generating AI avatar...');
          
          const avatarResponse = await fetch('/api/ai/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: `Create a simple, cartoon-style avatar for ${profile.name}.`,
              type: 'avatar',
              profile: profile // Pass the full profile for context
            })
          });
          
          if (avatarResponse.ok) {
            const data = await avatarResponse.json();
            if (data.imageUrl) {
              // Update the profile picture in the profile
              if (saveProfile) {
                await saveProfile({ picture: data.imageUrl });
              }
            }
          }
        }
      } catch (error) {
        console.error('Error generating avatar:', error);
      }
    };
    
    try {
      // Execute all three generation requests in parallel
      await Promise.all([
        generateBio(),
        generateBackground(),
        generateAvatar()
      ]);
    } finally {
      // Always ensure loading state is cleared
      setIsAIContentLoading(false);
    }
  };

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
  
  if (isLoading || !localProfile) {
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
              src={localProfile.picture || '/default-avatar.png'} 
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
                {!localProfile.internationalPhoneUserConfirmed && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white animate-pulse"></div>
                )}
                <SocialIcon
                  platform="phone"
                  username={localProfile.internationalPhone || ''}
                  size="md"
                />
              </div>
            </div>
            
            {/* Email Icon */}
            <div className="flex justify-center">
              <div className="relative">
                {!localProfile.emailUserConfirmed && localProfile.email && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white animate-pulse"></div>
                )}
                <SocialIcon
                  platform="email"
                  username={localProfile.email || ''}
                  size="md"
                />
              </div>
            </div>
            
            {/* Facebook Icon */}
            <div className="flex justify-center">
              <SocialIcon
                platform="facebook"
                username={localProfile.socialProfiles?.find(p => p.platform === 'facebook')?.username || ''}
                size="md"
              />
            </div>
            
            {/* Instagram Icon */}
            <div className="flex justify-center">
              <SocialIcon
                platform="instagram"
                username={localProfile.socialProfiles?.find(p => p.platform === 'instagram')?.username || ''}
                size="md"
              />
            </div>
            
            {/* X Icon */}
            <div className="flex justify-center">
              <SocialIcon
                platform="x"
                username={localProfile.socialProfiles?.find(p => p.platform === 'x')?.username || ''}
                size="md"
              />
            </div>
          </div>
          
          {/* Second row - 5 icons with equal spacing */}
          <div className="flex justify-between">
            {/* WhatsApp Icon */}
            <div className="flex justify-center">
              <SocialIcon
                platform="whatsapp"
                username={localProfile.socialProfiles?.find(p => p.platform === 'whatsapp')?.username || ''}
                size="md"
              />
            </div>
            
            {/* Snapchat Icon */}
            <div className="flex justify-center">
              <SocialIcon
                platform="snapchat"
                username={localProfile.socialProfiles?.find(p => p.platform === 'snapchat')?.username || ''}
                size="md"
              />
            </div>
            
            {/* Telegram Icon */}
            <div className="flex justify-center">
              <SocialIcon
                platform="telegram"
                username={localProfile.socialProfiles?.find(p => p.platform === 'telegram')?.username || ''}
                size="md"
              />
            </div>
            
            {/* WeChat Icon */}
            <div className="flex justify-center">
              <SocialIcon
                platform="wechat"
                username={localProfile.socialProfiles?.find(p => p.platform === 'wechat')?.username || ''}
                size="md"
              />
            </div>
            
            {/* LinkedIn Icon */}
            <div className="flex justify-center">
              <SocialIcon
                platform="linkedin"
                username={localProfile.socialProfiles?.find(p => p.platform === 'linkedin')?.username || ''}
                size="md"
              />
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
