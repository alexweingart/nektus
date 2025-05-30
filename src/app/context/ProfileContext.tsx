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
  generateProfileImage: (profile: UserProfile) => Promise<string | null>;
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
  const hasGeneratedProfileImage = useRef(false);
  
  // Add a function to generate profile image (avatar)
  const generateProfileImage = useCallback(async (profile: UserProfile): Promise<string | null> => {
    try {
      // Only proceed if we have a valid profile with userId
      if (!profile?.userId) {
        console.error('Cannot generate profile image: Invalid profile or missing userId');
        return null;
      }

      // Profile image generation initiated
      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          type: 'avatar',
          profile 
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to generate profile image:', response.status, errorText);
        throw new Error(`Failed to generate profile image: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.imageUrl) {
        console.error('Failed to generate profile image: No imageUrl in response');
        throw new Error('Failed to generate profile image');
      }

      // Profile image URL generated
      return result.imageUrl;
    } catch (error) {
      console.error('Error generating profile image:', error);
      return null;
    }
  }, []);
  const bioGenerationComplete = useRef(false);

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
          // Profile updated in localStorage
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

      
      // If we don't have an existing profile, create a default one first
      const currentProfile = profile || createDefaultProfile(session);

      // Store any non-empty bio in our ref for persistence across operations
      if (currentProfile.bio && currentProfile.bio.trim() !== '') {
        persistedBioRef.current = currentProfile.bio;
        // Bio stored in ref
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

      } else if (currentProfile.bio && currentProfile.bio.trim() !== '') {
        // Case 2: Current profile has non-empty bio - preserve it
        bioToUse = currentProfile.bio;
        // Preserving existing bio
      } else if (persistedBioRef.current && persistedBioRef.current.trim() !== '') {
        // Case 3: Fall back to our persisted ref if available
        bioToUse = persistedBioRef.current;
        // Restoring bio from ref
      } else {
        // Case 4: No bio found anywhere, use empty string
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
      if (!profile?.userId) {
        console.error('Cannot generate background: Invalid profile or missing userId');
        return null;
      }

      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: {
          'Accept': 'text/event-stream',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'background',
          profile
        })
      });

      if (!response.body) {
        console.error('No stream body');
        return null;
      }

      const decoder = new TextDecoder();
      const reader = response.body.getReader();
      let buffer = '';
      let finalB64: string | null = null;

      const updateBackground = (b64: string) => {
        setProfile(prev => {
          if (!prev) return prev;
          return { ...prev, backgroundImage: `data:image/png;base64,${b64}` };
        });
      };

      const extractB64 = (obj: any): string | null => {
        if (!obj || typeof obj !== 'object') return null;
        if (typeof obj.b64_json === 'string') return obj.b64_json;
        if (typeof obj.partial_image_b64 === 'string') return obj.partial_image_b64;
        for (const k in obj) {
          const found = extractB64(obj[k]);
          if (found) return found;
        }
        return null;
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() || '';

        for (const blk of blocks) {
          const dataLines = blk.split('\n').filter(l => l.startsWith('data:')).map(l => l.substring(5));
          if (dataLines.length === 0) continue;
          const jsonStr = dataLines.join('');
          try {
            const evt = JSON.parse(jsonStr);
            const b64 = extractB64(evt);
            if (b64) {
              updateBackground(b64);
              finalB64 = b64; // keep last
            }
          } catch {}
        }
      }

      return finalB64 ? `data:image/png;base64,${finalB64}` : null;
    } catch (e) {
      console.error('Streaming background error', e);
      return null;
    }
  }, []);

  // Generate bio for profile
  const generateBio = useCallback(async (profile: UserProfile): Promise<string | null> => {
    try {
      if (!profile?.userId) {
        console.error('Cannot generate bio: Invalid profile or missing userId');
        return null;
      }

      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'bio',
          profile
        })
      });

      if (!response.ok) {
        const txt = await response.text();
        console.error('Failed to generate bio', txt);
        return null;
      }

      const result = await response.json();
      return result.bio || null;
    } catch (e) {
      console.error('generateBio error', e);
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
  
  // Function to generate content if needed (bio, profile image, and background)
  const generateContentIfNeeded = useCallback(async () => {
    // Skip if no profile, pathname, or we're still loading
    if (!profile || !pathname || isLoading) {
      // Skipping content generation
      return;
    }
    
    // Skip if not on a user-facing page
    if (pathname.startsWith('/admin') || pathname.startsWith('/api')) {
      // Not on user-facing page
      return;
    }
    
    // Check if user is signed in (required for all generation)
    if (!session?.user) {
      return;
    }
    
    try {
      // Ensure we have the latest profile state for operations
      const currentProfile = await loadProfile();
      
      // Guard against null profile
      if (!currentProfile) {
        console.error('Failed to load profile, aborting content generation');
        return;
      }
      
      // Process operations in sequence to avoid race conditions
      let updatedProfile: UserProfile = currentProfile;
      
      // Step 1: Generate bio if needed
      // Only when: signed in, bio is empty, and no attempt this session
      if ((!updatedProfile.bio || updatedProfile.bio.trim() === '') && 
          !hasGeneratedBio.current) {
        hasGeneratedBio.current = true;
        
        try {
          const generatedBio = await generateBio(updatedProfile);
          
          if (generatedBio) {
            // Bio generated successfully
            // Update both the profile and our persistence ref
            persistedBioRef.current = generatedBio;
            // Use a separate save call to avoid mixing with other updates
            const result = await saveProfile({ bio: generatedBio });
            if (result) {
              updatedProfile = result;
            }
          }
        } catch (bioError) {
          console.error('Error generating bio:', bioError);
        } finally {
          // Mark bio generation as complete whether it succeeded or failed
          bioGenerationComplete.current = true;
        }
      } else {
        // If bio already exists or was attempted, mark as complete
        bioGenerationComplete.current = true;
      }
      
      // Step 2: Generate profile image if needed
      // Only when: signed in, profileImage is empty, and no attempt this session
      if (!updatedProfile.profileImage && !hasGeneratedProfileImage.current) {
        // No profile image found
        hasGeneratedProfileImage.current = true;
        
        try {
          // Call the API and pass the profile data
          const response = await fetch('/api/openai', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              type: 'avatar',
              profile: updatedProfile 
            }),
          });
          
          if (!response.ok) {
            throw new Error(`Failed to generate profile image: ${response.statusText}`);
          }
          
          const result = await response.json();
          
          if (result.imageUrl) {
            // Profile image generated successfully
            const imageResult = await saveProfile({
              profileImage: result.imageUrl
            });
            if (imageResult) {
              updatedProfile = imageResult;
            }
          }
        } catch (avatarError) {
          console.error('Error generating profile image:', avatarError);
        }
      }
      
      // Step 3: Generate background image if needed
      // Only when: bio generation is completed (success or failure) and no attempt this session
      if (!updatedProfile.backgroundImage && 
          !hasGeneratedBackground.current && 
          bioGenerationComplete.current) {

        hasGeneratedBackground.current = true;
        
        try {
          const imageUrl = await generateBackgroundImage(updatedProfile);
          
          if (imageUrl) {
            // Background image generated successfully
            
            // Make sure we're not losing any existing bio
            const existingBio = updatedProfile.bio || persistedBioRef.current || '';
            
            // Create an update object with ONLY the background image change
            // We'll explicitly preserve the bio in the saveProfile function
            // Saving generated background image
            const result = await saveProfile({
              backgroundImage: imageUrl,
              // Including bio here helps the saveProfile function prioritize it
              bio: existingBio
            });
          }
        } catch (bgError) {
          console.error('Error generating background image:', bgError);
        }
      }
      
      // Log the final state after all content generation
      const finalProfile = await loadProfile();
      
      // Handle null case for final profile
      if (finalProfile) {
        // Final profile state updated
      } else {
        // Final profile is null
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
        generateBio,
        generateProfileImage
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export default ProfileContext;
