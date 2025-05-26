'use client';

import React, { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import SocialIcon from './SocialIcon';
import { useAdminModeActivator } from './AdminBanner';
// Import only necessary components

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
const DEFAULT_BG_IMAGE = "/gradient-bg.jpg";

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
      setBio(PLACEHOLDER_BIO);
      
      // The AI content will be generated via the useEffect when placeholder values are detected
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
                setBio(PLACEHOLDER_BIO);
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
                // No need to explicitly call generation - it will be triggered by the useEffect
              }
            } else if (parsedData) {
              setLocalProfile(parsedData);
              setIsLoading(false);
              
              // Set placeholder bio right away
              setBio(PLACEHOLDER_BIO);
              
              // AI content will be generated via the useEffect when placeholder values are detected
              
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
  
  // Effect to detect placeholder values and generate AI content
  useEffect(() => {
    // Only run if we have a profile and either bio is placeholder or background is default
    if (localProfile && 
        (bio === PLACEHOLDER_BIO || bgImage === DEFAULT_BG_IMAGE)) {
      
      console.log('Detected placeholder content - generating AI content');
      
      // Check if we've already tried generating AI content for this user
      const hasTriedGenerating = localStorage.getItem(`nektus_ai_tried_${localProfile.userId}`);
      
      // Only attempt generation if we haven't tried before
      if (!hasTriedGenerating) {
        // Mark that we've tried generating
        localStorage.setItem(`nektus_ai_tried_${localProfile.userId}`, 'true');
        
        // Generate content right away
        if (bio === PLACEHOLDER_BIO) {
          generateBio();
        }
        
        if (bgImage === DEFAULT_BG_IMAGE) {
          generateBackground();
        }
      }
    }
  }, [localProfile, bio, bgImage]);
  
  // If session becomes available later, create profile from it
  useEffect(() => {
    if (!localProfile && session?.user) {
      createMinimalProfileFromSession();
    }
  }, [session, localProfile]);
  
  // Process bio generation request
  const generateBio = async () => {
    console.log('Generating bio...');
    try {
      // Show loading state
      setIsAIContentLoading(true);
      
      // Check if we already have it in localStorage
      const cachedContent = localStorage.getItem('nektus_generated_content');
      const content = cachedContent ? JSON.parse(cachedContent) : {};
      
      if (content.bio && content.bio !== PLACEHOLDER_BIO) {
        console.log('Using cached bio:', content.bio);
        setBio(content.bio);
        return;
      }
      
      // Make API call
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'bio',
          profile: localProfile
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.bio) {
          console.log('Successfully generated bio:', data.bio);
          
          // Update state immediately
          setBio(data.bio);
          
          // Save to localStorage (merge with existing content)
          const updatedContent = { ...content, bio: data.bio };
          localStorage.setItem('nektus_generated_content', JSON.stringify(updatedContent));
        }
      } else {
        console.error('Bio generation request failed:', await response.text());
      }
    } catch (error) {
      console.error('Error generating bio:', error);
    } finally {
      setIsAIContentLoading(false);
    }
  };
  
  // Process background image generation request
  const generateBackground = async () => {
    console.log('Generating background image...');
    try {
      // Show loading state
      setIsAIContentLoading(true);
      
      // Check if we already have it in localStorage
      const cachedContent = localStorage.getItem('nektus_generated_content');
      const content = cachedContent ? JSON.parse(cachedContent) : {};
      
      if (content.backgroundImage && content.backgroundImage !== DEFAULT_BG_IMAGE) {
        console.log('Using cached background:', content.backgroundImage);
        setBgImage(content.backgroundImage);
        return;
      }
      
      // Make API call
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'background',
          profile: localProfile
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.imageUrl) {
          console.log('Successfully generated background:', data.imageUrl);
          
          // Create an image element to preload the image
          const img = new Image();
          img.onload = () => {
            // Update state only after image is loaded
            setBgImage(data.imageUrl);
            console.log('Background image loaded and applied');
          };
          img.onerror = () => {
            console.error('Failed to load background image:', data.imageUrl);
          };
          img.src = data.imageUrl;
          
          // Save to localStorage (merge with existing content)
          const updatedContent = { ...content, backgroundImage: data.imageUrl };
          localStorage.setItem('nektus_generated_content', JSON.stringify(updatedContent));
        }
      } else {
        console.error('Background generation request failed:', await response.text());
      }
    } catch (error) {
      console.error('Error generating background:', error);
    } finally {
      setIsAIContentLoading(false);
    }
  };
  
  // Show message if no profile exists
  if (!localProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4" style={{ backgroundColor: bgImage ? 'transparent' : 'var(--background)' }}>
        {/* Loading indicator */}
        {isAIContentLoading && (
          <div className="fixed top-4 right-4 bg-blue-500 text-white px-3 py-2 rounded-lg text-sm shadow-lg z-50">
            Generating profile content...
          </div>
        )}
        
        {/* Background image */}
        <div
          className="absolute top-0 left-0 w-full h-full opacity-20 z-0"
          style={{
            backgroundImage: bgImage && bgImage !== DEFAULT_BG_IMAGE ? `url(${bgImage})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />
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
