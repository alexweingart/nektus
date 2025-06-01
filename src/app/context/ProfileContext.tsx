"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

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

// Function to generate a GUID
const generateGuid = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Define session user type
interface SessionUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface Session {
  user?: SessionUser | null;
}

// Function to create a default profile with empty strings
const createDefaultProfile = (session?: Session | null): UserProfile => {
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
      console.log('=== LOAD PROFILE STARTED ===');
      
      // Only access localStorage on the client side
      if (typeof window === 'undefined') {
        console.log('Running on server side, returning null');
        return null;
      }
      
      console.log('LocalStorage available, checking for existing profile...');

      const storedData = localStorage.getItem(STORAGE_KEY);
      
      if (storedData) {
        console.log('Found stored profile data');
        console.log('Raw stored data:', storedData);
        
        let parsedProfile: UserProfile;
        try {
          parsedProfile = JSON.parse(storedData) as UserProfile;
          console.log('Successfully parsed stored profile');
        } catch (parseError) {
          console.error('Error parsing stored profile data:', parseError);
          console.log('Creating a new profile due to parse error');
          const defaultProfile = createDefaultProfile(session || undefined);
          setProfile(defaultProfile);
          return defaultProfile;
        }
        
        console.log('Parsed profile:', JSON.stringify(parsedProfile, null, 2));
        let needsUpdate = false; 
        
        // Log the current session info
        console.log('Current session user:', session?.user);

        // Update profile with session data if available
        if (session?.user) {
          console.log('Updating profile with session data');
          let profileChanged = false;
          
          if (session.user.image && parsedProfile.profileImage !== session.user.image) {
            console.log('Updating profile image from session');
            parsedProfile.profileImage = session.user.image;
            profileChanged = true;
          }
          
          if (session.user.name && parsedProfile.name !== session.user.name) {
            console.log('Updating name from session');
            parsedProfile.name = session.user.name;
            profileChanged = true;
          }
          
          if (session.user.email) {
            // Update email if it's different
            if (parsedProfile.contactChannels.email.email !== session.user.email) {
              console.log('Updating email from session');
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
                console.log(`Initializing ${platform} username from email`);
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

        if (needsUpdate) {
          console.log('Profile needs update, saving changes');
          parsedProfile.lastUpdated = Date.now();
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsedProfile));
          } catch (error) {
            console.error('Error saving updated profile to localStorage:', error);
          }
        }

        console.log('Returning parsed profile:', parsedProfile);
        setProfile(parsedProfile);
        return parsedProfile;
      }

      // Create new profile if none exists
      console.log('No stored profile found, creating default profile');
      const defaultProfile = createDefaultProfile(session || undefined);
      console.log('Created default profile:', JSON.stringify(defaultProfile, null, 2));
      
      try {
        const profileString = JSON.stringify(defaultProfile);
        console.log('Saving default profile to localStorage with key:', STORAGE_KEY);
        localStorage.setItem(STORAGE_KEY, profileString);
        
        // Verify the save
        const savedProfile = localStorage.getItem(STORAGE_KEY);
        console.log('Default profile read back from localStorage:', savedProfile);
      } catch (error) {
        console.error('Error saving default profile to localStorage:', error);
      }
      
      setProfile(defaultProfile);
      console.log('Default profile set in state');
      return defaultProfile;
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
      console.log('=== SAVE PROFILE STARTED ===');
      console.log('Profile data to save:', JSON.stringify(profileData, null, 2));
      
      // If we don't have an existing profile, create a default one first
      const currentProfile = profile || createDefaultProfile(session);
      
      // Store any non-empty bio in our ref for persistence across operations
      if (currentProfile.bio && currentProfile.bio.trim() !== '') {
        persistedBioRef.current = currentProfile.bio;
      }
      
      // Determine which bio to use (in order of priority):
      // 1. New bio from profileData if provided
      // 2. Existing bio from current profile
      // 3. Bio from ref
      let bioToUse = '';
      
      if (profileData.bio !== undefined && profileData.bio.trim() !== '') {
        bioToUse = profileData.bio;
        persistedBioRef.current = bioToUse;
      } else if (currentProfile.bio && currentProfile.bio.trim() !== '') {
        bioToUse = currentProfile.bio;
      } else if (persistedBioRef.current && persistedBioRef.current.trim() !== '') {
        bioToUse = persistedBioRef.current;
      }
      
      // Create the updated profile with proper merging
      const updatedProfile: UserProfile = {
        ...currentProfile,  // Start with existing profile
        ...profileData,    // Apply updates from profileData
        bio: bioToUse,     // Use the determined bio
        lastUpdated: Date.now(),
        // Preserve profile image if not being updated
        profileImage: profileData.profileImage !== undefined 
          ? profileData.profileImage 
          : (currentProfile.profileImage || ''),
        // Preserve all existing contact channels and merge with any updates
        contactChannels: {
          ...currentProfile.contactChannels,
          ...(profileData.contactChannels || {})
        }
      };
      
      console.log('Updated profile to save:', JSON.stringify(updatedProfile, null, 2));
      
      // Safely save to localStorage
      if (typeof window !== 'undefined') {
        try {
          const profileString = JSON.stringify(updatedProfile);
          localStorage.setItem(STORAGE_KEY, profileString);
          console.log('Profile saved to localStorage');
          
          // Verify the save by reading it back
          const savedProfile = localStorage.getItem(STORAGE_KEY);
          if (savedProfile) {
            const parsedSaved = JSON.parse(savedProfile);
            console.log('Contact channels after save:', parsedSaved.contactChannels);
          }
          
          console.log('Successfully saved to localStorage');
        } catch (storageError) {
          console.error('Error saving to localStorage:', storageError);
          throw new Error('Failed to save profile to storage');
        }
      } else {
        console.warn('localStorage is not available (server-side rendering)');
      }
      
      // Update the state
      setProfile(updatedProfile);
      console.log('Profile state updated');
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

      interface B64Object {
        b64_json?: string;
        partial_image_b64?: string;
        [key: string]: unknown;
      }

      const extractB64 = (obj: unknown): string | null => {
        if (!obj || typeof obj !== 'object') return null;
        
        const b64Obj = obj as B64Object;
        if (b64Obj.b64_json && typeof b64Obj.b64_json === 'string') return b64Obj.b64_json;
        if (b64Obj.partial_image_b64 && typeof b64Obj.partial_image_b64 === 'string') return b64Obj.partial_image_b64;
        
        // Recursively search in object values
        for (const key in b64Obj) {
          if (Object.prototype.hasOwnProperty.call(b64Obj, key)) {
            const found = extractB64(b64Obj[key]);
            if (found) return found;
          }
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
