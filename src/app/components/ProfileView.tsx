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

// Function to get placeholder bio
const PLACEHOLDER_BIOS = [
  "Creative soul with an adventurous spirit",
  "Professional dreamer, part-time explorer",
  "Coffee lover, always smiling",
  "Digital nomad chasing sunsets",
  "Tech enthusiast with a big heart",
  "Passionate about connecting people",
  "Creating moments worth sharing"
];

const getPlaceholderBio = (name: string | null | undefined) => {
  if (!name) return PLACEHOLDER_BIOS[0];
  const nameSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return PLACEHOLDER_BIOS[nameSum % PLACEHOLDER_BIOS.length];
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
      setBio(getPlaceholderBio(minimalProfile.name));
      
      // Load AI content for this minimal profile
      loadAIContent(minimalProfile);
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
            
            // Valid profile found in localStorage
            setLocalProfile(parsedData);
            setIsLoading(false);
            
            // Set placeholder bio right away
            setBio(getPlaceholderBio(parsedData.name));
            
            // Also load AI content in background
            loadAIContent(parsedData);
            
            // Re-save to localStorage with any fixes we made
            localStorage.setItem('nektus_user_profile_cache', JSON.stringify(parsedData));
            
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
  }, [session]); // Re-run when session changes
  
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
  
  // Load AI content asynchronously - optimized to make only one call per type
  const loadAIContent = async (profile: UserProfile) => {
    if (!profile) return;
    
    // Skip if bio already exists
    if (!bio) {
      setIsAIContentLoading(true);
      
      try {
        // In a real app, this would make an API call to generate content
        // For now, we'll just use the placeholder and add a delay to simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Get customized bio based on user's name
        const generatedBio = getPlaceholderBio(profile.name);
        setBio(generatedBio);
        
        // Update the background image if needed
        const imageOptions = [
          "/gradient-bg.jpg",
          "/gradient-blue.jpg",
          "/gradient-purple.jpg"
        ];
        
        // Choose image based on user's email or name
        const nameSum = (profile.name || profile.email || "").split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
        const selectedImage = imageOptions[nameSum % imageOptions.length];
        setBgImage(selectedImage);
        
        // If we had real AI-generated content, we'd save to profile in context here
        // saveProfile({
        //   ...profile,
        //   bio: generatedBio,
        //   backgroundImage: selectedImage
        // });
        
      } catch (error) {
        console.error('Error generating AI content:', error);
      } finally {
        setIsAIContentLoading(false);
      }
    }
  };
  
  // Show message if no profile exists
  if (!localProfile) {
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
          {/* Create organized icon list with correct order */}
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gridTemplateRows: 'repeat(2, auto)',
            gap: '16px',
            justifyContent: 'center',
            margin: '0 auto'
          }}>
            {(() => {
              // Define icons in correct order
              const orderedPlatforms = ['phone', 'email', 'facebook', 'instagram', 'whatsapp', 'snapchat', 'twitter', 'telegram', 'linkedin'];
              
              // Map of available social profiles by platform
              const socialMap: Record<string, SocialProfile> = {};
              if (localProfile.socialProfiles) {
                localProfile.socialProfiles.forEach((social: SocialProfile) => {
                  // Map all social profiles, even if username is empty
                  // This ensures the icons are displayed but can be configured later
                  socialMap[social.platform] = social;
                });
              }
              
              // Create each icon in order - display all required platforms
              return orderedPlatforms.map(platform => {
                // For phone
                if (platform === 'phone') {
                  // Always show phone icon, even if number is empty
                  // This ensures consistency in the UI
                  return (
                    <div key={platform} className="flex justify-center">
                      <SocialIcon
                        platform={platform as any}
                        username={localProfile.phone || ''}
                        size="md"
                      />
                    </div>
                  );
                }
                
                // For email
                if (platform === 'email' && (!localProfile.email || localProfile.email.trim() === '')) return null;
                
                // For social profiles
                if (platform !== 'phone' && platform !== 'email') {
                  // Only show if profile exists
                  if (!socialMap[platform]) return null;
                  
                  // For now we'll display all social platforms even if username is empty
                  // This makes it clear to the user which platforms are supported
                  // In a real app, you might want to hide empty ones or show them differently
                }
                
                // Get username for platforms
                const username = platform === 'phone' ? localProfile.phone :
                                platform === 'email' ? localProfile.email :
                                socialMap[platform]?.username || '';
                
                return (
                  <div key={platform} className="flex justify-center">
                    <SocialIcon
                      platform={platform as any}
                      username={username}
                      size="md"
                    />
                  </div>
                );
              });
            })()}
          </div>
        </div>
        
        {/* Action Buttons */}
        <div style={{ width: '100%', maxWidth: '320px' }}>
          <Link 
            href="/connect"
            className="nekt-button w-full text-center"
          >
            Nekt
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ProfileView;
