"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';

// Types
type PhoneInfo = {
  internationalPhone: string;
  nationalPhone: string;
  userConfirmed: boolean;
};

type EmailInfo = {
  email: string;
  userConfirmed: boolean;
};

type SocialChannel = {
  username: string;
  url: string;
  userConfirmed: boolean;
};

export type UserProfile = {
  userId: string;
  name: string;
  bio: string;
  profileImage: string;
  backgroundImage: string;
  lastUpdated: number;
  contactChannels: {
    phoneInfo: PhoneInfo;
    email: EmailInfo;
    facebook: SocialChannel;
    instagram: SocialChannel;
    x: SocialChannel;
    whatsapp: SocialChannel;
    snapchat: SocialChannel;
    telegram: SocialChannel;
    wechat: SocialChannel;
    linkedin: SocialChannel;
  };
};

type ProfileContextType = {
  profile: UserProfile | null;
  isLoading: boolean;
  saveProfile: (profileData: Partial<UserProfile>) => Promise<UserProfile | null>;
  clearProfile: () => Promise<void>;
  generateBackgroundImage: (profile: UserProfile) => Promise<string | null>;
  generateBio: (profile: UserProfile) => Promise<string | null>;
};

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);
const STORAGE_KEY = 'nektus_user_profile';
const DEFAULT_PROFILE_IMAGE = '/default-avatar.png';

// Function to generate a GUID
const generateGuid = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Function to create a default profile with empty strings
const createDefaultProfile = (session?: any): UserProfile => {
  const email = session?.user?.email || '';
  // Sanitize the email username to only allow letters, numbers, dots, underscores, and hyphens
  const emailUsername = email.split('@')[0]?.toLowerCase().replace(/[^a-z0-9._-]/g, '') || '';

  return {
    userId: generateGuid(),
    name: session?.user?.name || '',
    bio: '',
    profileImage: '',
    backgroundImage: '',
    lastUpdated: Date.now(),
    contactChannels: {
      phoneInfo: {
        internationalPhone: '',
        nationalPhone: '',
        userConfirmed: false
      },
      email: {
        email: email,
        userConfirmed: !!email
      },
      facebook: { 
        username: emailUsername, 
        url: emailUsername ? `https://facebook.com/${emailUsername}` : '', 
        userConfirmed: false 
      },
      instagram: { 
        username: emailUsername, 
        url: emailUsername ? `https://instagram.com/${emailUsername}` : '', 
        userConfirmed: false 
      },
      x: { 
        username: emailUsername, 
        url: emailUsername ? `https://x.com/${emailUsername}` : '', 
        userConfirmed: false 
      },
      linkedin: { 
        username: emailUsername, 
        url: emailUsername ? `https://linkedin.com/in/${emailUsername}` : '', 
        userConfirmed: false 
      },
      snapchat: { 
        username: emailUsername, 
        url: emailUsername ? `https://snapchat.com/add/${emailUsername}` : '', 
        userConfirmed: false 
      },
      whatsapp: { 
        username: '', 
        url: '', 
        userConfirmed: false 
      },
      telegram: { 
        username: '', 
        url: '', 
        userConfirmed: false 
      },
      wechat: { 
        username: '', 
        url: '', 
        userConfirmed: false 
      }
    }
  };
};

// Export the hook to use the profile context
export const useProfile = (): ProfileContextType => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};

// Provider component
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Separate flags for tracking generation status in the current session
  const hasGeneratedBackground = useRef(false);
  const hasGeneratedBio = useRef(false);
  
  // Session storage keys for tracking whether generation has been attempted across page refreshes
  // We'll use the in-memory refs to track generation attempts
  // No need for localStorage keys as we use in-memory refs

  // Load profile from localStorage
  const loadProfile = useCallback(async (): Promise<UserProfile | null> => {
    try {
      const storedData = localStorage.getItem(STORAGE_KEY);
      
      if (storedData) {
        const parsedProfile = JSON.parse(storedData) as UserProfile;
        let needsUpdate = false;

        // Update profile with session data if available
        if (session?.user) {
          let profileChanged = false;
          
          if (session.user.image && parsedProfile.profileImage !== session.user.image) {
            parsedProfile.profileImage = session.user.image;
            profileChanged = true;
          }
          
          if (session.user.name && parsedProfile.name !== session.user.name) {
            parsedProfile.name = session.user.name;
            profileChanged = true;
          }
          
          if (session.user.email) {
            // Update email if it's different
            if (parsedProfile.contactChannels.email.email !== session.user.email) {
              parsedProfile.contactChannels.email = {
                email: session.user.email,
                userConfirmed: true
              };
              profileChanged = true;
            }
            
            // Initialize social media usernames from email if they're empty
            const emailUsername = session.user.email.split('@')[0]?.toLowerCase().replace(/[^a-z0-9._-]/g, '') || '';
            const socialPlatforms = ['facebook', 'instagram', 'x', 'linkedin', 'snapchat'] as const;
            
            for (const platform of socialPlatforms) {
              const channel = parsedProfile.contactChannels[platform];
              if (channel && (!channel.username || channel.username === '')) {
                channel.username = emailUsername;
                // Only update URL if it's empty to preserve any custom URLs
                if (!channel.url || channel.url === '') {
                  channel.url = `https://${platform === 'x' ? 'x.com' : platform}${platform === 'linkedin' ? '/in/' : platform === 'snapchat' ? '/add/' : '/'}${emailUsername}`;
                }
                channel.userConfirmed = false;
                profileChanged = true;
              }
            }
          }
        }

        // Ensure required fields are set
        // Removed default profile image assignment to keep it as empty string

        if (needsUpdate) {
          parsedProfile.lastUpdated = Date.now();
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsedProfile));
          console.log('Updated profile in localStorage:', parsedProfile);
        }

        setProfile(parsedProfile);
        return parsedProfile;
      }

      // Create new profile if none exists
      const newProfile = createDefaultProfile(session);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newProfile));
      setProfile(newProfile);
      return newProfile;
    } catch (error) {
      console.error('Error loading profile:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  // Ref to persist bio between profile saves
  const persistedBioRef = useRef<string>('');

  // Save profile to localStorage
  const saveProfile = useCallback(async (profileData: Partial<UserProfile>): Promise<UserProfile | null> => {
    try {
      // Enhanced logging for profile saves
      console.log('saveProfile called with:', JSON.stringify({
        profileDataKeys: Object.keys(profileData),
        hasBio: 'bio' in profileData,
        bioValue: profileData.bio,
        currentBio: profile?.bio,
        persistedBio: persistedBioRef.current || '[none]'
      }));
      
      // If we don't have an existing profile, create a default one first
      const currentProfile = profile || createDefaultProfile(session);

      // Store any non-empty bio in our ref for persistence across operations
      if (currentProfile.bio && currentProfile.bio.trim() !== '') {
        persistedBioRef.current = currentProfile.bio;
        console.log('Storing non-empty bio in ref:', currentProfile.bio);
      }
      
      // Deep merge contactChannels to preserve any existing values
      const mergedContactChannels = {
        ...currentProfile.contactChannels,
        ...(profileData.contactChannels || {})
      };
      
      // IMPROVED BIO PRESERVATION LOGIC
      // Use highest priority non-empty bio source in this order:
      // 1. New non-empty bio from profileData update
      // 2. Existing non-empty bio from current profile
      // 3. Previously persisted non-empty bio from ref
      // 4. Empty string as last resort
      let bioToUse = '';
      
      if ('bio' in profileData && profileData.bio && profileData.bio.trim() !== '') {
        // Case 1: New non-empty bio from update - use it and store in ref
        bioToUse = profileData.bio;
        persistedBioRef.current = bioToUse;
        console.log('Using new bio from update:', bioToUse);
      } else if (currentProfile.bio && currentProfile.bio.trim() !== '') {
        // Case 2: Current profile has non-empty bio - preserve it
        bioToUse = currentProfile.bio;
        console.log('Preserving existing bio from profile:', bioToUse);
      } else if (persistedBioRef.current && persistedBioRef.current.trim() !== '') {
        // Case 3: Fall back to our persisted ref if available
        bioToUse = persistedBioRef.current;
        console.log('Restoring bio from persistence ref:', bioToUse);
      } else {
        // Case 4: No bio found anywhere, use empty string
        console.log('No bio found in any source, using empty string');
      }
      
      // Create the updated profile with proper merging but EXPLICITLY keep our bio
      const updatedProfile: UserProfile = {
        ...currentProfile,
        ...profileData,
        // CRITICAL: Override any potential empty bio with our preserved value
        bio: bioToUse,
        lastUpdated: Date.now(),
        profileImage: profileData.profileImage !== undefined ? profileData.profileImage : (currentProfile.profileImage || ''),
        contactChannels: mergedContactChannels
      };
      
      // If we managed to preserve a non-empty bio, also update our ref
      if (bioToUse && bioToUse.trim() !== '') {
        persistedBioRef.current = bioToUse;
      }
      
      // Enhanced debug log for bio changes
      console.log('Bio processing:', {
        before: currentProfile.bio || '[empty]',
        bioInUpdate: 'bio' in profileData,
        updateBioValue: profileData.bio || '[empty]',
        persistedBioRef: persistedBioRef.current || '[empty]',
        bioToUse: bioToUse || '[empty]',
        final: updatedProfile.bio || '[empty]',
        bioWasPreserved: bioToUse !== '' && bioToUse === (currentProfile.bio || persistedBioRef.current)
      });
      
      console.log('Profile saved successfully with bio:', updatedProfile.bio || '[empty]');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProfile));
      setProfile(updatedProfile);
      return updatedProfile;
    } catch (error) {
      console.error('Error saving profile:', error);
      throw error;
    }
  }, [profile, session]);

  // Clear profile from localStorage
  const clearProfile = useCallback(async (): Promise<void> => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setProfile(null);
    } catch (error) {
      console.error('Error clearing profile:', error);
    }
  }, []);

  // Generate background image
  const generateBackgroundImage = useCallback(async (profile: UserProfile): Promise<string | null> => {
    try {
      // Only proceed if we have a valid profile with userId
      if (!profile?.userId) {
        console.error('Cannot generate background: Invalid profile or missing userId');
        return null;
      }

      console.log('Generating background image for profile:', profile.userId);
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

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to generate background:', response.status, errorText);
        throw new Error(`Failed to generate background: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Log the entire response for debugging
      console.log('Background generation response:', JSON.stringify(result, null, 2));
      
      // Check if the request was successful and has the expected data structure
      if (!result.success || !result.data?.imageUrl) {
        console.error('Failed to generate background image:', result.error || 'Unknown error');
        throw new Error(result.error || 'Failed to generate background image');
      }

      console.log('Generated background image URL:', result.data.imageUrl);
      return result.data.imageUrl;
    } catch (error) {
      console.error('Error generating background image:', error);
      return null;
    }
  }, []);
  
  // Generate bio for profile
  const generateBio = useCallback(async (profile: UserProfile): Promise<string | null> => {
    try {
      // Only proceed if we have a valid profile with userId
      if (!profile?.userId) {
        console.error('Cannot generate bio: Invalid profile or missing userId');
        return null;
      }

      console.log('Generating bio for profile:', profile.userId);
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

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to generate bio:', response.status, errorText);
        throw new Error(`Failed to generate bio: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Log the entire response for debugging
      console.log('Bio generation response:', JSON.stringify(result, null, 2));
      
      // Extract bio from response
      const bio = result.bio;
      
      if (!bio) {
        console.error('Failed to generate bio: No bio in response');
        throw new Error('Failed to generate bio');
      }

      console.log('Generated bio:', bio);
      return bio;
    } catch (error) {
      console.error('Error generating bio:', error);
      return null;
    }
  }, []);

  // Load profile on mount and when session changes
  useEffect(() => {
    const initializeProfile = async () => {
      await loadProfile();
    };
    initializeProfile();
  }, [loadProfile]);

  // Get the current pathname using the usePathname hook
  const pathname = usePathname();
  
  // Function to generate content if needed (bio and background)
  const generateContentIfNeeded = useCallback(async () => {
    // Skip if no profile, pathname, or we're still loading
    if (!profile || !pathname || isLoading) {
      console.log('Skipping content generation: missing profile, pathname, or still loading');
      return;
    }
    
    // Skip if not on a user-facing page
    if (pathname.startsWith('/admin') || pathname.startsWith('/api')) {
      console.log('Skipping content generation: not on a user-facing page');
      return;
    }
    
    // Skip if we've already tried to generate both background and bio
    if (hasGeneratedBackground.current && hasGeneratedBio.current) {
      console.log('Skipping content generation: already attempted both background and bio generation');
      return;
    }
    
    try {
      // Log initial profile state for debugging (once)
      console.log('Initial profile state before content generation:', {
        hasBio: Boolean(profile.bio),
        bioLength: profile.bio?.length || 0,
        hasBackgroundImage: Boolean(profile.backgroundImage),
        persistedBio: persistedBioRef.current || '[none]'
      });
      
      // Ensure we have the latest profile state for operations
      const currentProfile = await loadProfile();
      
      // Guard against null profile
      if (!currentProfile) {
        console.error('Failed to load profile, aborting content generation');
        return;
      }
      
      // Process operations in sequence to avoid race conditions
      let updatedProfile: UserProfile = currentProfile;
      
      // Step 1: Generate background image if needed
      if (!updatedProfile.backgroundImage && !hasGeneratedBackground.current) {
        console.log('No background image found, generating one...');
        hasGeneratedBackground.current = true;
        
        try {
          const imageUrl = await generateBackgroundImage(updatedProfile);
          
          if (imageUrl) {
            console.log('Background image generated successfully:', imageUrl);
            
            // Make sure we're not losing any existing bio
            const existingBio = updatedProfile.bio || persistedBioRef.current || '';
            
            // Create an update object with ONLY the background image change
            // We'll explicitly preserve the bio in the saveProfile function
            console.log('Saving generated background image to profile with bio:', existingBio || '[empty]');
            const result = await saveProfile({
              backgroundImage: imageUrl,
              // Including bio here helps the saveProfile function prioritize it
              bio: existingBio
            });
            
            // Update our reference if the save was successful
            if (result) {
              updatedProfile = result;
            }
          }
        } catch (bgError) {
          console.error('Error generating background image:', bgError);
        }
      }
      
      // Step 2: Generate bio if needed - only AFTER handling background
      // This ensures bio generation won't be overwritten by background image saving
      if ((!updatedProfile.bio || updatedProfile.bio.trim() === '') && 
          !hasGeneratedBio.current && 
          !persistedBioRef.current) {
        console.log('No bio found, generating one...');
        hasGeneratedBio.current = true;
        
        try {
          const generatedBio = await generateBio(updatedProfile);
          
          if (generatedBio) {
            console.log('Bio generated successfully:', generatedBio);
            // Update both the profile and our persistence ref
            persistedBioRef.current = generatedBio;
            // Use a separate save call to avoid mixing with background image updates
            await saveProfile({ bio: generatedBio });
          }
        } catch (bioError) {
          console.error('Error generating bio:', bioError);
        }
      }
      
      // Log the final state after all content generation
      const finalProfile = await loadProfile();
      
      // Handle null case for final profile
      if (finalProfile) {
        console.log('Final profile state after content generation:', {
          hasBio: Boolean(finalProfile.bio),
          bioLength: finalProfile.bio?.length || 0,
          bioContent: finalProfile.bio || '[empty]',
          hasBackgroundImage: Boolean(finalProfile.backgroundImage),
          persistedBio: persistedBioRef.current || '[none]'
        });
      } else {
        console.log('Final profile is null after content generation', {
          persistedBio: persistedBioRef.current || '[none]'
        });
      }
    } catch (error) {
      console.error('Failed to generate content (bio or background):', error);
    }
  }, [profile, pathname, isLoading, generateBackgroundImage, generateBio, saveProfile, loadProfile]);
  
  // Generate background image when profile loads and has no background
  // Using a ref to track whether we've already initiated content generation for this profile
  const contentGenerationInitiated = useRef(false);
  
  useEffect(() => {
    // Only attempt to generate content if:
    // 1. We have a profile
    // 2. We're not loading
    // 3. We haven't already initiated content generation for this profile instance
    if (profile && !isLoading && !contentGenerationInitiated.current) {
      contentGenerationInitiated.current = true;
      generateContentIfNeeded();
    }
  }, [profile, isLoading, generateContentIfNeeded]);

  return (
    <ProfileContext.Provider
      value={{
        profile,
        isLoading,
        saveProfile,
        clearProfile,
        generateBackgroundImage,
        generateBio
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export default ProfileContext;
