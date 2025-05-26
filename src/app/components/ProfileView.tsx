'use client';

import React, { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import SocialIcon from './SocialIcon';
import { useAdminModeActivator } from './AdminBanner';

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
  
  // Load profile data from various sources
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
              }
            } else if (parsedData) {
              setLocalProfile(parsedData);
              setIsLoading(false);
              
              // Set placeholder bio right away
              setBio(PLACEHOLDER_BIO);
              
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
      console.log('Current bio:', bio);
      console.log('Current background:', bgImage);
      
      // Generate content right away
      if (bio === PLACEHOLDER_BIO) {
        console.log('Bio is placeholder, generating...');
        generateBio();
      }
      
      if (bgImage === DEFAULT_BG_IMAGE) {
        console.log('Background is default, generating...');
        generateBackground();
      }
    }
  }, [localProfile, bio, bgImage]);
  
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
      
      // Try the API call with detailed error logging
      console.log('Making API call to generate bio with profile:', localProfile);
      
      if (localProfile) {
        const response = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'bio',
            profile: localProfile
          }),
        });
        
        // Log full response for debugging
        console.log('API response status:', response.status);
        
        const responseText = await response.text();
        console.log('API response text:', responseText);
        
        if (!response.ok) {
          console.error(`Bio generation API error (${response.status}):`, responseText);
          return; // Keep placeholder
        }
        
        // Parse JSON manually after reading text
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          console.error('Failed to parse API response JSON:', e);
          return; // Keep placeholder
        }
        
        console.log('API response for bio:', data);
        
        if (data.bio && data.bio !== PLACEHOLDER_BIO) {
          console.log('Successfully generated bio:', data.bio);
          
          // Update state immediately
          setBio(data.bio);
          
          // Save to localStorage (merge with existing content)
          const updatedContent = { ...content, bio: data.bio };
          localStorage.setItem('nektus_generated_content', JSON.stringify(updatedContent));
        } else {
          console.error('API returned empty or placeholder bio:', data);
          // Keep placeholder
        }
      }
    } catch (error) {
      console.error('Error in bio generation process:', error);
      // Keep placeholder
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
      
      // Try the API call with detailed error logging
      console.log('Making API call to generate background with profile:', localProfile);
      
      if (localProfile) {
        const response = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'background',
            profile: localProfile
          }),
        });
        
        // Log full response for debugging
        console.log('API response status:', response.status);
        
        const responseText = await response.text();
        console.log('API response text:', responseText);
        
        if (!response.ok) {
          console.error(`Background generation API error (${response.status}):`, responseText);
          return; // Keep placeholder
        }
        
        // Parse JSON manually after reading text
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          console.error('Failed to parse API response JSON:', e);
          return; // Keep placeholder
        }
        
        console.log('API response for background:', data);
        
        if (data.imageUrl && data.imageUrl !== DEFAULT_BG_IMAGE) {
          console.log('Successfully generated background:', data.imageUrl);
          
          // Create an image element to preload the image
          const img = new Image();
          img.onload = () => {
            // Update state only after image is loaded
            setBgImage(data.imageUrl);
            console.log('Background image loaded and applied');
          };
          img.onerror = (e) => {
            console.error('Failed to load background image:', data.imageUrl, e);
            // Keep placeholder
          };
          img.src = data.imageUrl;
          
          // Save to localStorage (merge with existing content)
          const updatedContent = { ...content, backgroundImage: data.imageUrl };
          localStorage.setItem('nektus_generated_content', JSON.stringify(updatedContent));
        } else {
          console.error('API returned empty or default background:', data);
          // Keep placeholder
        }
      }
    } catch (error) {
      console.error('Error in background generation process:', error);
      // Keep placeholder
    } finally {
      setIsAIContentLoading(false);
    }
  };
  
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
  
  // Clear generated content and reset to placeholders
  const clearGeneratedContent = () => {
    setBio(PLACEHOLDER_BIO);
    setBgImage(DEFAULT_BG_IMAGE);
    
    // Clear from localStorage
    localStorage.removeItem('nektus_generated_content');
    console.log('Cleared all generated content');
  };
  
  // Show message if no profile exists
  if (!localProfile) {
    if (isLoading) {
      // Display loading state
      return (
        <div className="flex flex-col items-center justify-center h-screen p-4" style={{ backgroundColor: 'var(--background)' }}>
          <div className="animate-pulse flex flex-col items-center">
            <div className="rounded-full bg-gray-300 h-24 w-24 mb-4"></div>
            <div className="h-4 bg-gray-300 rounded w-32 mb-2"></div>
            <div className="h-3 bg-gray-300 rounded w-24"></div>
          </div>
        </div>
      );
    }
    
    // No profile exists and not loading
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4" style={{ backgroundColor: 'var(--background)' }}>
        <h1 className="text-2xl font-bold text-primary mb-4">Profile Not Found</h1>
        <p className="text-center mb-6">Please create your profile first.</p>
        <Link href="/setup" className="nekt-button w-full text-center">
          Create Profile
        </Link>
      </div>
    );
  }

  // Main profile display
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4" style={{ backgroundColor: 'var(--background)' }}>
      {/* Loading indicator */}
      {isAIContentLoading && (
        <div className="fixed top-4 right-4 bg-blue-500 text-white px-3 py-2 rounded-lg text-sm shadow-lg z-50">
          Generating profile content...
        </div>
      )}
      
      {/* Background image - using img tag for better reliability */}
      {bgImage && bgImage !== DEFAULT_BG_IMAGE && (
        <img
          src={bgImage}
          alt="Profile background"
          className="absolute top-0 left-0 w-full h-full object-cover opacity-20 z-0"
        />
      )}
      
      {/* Debug display - remove in production */}
      {process.env.NODE_ENV !== 'production' && (
        <div className="fixed bottom-4 left-4 bg-white p-3 rounded shadow-lg z-50 text-xs" style={{maxWidth: '300px'}}>
          <div><strong>Current Bio:</strong> {bio === PLACEHOLDER_BIO ? 'Placeholder' : bio.substring(0, 30) + '...'}</div>
          <div><strong>BG Image:</strong> {bgImage === DEFAULT_BG_IMAGE ? 'Default' : 'Custom'}</div>
          <div><strong>BG URL:</strong> <span className="break-all">{bgImage?.substring(0, 30)}...</span></div>
          <div className="flex space-x-2 mt-2">
            <button 
              onClick={clearGeneratedContent}
              className="px-2 py-1 bg-red-500 text-white rounded text-xs"
            >
              Clear Content
            </button>
            <button 
              onClick={() => {
                generateBio();
                generateBackground();
              }}
              className="px-2 py-1 bg-blue-500 text-white rounded text-xs"
            >
              Retry Generation
            </button>
          </div>
        </div>
      )}
      
      {/* Profile content */}
      <div className="flex flex-col items-center justify-center z-10 relative w-full">
        {/* Profile Picture */}
        <div className="mb-6">
          <div className="relative w-24 h-24 overflow-hidden rounded-full border-2 border-white shadow-md">
            <img 
              src={localProfile.picture || '/default-avatar.png'} 
              alt={localProfile.name}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
        
        {/* Name */}
        <h1 className="text-2xl font-bold mb-2">{localProfile.name}</h1>
        
        {/* Bio */}
        <div className="text-center mb-6 max-w-xs">
          <p className="text-gray-700 italic">{bio}</p>
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
