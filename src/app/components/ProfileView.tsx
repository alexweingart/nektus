'use client';

import React, { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { FaPhone, FaEnvelope, FaFacebook, FaInstagram, FaWhatsapp, 
         FaSnapchat, FaTelegram, FaLinkedin } from 'react-icons/fa';
import SocialIcon from './SocialIcon';

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

// Standard button style shared across the application as a React style object
const standardButtonStyle = {
  display: 'block',
  width: '100%',
  backgroundColor: 'var(--primary)',
  color: 'white',
  fontSize: '22px',
  fontWeight: '500',
  padding: '16px 24px',
  borderRadius: '100px',
  boxShadow: 'var(--shadow-md)',
  transition: 'all 0.2s ease-in-out',
  textDecoration: 'none',
  textAlign: 'center' as const, // Type assertion to fix TypeScript error
  border: 'none',
  cursor: 'pointer',
  marginTop: '10px'
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
        socialProfiles: [],
        lastUpdated: Date.now()
      };
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
  
  // Load profile data directly from localStorage immediately on mount
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
            
            // Set the profile data
            setLocalProfile(parsedData);
            setIsLoading(false);
            
            // Set placeholder bio right away
            setBio(getPlaceholderBio(parsedData.name));
            
            // STEP 2: After showing cached data, trigger background AI content loading
            loadAIContent(parsedData);
          } catch (error) {
            console.error('Error parsing cached profile data:', error);
            // Fall back to session data if cache is invalid
            createMinimalProfileFromSession();
          }
        } else if (session?.user) {
          // Fall back to session data if no cache exists
          createMinimalProfileFromSession();
        } else {
          setIsLoading(false); // Nothing to load
        }
      } catch (error) {
        console.error('Error loading profile data:', error);
        setIsLoading(false);
      }
    };
    
    loadProfile();
  }, [session]);
  
  // Format phone number for display
  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '';
    
    // Remove any non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');
    
    // Format based on length
    if (digitsOnly.length === 10) {
      return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
    } else if (digitsOnly.length > 10) {
      // Assume international format
      return `+${digitsOnly.slice(0, digitsOnly.length-10)} (${digitsOnly.slice(-10, -7)}) ${digitsOnly.slice(-7, -4)}-${digitsOnly.slice(-4)}`;
    }
    return phone; // Return original if we can't format it
  };

  // Load AI content asynchronously - optimized to make only one call per type
  const loadAIContent = async (profile: UserProfile) => {
    if (!profile) return;
    
    try {
      setIsAIContentLoading(true);
      
      // Check if we already have bio and background stored in the profile context
      if (profileContextData.profile?.bio && profileContextData.profile?.backgroundImage) {
        setBio(profileContextData.profile.bio);
        setBgImage(profileContextData.profile.backgroundImage);
        setIsAIContentLoading(false);
        return;
      }
      
      // Make a single call for bio generation
      fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'bio',
          profile,
        }),
      }).then(response => {
        if (response.ok) {
          return response.json();
        }
        throw new Error('Bio generation failed');
      }).then(data => {
        const generatedBio = data.bio;
        setBio(generatedBio);
        
        // Save bio to profile context
        saveProfile({ bio: generatedBio });
      }).catch(error => {
        console.error('Error loading bio:', error);
      });
      
      // Make a single call for background image generation
      fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'background',
          profile,
        }),
      }).then(response => {
        if (response.ok) {
          return response.json();
        }
        throw new Error('Background generation failed');
      }).then(data => {
        const imageUrl = data.imageUrl;
        setBgImage(imageUrl);
        
        // Save background image to profile context
        saveProfile({ backgroundImage: imageUrl });
      }).catch(error => {
        console.error('Error loading background:', error);
      }).finally(() => {
        setIsAIContentLoading(false);
      });
    } catch (error) {
      console.error('Error starting AI content generation:', error);
      setIsAIContentLoading(false);
    }
  };

  // Show loading state if profile data is loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show message if no profile exists
  if (!localProfile) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4">
        <h1 className="text-2xl font-bold text-primary mb-4">Profile Not Found</h1>
        <p className="text-center mb-6">Please create your profile first.</p>
        <Link href="/setup" className="bg-primary text-white px-6 py-3 rounded-full font-medium hover:bg-primary-dark transition-colors">
          Create Profile
        </Link>
      </div>
    );
  }

  return (
    <div 
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100%',
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        transition: 'background-image 0.5s ease-in-out',
        backdropFilter: 'blur(10px)',
        backgroundColor: 'rgba(0,0,0,0.3)'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '500px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px',
          animation: 'fadeIn 0.3s ease-out forwards',
          backgroundColor: 'rgba(0,0,0,0.5)',
          borderRadius: '16px',
          margin: '20px'
        }}
      >
        {/* Profile Photo and Name */}
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
          <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', marginBottom: '8px' }}>
            {localProfile.name}
          </h2>
          
          {/* Bio - show placeholder while loading */}
          <p style={{ 
            fontSize: '16px', 
            color: 'rgba(255,255,255,0.8)', 
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
          {/* Create organized icon list with correct order and indicator dots */}
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
              const orderedPlatforms = ['phone', 'email', 'facebook', 'instagram', 'whatsapp', 'snapchat', 'telegram', 'linkedin'];
              
              // Map of available social profiles by platform
              const socialMap: Record<string, SocialProfile> = {};
              if (localProfile.socialProfiles) {
                localProfile.socialProfiles.forEach(social => {
                  if (social.username) {
                    socialMap[social.platform] = social;
                  }
                });
              }
              
              // Create each icon in order - display all required platforms
              return orderedPlatforms.map(platform => {
                // For phone and email only, skip if no data
                if (platform === 'phone' && !localProfile.phone) return null;
                if (platform === 'email' && !localProfile.email) return null;
                
                // Determine if this icon has data (profile exists)
                const hasData = (platform === 'phone' && localProfile.phone) || 
                  (platform === 'email' && localProfile.email) || 
                  (platform !== 'phone' && platform !== 'email' && socialMap[platform]);
                
                // Get username for social platforms
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
                    {/* Add yellow dot indicator only for social media (not phone/email) that have data */}
                    {platform !== 'phone' && platform !== 'email' && hasData && (
                      <div style={{
                        position: 'absolute',
                        top: '2px',
                        right: '2px',
                        width: '8px',
                        height: '8px',
                        borderRadius: '4px',
                        backgroundColor: '#FFD700', // Yellow dot
                        border: '1px solid rgba(0,0,0,0.2)'
                      }} />
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
        
        {/* Edit Profile Link removed as requested */}
        
        {/* Action Buttons */}
        <div style={{ width: '100%', maxWidth: '320px' }}>
          <Link 
            href="/connect"
            style={{
              ...standardButtonStyle,
              backgroundColor: 'var(--primary)',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--primary-dark)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--primary)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}
          >
            Nekt
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ProfileView;
