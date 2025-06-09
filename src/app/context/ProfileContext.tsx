"use client";

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ProfileService } from '@/lib/firebase/profileService';
import { UserProfile } from '@/types/profile';
import { createDefaultProfile as createDefaultProfileService } from '@/lib/services/newUserService';
import { orchestrateCompleteAIGeneration } from '@/lib/services/aiGenerationService';

// Types
type ProfileContextType = {
  profile: UserProfile | null;
  isLoading: boolean;
  isSaving: boolean;
  isDeletingAccount: boolean;
  isNavigatingFromSetup: boolean;
  streamingBackgroundImage: string | null;
  saveProfile: (data: Partial<UserProfile>, options?: { directUpdate?: boolean; skipUIUpdate?: boolean }) => Promise<UserProfile | null>;
  clearProfile: () => Promise<void>;
  generateBackgroundImage: (profile: UserProfile) => Promise<string | null>;
  generateBio: (profile: UserProfile) => Promise<string | null>;
  generateProfileImage: (profile: UserProfile) => Promise<string | null>;
  getLatestProfile: () => UserProfile | null;
  setNavigatingFromSetup: (navigating: boolean) => void;
};

// Create context
const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

// Helper functions
const createDefaultProfile = (session?: any): UserProfile => {
  if (!session) {
    throw new Error('Session required to create default profile');
  }
  
  const result = createDefaultProfileService({ session });
  return result.profile;
};

// Provider component
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status: authStatus, update } = useSession();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isNavigatingFromSetup, setIsNavigatingFromSetup] = useState(false);
  const [streamingBackgroundImage, setStreamingBackgroundImage] = useState<string | null>(null);
  
  // Mobile fix: Also store streaming background image in ref for persistence across re-renders
  const streamingBackgroundImageRef = useRef<string | null>(null);
  
  const loadingRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);
  const pathname = usePathname();
  const bioGeneratedRef = useRef(false);
  const avatarGeneratedRef = useRef(false);
  const backgroundImageGeneratedRef = useRef(false);
  const generatingBackgroundImageRef = useRef(false); // Add this to prevent concurrent background image generations
  const sessionUpdatedRef = useRef(false); // Add this to prevent circular updates
  const savingRef = useRef(false); // Add mutex for save operations
  
  // Ref to store the latest profile data without triggering re-renders
  const profileRef = useRef<UserProfile | null>(null);

  // Profile creation/loading effect - first try to load existing, then create if needed
  useEffect(() => {
    if (authStatus === 'authenticated' && session?.user?.id && !profile && !loadingRef.current) {
      console.log('[ProfileContext] Loading/creating profile for authenticated user:', session.user.id);
      loadingRef.current = true;
      
      // First try to load existing profile from Firebase
      ProfileService.getProfile(session.user.id)
        .then(async existingProfile => {
          if (existingProfile) {
            console.log('[ProfileContext] Found existing profile, loading it');
            setProfile(existingProfile);
            profileRef.current = existingProfile;
            setIsLoading(false);
            
            // Update session with phone data from existing profile if it has phone info
            if (existingProfile.contactChannels?.phoneInfo?.internationalPhone && !sessionUpdatedRef.current && update) {
              const phoneData = {
                profile: {
                  contactChannels: {
                    phoneInfo: {
                      internationalPhone: existingProfile.contactChannels.phoneInfo.internationalPhone,
                      nationalPhone: existingProfile.contactChannels.phoneInfo.nationalPhone,
                      userConfirmed: existingProfile.contactChannels.phoneInfo.userConfirmed
                    }
                  }
                }
              };
              
              try {
                console.log('[ProfileContext] Updating session with existing profile phone data');
                await update(phoneData);
                sessionUpdatedRef.current = true;
              } catch (error) {
                console.error('[ProfileContext] Error updating session with existing profile:', error);
              }
            }
          } else {
            console.log('[ProfileContext] No existing profile found, creating new one');
            // Create new profile only if none exists
            const newProfile = createDefaultProfile(session);
            
            // React 18 will automatically batch these state updates
            setProfile(newProfile);
            profileRef.current = newProfile;
            setIsLoading(false);
            
            // Trigger AI generation after profile is set (only on setup page for NEW profiles)
            if (pathname === '/setup') {
              console.log('[ProfileContext] Triggering AI generation for new profile');
              setTimeout(() => {
                orchestrateCompleteAIGeneration(
                  newProfile,
                  setStreamingBackgroundImage,
                  {
                    bioGeneratedRef,
                    avatarGeneratedRef,
                    backgroundImageGeneratedRef
                  },
                  saveProfile
                ).catch(error => {
                  console.error('[ProfileContext] AI generation failed:', error);
                });
              }, 1000); // Give UI time to render first
            }
          }
        })
        .catch(error => {
          console.error('[ProfileContext] Failed to load profile, creating new one:', error);
          // Fallback to creating new profile if loading fails
          const newProfile = createDefaultProfile(session);
          setProfile(newProfile);
          profileRef.current = newProfile;
          setIsLoading(false);
        })
        .finally(() => {
          // Reset loading flag
          loadingRef.current = false;
        });
    }
  }, [authStatus, session?.user?.id, profile, pathname, update]);

  // Handle unauthenticated users
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      setIsLoading(false);
      if (profile) {
        setProfile(null);
        profileRef.current = null;
      }
    }
  }, [authStatus, profile]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    const currentUserId = session?.user?.id;
    if (currentUserId && currentUserId !== lastUserIdRef.current) {
      console.log('[ProfileContext] User changed, resetting session update flag');
      sessionUpdatedRef.current = false;
      lastUserIdRef.current = currentUserId;
    }
  }, [session?.user?.id]);

  // Save profile to Firestore
  const saveProfile = useCallback(async (data: Partial<UserProfile>, options: { directUpdate?: boolean; skipUIUpdate?: boolean } = {}): Promise<UserProfile | null> => {
    if (!session?.user?.id) {
      console.error('[ProfileContext] No authenticated user');
      return null;
    }

    // Wait for any ongoing save operations to complete
    while (savingRef.current) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Set saving lock
    savingRef.current = true;

    // Set saving state to prevent setup effects from running during form submission
    const wasFormSubmission = !options.directUpdate && data.contactChannels?.phoneInfo;
    if (wasFormSubmission) {
      setIsSaving(true);
    }

    try {
      const current = profileRef.current || profile || createDefaultProfile(session);
      const merged = options.directUpdate 
        ? { ...current, ...data, userId: session.user.id, lastUpdated: Date.now() }
        : { ...mergeNonEmpty(current, data), userId: session.user.id, lastUpdated: Date.now() };

      // Process social media data only for new profiles
      if (merged.contactChannels && !current.userId) {
        // Removed unused imports
      }

      // Always update the ref so subsequent operations can access updated data
      profileRef.current = merged;
      
      // Skip React state updates for:
      // 1. Form submissions (navigating away immediately)  
      // 2. Background operations (directUpdate - bio generation, social media generation)
      // 3. Explicit skipUIUpdate requests
      const skipReactUpdate = wasFormSubmission || options.skipUIUpdate;
      
      if (!skipReactUpdate) {
        setProfile(merged);
      } else {
        // However, if this is a background operation and the current profile state is stale (empty userId),
        // we should update it to prevent UI showing empty data during streaming
        if (options.directUpdate && (!profile || !profile.userId) && merged.userId) {
          setProfile(merged);
        }
      }
      
      // Save to Firebase
      try {
        await ProfileService.saveProfile(merged);
        
        // Update the ref with the latest saved data
        profileRef.current = merged;
        
        // Update session with new phone info ONLY for form submissions
        // This prevents session update cascades that cause profile reloads
        const shouldUpdateSession = wasFormSubmission && 
                                  merged.contactChannels?.phoneInfo &&
                                  merged.contactChannels.phoneInfo.internationalPhone &&
                                  !sessionUpdatedRef.current;
                                  
        if (shouldUpdateSession && update) {
          const phoneData = {
            profile: {
              contactChannels: {
                phoneInfo: {
                  internationalPhone: merged.contactChannels.phoneInfo.internationalPhone,
                  nationalPhone: merged.contactChannels.phoneInfo.nationalPhone,
                  userConfirmed: merged.contactChannels.phoneInfo.userConfirmed
                }
              }
            }
          };
          
          try {
            await update(phoneData);
            sessionUpdatedRef.current = true; // Mark as updated to prevent repeated updates
          } catch (error) {
            console.error('[ProfileContext] Error updating session:', error);
          }
        }
      } catch (error) {
        console.warn('[ProfileContext] Could not save to Firebase:', error);
      }
      
      return merged;
    } catch (error) {
      console.error('[ProfileContext] Error saving profile:', error);
      throw error;
    } finally {
      // Always release the saving lock
      savingRef.current = false;
      if (wasFormSubmission) {
        setIsSaving(false);
      }
    }
  }, [session]);

  // Silent save function for background operations - bypasses all React state management
  const silentSaveToFirebase = useCallback(async (data: Partial<UserProfile>) => {
    try {
      if (!session?.user?.id) return;
      
      const current = profileRef.current;
      if (!current || !current.userId) return;
      
      const merged = { ...current, ...data, userId: session.user.id };
      profileRef.current = merged; // Update ref only, no React state
      
      await ProfileService.saveProfile(merged);
    } catch (error) {
      console.error('[ProfileContext] Silent save failed:', error);
    }
  }, [session]);

  // Silent update for streaming background image - no React state changes
  const silentUpdateStreamingBackground = useCallback((imageUrl: string | null) => {
    if (profileRef.current) {
      // Store streaming image separately in ref without triggering React re-renders
      (profileRef.current as any).__streamingBackgroundImage = imageUrl;
    }
    setStreamingBackgroundImage(imageUrl);
    streamingBackgroundImageRef.current = imageUrl; // Update ref for persistence
  }, []);

  // Clear profile
  const clearProfile = useCallback(async (): Promise<void> => {
    setIsDeletingAccount(true);
    try {
      // Call the delete account API
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Failed to delete account: ${response.status} - ${errorData.error || response.statusText}`);
      }

      const result = await response.json();

      // Clear local profile state
      setProfile(null);
      console.log('[ProfileContext] Local profile state cleared');
      
      console.log('[ProfileContext] Account deletion completed successfully');
      // Clear isDeletingAccount since deletion is complete
      setIsDeletingAccount(false);
      
    } catch (error) {
      console.error('[ProfileContext] Error clearing profile:', error);
      setIsDeletingAccount(false); // Reset on error
      throw error; // Re-throw to be handled by the UI
    }
  }, []);

  // Generate functions - now just wrappers around services
  const generateBio = useCallback(async (profile: UserProfile): Promise<string | null> => {
    try {
      const { generateBio: serviceBio } = await import('@/lib/services/aiGenerationService');
      return await serviceBio(profile, saveProfile);
    } catch (error) {
      console.error('[ProfileContext] Bio generation error:', error);
      return null;
    }
  }, [saveProfile]);

  const generateProfileImage = useCallback(async (profile: UserProfile): Promise<string | null> => {
    try {
      const { generateAvatar } = await import('@/lib/services/aiGenerationService');
      return await generateAvatar(profile, saveProfile);
    } catch (error) {
      console.error('[ProfileContext] Avatar generation error:', error);
      return null;
    }
  }, [saveProfile]);

  const generateBackgroundImage = useCallback(async (profile: UserProfile): Promise<string | null> => {
    try {
      const { generateBackgroundImage: serviceBg } = await import('@/lib/services/aiGenerationService');
      return await serviceBg(profile, setStreamingBackgroundImage);
    } catch (error) {
      console.error('[ProfileContext] Background image generation error:', error);
      return null;
    }
  }, []);

  // Simplified setup page effect using services
  const setupPageEffect = useCallback(async () => {
    // Reset generation tracking when user changes
    if (session?.user?.id !== lastUserIdRef.current) {
      bioGeneratedRef.current = false;
      avatarGeneratedRef.current = false;
      backgroundImageGeneratedRef.current = false;
      generatingBackgroundImageRef.current = false; // Reset generating flag for new user
      streamingBackgroundImageRef.current = null; // Clear streaming image for new user
      setStreamingBackgroundImage(null); // Clear streaming state for new user
      lastUserIdRef.current = session?.user?.id || null;
    }

    // Check if profile already has content and mark as generated
    if (profileRef.current) {
      if (profileRef.current.bio && profileRef.current.bio.trim() !== '') {
        bioGeneratedRef.current = true;
      }
      if (profileRef.current.profileImage && profileRef.current.profileImage.trim() !== '' && !profileRef.current.profileImage.includes('default-avatar')) {
        avatarGeneratedRef.current = true;
      }
      if (profileRef.current.backgroundImage && profileRef.current.backgroundImage.trim() !== '') {
        backgroundImageGeneratedRef.current = true;
      }
    }
    
    // AI generation is already handled during profile creation above
    // Removing this duplicate call to prevent double AI generation
    // if (pathname === '/setup' && profileRef.current && session?.user?.email && !isSaving && !isNavigatingFromSetup) {
    //   try {
    //     await orchestrateCompleteAIGeneration(
    //       profileRef.current,
    //       setStreamingBackgroundImage,
    //       {
    //         bioGeneratedRef,
    //         avatarGeneratedRef,
    //         backgroundImageGeneratedRef
    //       },
    //       saveProfile
    //     );
    //   } catch (error) {
    //     console.error('[ProfileContext] AI generation orchestration failed:', error);
    //   }
    // }
  }, [pathname, session?.user?.email, saveProfile, isSaving, isNavigatingFromSetup]);

  useEffect(() => {
    if (pathname === '/setup') {
      // Check if any component is attempting to navigate away from setup
      // If so, don't run setup effects to avoid blocking navigation
      const isNavigatingAway = window.location.pathname !== '/setup' || 
                               document.querySelector('[data-navigating="true"]');
      
      if (!isNavigatingAway) {
        setupPageEffect();
      }
    }
  }, [pathname, setupPageEffect]);

  // Get the latest profile (for external use)
  const getLatestProfile = useCallback((): UserProfile | null => {
    const currentProfile = profileRef.current || profile;
    if (!currentProfile) return null;
    
    return {
      ...currentProfile,
      backgroundImage: streamingBackgroundImageRef.current || currentProfile.backgroundImage
    };
  }, [profile, streamingBackgroundImageRef]);

  const setNavigatingFromSetup = useCallback((navigating: boolean) => {
    setIsNavigatingFromSetup(navigating);
  }, []);

  return (
    <ProfileContext.Provider
      value={{
        profile,
        isLoading,
        isSaving,
        isDeletingAccount,
        isNavigatingFromSetup,
        streamingBackgroundImage,
        saveProfile,
        clearProfile,
        generateBackgroundImage,
        generateBio,
        generateProfileImage,
        getLatestProfile,
        setNavigatingFromSetup
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

// Custom hook for using the profile context
export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}

// Helper function to check if profile has a valid phone number
export function profileHasPhone(profile: UserProfile | null): boolean {
  return !!(
    profile &&
    profile.contactChannels &&
    profile.contactChannels.phoneInfo &&
    profile.contactChannels.phoneInfo.internationalPhone &&
    profile.contactChannels.phoneInfo.internationalPhone.trim() !== ''
  );
}

// Helper function to merge objects deeply
function mergeNonEmpty<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] !== undefined && source[key] !== null) {
      if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = {
          ...(result[key] as object),
          ...(source[key] as object)
        } as T[Extract<keyof T, string>];
      } else {
        result[key] = source[key] as T[Extract<keyof T, string>];
      }
    }
  }
  
  return result;
}
