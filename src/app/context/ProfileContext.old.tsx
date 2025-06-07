"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { getAuth, User } from 'firebase/auth';
import { ProfileService } from '@/lib/firebase/profileService';

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
  saveProfile: (profileData: Partial<UserProfile>, options?: { directUpdate?: boolean }) => Promise<UserProfile | null>;
  clearProfile: () => Promise<void>;
  generateBackgroundImage: (profile: UserProfile) => Promise<string | null>;
  generateBio: (profile: UserProfile) => Promise<string | null>;
  generateProfileImage: (profile: UserProfile) => Promise<string | null>;
};

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

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
  const profileRef = useRef<UserProfile | null>(null);
  useEffect(() => { profileRef.current = profile; }, [profile]);
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
      // Error generating profile image
      return null;
    }
  }, []);

  // Generic deep merge helper: merges only non-empty incoming values (recursively)
  const mergeNonEmpty = <T extends Record<string, any>>(base: T, incoming: Partial<T>): T => {
    const result: any = { ...base };
    Object.entries(incoming || {}).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      if (typeof v === 'object' && !Array.isArray(v)) {
        result[k] = mergeNonEmpty(result[k] || {}, v as Record<string, any>);
      } else if (typeof v === 'string') {
        if (v.trim() !== '') result[k] = v;
      } else {
        result[k] = v;
      }
    });
    return result as T;
  };

  /**
   * Saves the profile to Firestore
   * @param profileData - The profile data to save
   * @param options - Options for the save operation
   * @returns The saved profile or null if there was an error
   */
  const saveProfile = useCallback(async (
    profileData: Partial<UserProfile>,
    options: { directUpdate?: boolean } = {}
  ): Promise<UserProfile | null> => {
    try {
      console.log('=== SAVING PROFILE ===');
      console.log('Options:', options);
      console.log('Incoming profile data:', JSON.parse(JSON.stringify(profileData)));
      
      const auth = getAuth();
      if (!auth) {
        throw new Error('Firebase auth not available');
      }
      
      const currentUser = auth.currentUser as User | null;
      if (!currentUser?.uid) {
        throw new Error('User not authenticated');
      }
      
      // Get current profile or create a new one
      const current = profileRef.current || createDefaultProfile(session);
      console.log('Current profile before save:', JSON.parse(JSON.stringify(current)));
      
      let merged: UserProfile;
      
      if (options.directUpdate) {
        console.log('Performing direct update (from Edit Profile)');
        // For direct updates, do a direct spread
        merged = {
          ...current,
          ...profileData,
          userId: currentUser.uid,
          lastUpdated: Date.now()
        } as UserProfile;
        
        // Ensure contactChannels is properly merged if it exists in profileData
        if (profileData.contactChannels) {
          merged.contactChannels = {
            ...(current.contactChannels || {}),
            ...profileData.contactChannels
          };
        }
      } else {
        console.log('Performing normal merge');
        // For other updates, use the mergeNonEmpty logic
        merged = {
          ...mergeNonEmpty(current, profileData),
          userId: currentUser.uid,
          lastUpdated: Date.now()
        } as UserProfile;
      }
      
      console.log('Merged profile to be saved:', JSON.parse(JSON.stringify(merged)));

      // Persist to Firestore
      await ProfileService.saveProfile(merged);
      console.log('Profile saved to Firestore');

      // Update local state with the merged profile
      setProfile(merged);
      console.log('Local profile state updated');
      
      return merged;
    } catch (err) {
      console.error('Error saving profile:', err);
      throw err;
    } finally {
      console.log('=== SAVE PROFILE COMPLETE ===');
    }
  }, [session]);

  /**
   * Clears the user's profile from Firestore and local state
   * @returns Promise that resolves when the profile is cleared
   */
  const clearProfile = useCallback(async (): Promise<void> => {
    try {
      const auth = getAuth();
      if (!auth) {
        console.error('Firebase auth not available');
        return;
      }
      
      const currentUser = auth.currentUser as User | null;
      if (!currentUser?.uid) {
        console.error('No authenticated user');
        return;
      }
      
      await ProfileService.deleteProfile(currentUser.uid);
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
        // Delegate to saveProfile so we reuse the same merge logic
        void saveProfile({ backgroundImage: `data:image/png;base64,${b64}` });
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

  // Load profile from Firestore
  const loadProfile = useCallback(async (): Promise<UserProfile | null> => {
    try {
      // Only run on client side
      if (typeof window === 'undefined') {
        return null;
      }

      // Get current user from auth
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        // If no user is logged in, return a default profile
        const defaultProfile = createDefaultProfile(session || undefined);
        setProfile(defaultProfile);
        setIsLoading(false);
        return defaultProfile;
      }

      // Try to load profile from Firestore
      const loadedProfile = await ProfileService.getProfile(currentUser.uid);
      
      if (loadedProfile) {
        let profileToUse = loadedProfile;
        let profileChanged = false;
        
        // Update profile with session data if available
        if (session?.user) {
          // Update profile image if different and we have a new one
          if (session.user.image && loadedProfile.profileImage !== session.user.image) {
            profileToUse.profileImage = session.user.image;
            profileChanged = true;
          }
          
          // Update name if different and we have a new one
          if (session.user.name && loadedProfile.name !== session.user.name) {
            profileToUse.name = session.user.name;
            profileChanged = true;
          }
          
          // Update email if different and we have a new one
          if (session.user.email) {
            if (loadedProfile.contactChannels.email.email !== session.user.email) {
              profileToUse.contactChannels.email = {
                email: session.user.email,
                userConfirmed: true
              };
              profileChanged = true;
            }
            
            // Initialize social media usernames from email if they're empty
            const emailUsername = session.user.email.split('@')[0]?.toLowerCase().replace(/[^a-z0-9._-]/g, '') || '';
            const socialPlatforms = ['facebook', 'instagram', 'x', 'linkedin', 'snapchat'] as const;
            
            for (const platform of socialPlatforms) {
              const channel = profileToUse.contactChannels[platform];
              if (channel && (!channel.username || channel.username === '')) {
                channel.username = emailUsername;
                if (!channel.url || channel.url === '') {
                  channel.url = `https://${platform === 'x' ? 'x.com' : platform}${platform === 'linkedin' ? '/in/' : platform === 'snapchat' ? '/add/' : '/'}${emailUsername}`;
                }
                channel.userConfirmed = false;
                profileChanged = true;
              }
            }
          }
        }
        
        // Save back to Firestore if changes were made
        if (profileChanged) {
          await ProfileService.saveProfile(profileToUse);
        }
        
        setProfile(profileToUse);
        return profileToUse;
      } else {
        // No profile exists, create a new one
        const defaultProfile = createDefaultProfile(session || undefined);
        const auth = getAuth();
        if (!auth.currentUser) {
          throw new Error('No authenticated user');
        }
        defaultProfile.userId = auth.currentUser.uid;
        
        // Save the new profile to Firestore
        await ProfileService.saveProfile(defaultProfile);
        
        setProfile(defaultProfile);
        return defaultProfile;
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      // Return a default profile in case of error
      const defaultProfile = createDefaultProfile(session || undefined);
      setProfile(defaultProfile);
      return defaultProfile;
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  // Set up profile subscription and load initial data
  useEffect(() => {
    const auth = getAuth();
    if (!auth) {
      console.error('Firebase auth not available');
      return;
    }
    
    let unsubscribe: (() => void) | null = null;
    let isMounted = true;
    
    const initializeProfile = async () => {
      try {
        if (!isMounted) return;
        
        // Wait for Firebase auth to initialize
        await new Promise<void>((resolve, reject) => {
          try {
            const auth = getAuth();
            // If auth is already initialized, resolve immediately
            const currentUser = auth.currentUser as User | null;
            if (currentUser) {
              resolve();
              return;
            }
            
            // Otherwise, wait for auth state change
            const unsubscribeAuth = auth.onAuthStateChanged(
              (user: User | null) => {
                resolve();
                unsubscribeAuth();
              },
              (error: Error) => {
                console.error('Auth state change error:', error);
                reject(error);
              }
            );
          } catch (error) {
            console.error('Error initializing auth:', error);
            reject(error);
          }
        });
        
        if (!isMounted) return;
        
        const currentUser = getAuth().currentUser as User | null;
        if (!currentUser) {
          // If no user is logged in, load a default profile
          const defaultProfile = createDefaultProfile(session || undefined);
          if (isMounted) {
            setProfile(defaultProfile);
            setIsLoading(false);
          }
          return;
        }
        
        // Set up real-time subscription
        const unsubscribeFn = await ProfileService.subscribeToProfile(
          currentUser.uid,
          (updatedProfile) => {
            if (updatedProfile && isMounted) {
              setProfile(updatedProfile);
            }
          }
        );
        
        // Store the unsubscribe function
        unsubscribe = () => {
          if (typeof unsubscribeFn === 'function') {
            unsubscribeFn();
          } else if (typeof unsubscribeFn === 'object' && unsubscribeFn !== null && 'unsubscribe' in unsubscribeFn) {
            // Handle case where unsubscribe is an object with an unsubscribe method
            (unsubscribeFn as { unsubscribe: () => void }).unsubscribe();
          }
        };
        
        // Load initial data
        if (isMounted) {
          await loadProfile();
        }
      } catch (error) {
        console.error('Error initializing profile:', error);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    
    initializeProfile();
    
    // Cleanup on unmount
    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [loadProfile, session]);

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
          // bioGenerationComplete.current = true;
        }
      } else {
        // If bio already exists or was attempted, mark as complete
        // bioGenerationComplete.current = true;
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
          !hasGeneratedBackground.current) {

        hasGeneratedBackground.current = true;
        
        try {
          const imageUrl = await generateBackgroundImage(updatedProfile);
          
          if (imageUrl) {
            // Background image generated successfully
            
            // Make sure we're not losing any existing bio
            const existingBio = updatedProfile.bio || '';
            
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
