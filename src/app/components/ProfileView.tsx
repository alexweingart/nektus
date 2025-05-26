'use client';

import React, { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import SocialIcon from './SocialIcon';
import { useAdminModeActivator } from './AdminBanner';
import ForceContentGenerator from './ForceContentGenerator';

// Define types for profile data
type SocialProfile = {
  platform: string;
  username: string;
  shareEnabled: boolean;
  filled?: boolean;
};

type UserProfile = {
  userId: string;
  name: string;
  email: string;
  picture: string;
  phone: string;
  socialProfiles: SocialProfile[];
  lastUpdated?: any;
};

// Single instructional placeholder bio
const PLACEHOLDER_BIO = "AI will create a bio here for you, or tap edit profile to write your own";

const getPlaceholderBio = () => {
  return PLACEHOLDER_BIO;
};

// Define extended UserProfile type with AI content fields
type ExtendedUserProfile = UserProfile & {
  bio?: string;
  backgroundImage?: string;
};

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
        phone: '',
        // Initialize all social profiles with empty values but proper structure
        socialProfiles: [
          { platform: 'facebook', username: '', shareEnabled: true, filled: false },
          { platform: 'instagram', username: '', shareEnabled: true, filled: false },
          { platform: 'twitter', username: '', shareEnabled: true, filled: false },
          { platform: 'linkedin', username: '', shareEnabled: true, filled: false },
          { platform: 'snapchat', username: '', shareEnabled: true, filled: false },
          { platform: 'whatsapp', username: '', shareEnabled: true, filled: false },
          { platform: 'telegram', username: '', shareEnabled: true, filled: false }
        ],
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
        const cachedData = localStorage.getItem('nektus_user_profile_cache');
        if (cachedData) {
          try {
            const parsedData = JSON.parse(cachedData) as UserProfile;
            
            // Ensure all required fields exist
            if (!parsedData.userId || !parsedData.name || !parsedData.email) {
              throw new Error('Invalid profile data in cache');
            }
            
            // Ensure social profiles array exists and has proper structure
            if (!parsedData.socialProfiles || !Array.isArray(parsedData.socialProfiles)) {
              // Initialize empty social profiles if missing
              parsedData.socialProfiles = [
                { platform: 'facebook', username: '', shareEnabled: true, filled: false },
                { platform: 'instagram', username: '', shareEnabled: true, filled: false },
                { platform: 'twitter', username: '', shareEnabled: true, filled: false },
                { platform: 'linkedin', username: '', shareEnabled: true, filled: false },
                { platform: 'snapchat', username: '', shareEnabled: true, filled: false },
                { platform: 'whatsapp', username: '', shareEnabled: true, filled: false },
                { platform: 'telegram', username: '', shareEnabled: true, filled: false }
              ];
            }
            
            if (parsedData.userId === profileContextData.profile?.userId) {
              setLocalProfile(profileContextData.profile);
              
              // If there's a saved bio, use it
              if (profileContextData.profile.bio) {
                setBio(profileContextData.profile.bio);
              } else {
                setBio(getPlaceholderBio());
              }
              
              // If there's a saved background image, use it
              if (profileContextData.profile.backgroundImage) {
                setBgImage(profileContextData.profile.backgroundImage);
              }
              
              setIsLoading(false);
              
              // If user just completed profile setup, trigger AI content generation
              if (triggerAiContent) {
                // Clear the flag so we don't regenerate on next load
                sessionStorage.removeItem('nektus_profile_setup_completed');
                // Trigger AI content generation
                loadAIContent(profileContextData.profile);
              }
            } else if (parsedData) {
              setLocalProfile(parsedData);
              setIsLoading(false);
              
              // Set placeholder bio right away
              setBio(getPlaceholderBio());
              
              // Also load AI content in background
              loadAIContent(parsedData);
              
              // Re-save to localStorage with any fixes we made
              localStorage.setItem('nektus_user_profile_cache', JSON.stringify(parsedData));
            }
            
            return; // Successfully loaded from cache
          } catch (error) {
            console.error('Error loading profile from cache:', error);
            // Fall through to session-based creation on error
          }
        }
        
        // STEP 2: If no localStorage data, try to create from session
        if (session?.user) {
          createMinimalProfileFromSession();
        } else {
          // No session available yet, will try again when session loads
          setIsLoading(false);
        }
        
        // STEP 3: If we had a database, we would try to load from there here
        // if no local storage or session data was available
      } catch (error) {
        console.error('Error in profile loading process:', error);
        setIsLoading(false);
      }
    };
    
    loadProfile();
    
    // Load any cached AI content from localStorage
    try {
      const cachedContent = localStorage.getItem('nektus_generated_content');
      if (cachedContent) {
        const parsedContent = JSON.parse(cachedContent);
        if (parsedContent.bio) {
          setBio(parsedContent.bio);
        }
        if (parsedContent.backgroundImage) {
          setBgImage(parsedContent.backgroundImage);
        }
      }
    } catch (error) {
      console.error('Error loading cached AI content:', error);
    }
  }, [session, profileContextData]); // Re-run when session changes
  
  // If session becomes available later, create profile from it
  useEffect(() => {
    if (!localProfile && session?.user) {
      createMinimalProfileFromSession();
    }
  }, [session, localProfile]);
  
  // Format phone number for display
  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '';
    
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Check if US/Canada format (10 digits)
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } 
    
    // International number - just add a plus if needed
    return phone.startsWith('+') ? phone : `+${cleaned}`;
  };
  
  // Load AI content asynchronously - makes API calls without blocking the UI and only fires once per user
  const loadAIContent = async (profile: UserProfile) => {
    if (!profile) return;
    
    // Set initial placeholder states while waiting for AI content
    if (!bio) {
      setBio(getPlaceholderBio());
    }
    
    // Check localStorage for AI content status flag to ensure we only make these calls once per user
    const aiContentStatusKey = `nektus_ai_content_status_${profile.userId}`;
    const aiContentStatus = localStorage.getItem(aiContentStatusKey);
    
    // If we've already triggered AI content generation for this user, don't do it again
    if (aiContentStatus === 'triggered') {
      return;
    }
    
    // Mark that we've started the AI content generation process
    localStorage.setItem(aiContentStatusKey, 'triggered');
    setIsAIContentLoading(true);
    
    // Process bio generation request
    const generateBio = async () => {
      try {
        const response = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'bio',
            profile
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.bio) {
            setBio(data.bio);
            localStorage.setItem('nektus_generated_content', JSON.stringify({ bio: data.bio }));
          }
        }
      } catch (error) {
        console.error('Error generating bio:', error);
        // Keep using the placeholder bio on error
      }
    };
    
    // Process background image generation request
    const generateBackground = async () => {
      try {
        const response = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'background',
            profile
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.imageUrl) {
            setBgImage(data.imageUrl);
            localStorage.setItem('nektus_generated_content', JSON.stringify({ backgroundImage: data.imageUrl }));
          }
        }
      } catch (error) {
        console.error('Error generating background:', error);
        // Keep using the default background on error
      }
    };
    
    // Process avatar generation request - only if we don't already have a Google profile picture
    const generateAvatar = async () => {
      // Skip avatar generation if we already have a Google profile picture
      if (profile.picture && profile.picture.includes('googleusercontent.com')) {
        return;
      }
      
      try {
        const response = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'avatar',
            profile
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.imageUrl) {
            // Update local profile picture without saving to server
            setLocalProfile(prev => prev ? {
              ...prev,
              picture: data.imageUrl
            } : null);
          }
        }
      } catch (error) {
        console.error('Error generating avatar:', error);
        // Keep using the default avatar on error
      }
    };

    // Launch all generation requests in parallel without awaiting them
    // This ensures the UI isn't blocked while waiting for responses
    generateBio();
    generateBackground();
    generateAvatar();
    
    // After a timeout, mark the loading as complete even if all requests haven't finished
    // This ensures the loading indicator doesn't stay forever if something goes wrong
    setTimeout(() => {
      setIsAIContentLoading(false);
    }, 10000); // 10 second timeout
  };

  // Show message if no profile exists
  if (!localProfile) {
    // Handler for when ForceContentGenerator generates content
    const handleContentGenerated = (data: { bio: string, backgroundImage: string }) => {
      if (data.bio) {
        setBio(data.bio);
      }
      if (data.backgroundImage) {
        setBgImage(data.backgroundImage);
      }
    };

    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4" style={{ backgroundColor: bgImage ? 'transparent' : 'var(--background)' }}>
        {/* Add the ForceContentGenerator component for direct content generation */}
        {process.env.NODE_ENV !== 'production' && session?.user?.email && (
          <ForceContentGenerator 
            email={session.user.email} 
            onGenerated={handleContentGenerated}
          />
        )}
        
        {/* Background image - only show if we have one */}
        {bgImage && (
          <div
            className="absolute top-0 left-0 w-full h-full opacity-20 z-0"
            style={{
              backgroundImage: `url(${bgImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        )}
      </div>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4" style={{ backgroundColor: 'var(--background)' }}>
        <div className="animate-pulse">
          <div className="rounded-full bg-gray-300 h-24 w-24 mb-4 mx-auto"></div>
          <div className="h-6 bg-gray-300 rounded w-48 mb-4 mx-auto"></div>
          <div className="h-4 bg-gray-300 rounded w-64 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start py-6 overflow-x-hidden" style={{ backgroundColor: 'var(--background)' }}>
      <div className="max-w-md w-full px-4 sm:px-6 flex flex-col items-center">
        {/* Profile Photo and Name - directly on background */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Link href="/setup">
            {localProfile.picture ? (
              <div style={{ 
                width: '120px', 
                height: '120px', 
                margin: '0 auto 16px', 
                borderRadius: '60px', 
                overflow: 'hidden', 
                border: '3px solid white',
                cursor: 'pointer',
                transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out'
              }}>
                <img 
                  src={localProfile.picture} 
                  alt={localProfile.name || 'Profile'} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            ) : (
              <div style={{ 
                width: '120px', 
                height: '120px', 
                margin: '0 auto 16px', 
                borderRadius: '60px', 
                backgroundColor: '#e0e0e0', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out'
              }}>
                <span style={{ fontSize: '48px', fontWeight: 'bold' }}>{localProfile.name?.[0] || '?'}</span>
              </div>
            )}
          </Link>
          <h2 
            style={{ 
              fontSize: '28px', 
              fontWeight: 'bold', 
              color: 'var(--foreground)', 
              marginBottom: '8px',
              cursor: 'pointer' // Add cursor pointer to indicate it's clickable
            }}
            {...adminModeProps} // Add admin mode activation on double click
          >
            {localProfile.name}
          </h2>
          
          {/* Bio - show placeholder while loading */}
          <p style={{ 
            fontSize: '16px', 
            color: 'var(--foreground)', 
            maxWidth: '320px',
            margin: '0 auto',
            fontStyle: 'italic',
            transition: 'opacity 0.3s ease'
          }}>
            {bio || (isAIContentLoading ? 'Creating your personalized bio...' : 'No bio available')}
          </p>
        </div>
        
        {/* Contact & Social Icons - Arranged in 2 rows */}
        <div style={{ marginBottom: '24px', width: '100%', maxWidth: '320px' }}>
          {/* First row - 4 icons with equal spacing */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginBottom: '20px' 
          }}>
            {/* Phone Icon */}
            <div className="flex justify-center">
              <SocialIcon
                platform="phone"
                username={localProfile.phone || ''}
                size="md"
              />
            </div>
            
            {/* Email Icon */}
            {localProfile.email && (
              <div className="flex justify-center">
                <SocialIcon
                  platform="email"
                  username={localProfile.email}
                  size="md"
                />
              </div>
            )}
            
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
          </div>
          
          {/* Second row - 5 icons with equal spacing */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
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
            
            {/* Twitter Icon */}
            <div className="flex justify-center">
              <SocialIcon
                platform="twitter"
                username={localProfile.socialProfiles?.find(p => p.platform === 'twitter')?.username || ''}
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
          <div className="mt-2 text-center">
            <Link 
              href="/edit"
              className="text-green-600 hover:text-green-700 no-underline"
            >
              Edit Profile
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileView;
