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
      loadingRef.current = true;
      
      // First try to load existing profile from Firebase
      ProfileService.getProfile(session.user.id)
        .then(async existingProfile => {
          if (existingProfile) {
            setProfile(existingProfile);
            profileRef.current = existingProfile;
            
            // Initialize generation status refs based on current profile data
            bioGeneratedRef.current = !!(existingProfile.bio && existingProfile.bio.trim() !== '');
            backgroundImageGeneratedRef.current = !!(existingProfile.backgroundImage && existingProfile.backgroundImage.trim() !== '');
            
            // Use helper function for avatar completion check
            const { isAvatarGenerationComplete } = await import('@/lib/services/aiGenerationService');
            avatarGeneratedRef.current = isAvatarGenerationComplete(existingProfile);
            
            setIsLoading(false);
            
            // Update session with phone data from existing profile if it has phone info and session doesn't have it
            if (existingProfile.contactChannels?.phoneInfo?.internationalPhone && 
                !sessionUpdatedRef.current && 
                update &&
                session?.profile?.contactChannels?.phoneInfo?.internationalPhone !== existingProfile.contactChannels.phoneInfo.internationalPhone) {
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

            // Continue AI generation if incomplete (on any page)
            if (!bioGeneratedRef.current || !backgroundImageGeneratedRef.current) {
              console.log('[ProfileContext] Continuing incomplete AI generation for existing profile');
              console.log('[ProfileContext] Current page:', pathname);
              console.log('[ProfileContext] Bio generated:', bioGeneratedRef.current);
              console.log('[ProfileContext] Background generated:', backgroundImageGeneratedRef.current);
              setTimeout(() => {
                orchestrateCompleteAIGeneration(
                  existingProfile,
                  stableSetStreamingBackgroundImage,
                  {
                    bioGeneratedRef,
                    avatarGeneratedRef,
                    backgroundImageGeneratedRef
                  },
                  saveProfile,
                  session?.accessToken
                ).catch(error => {
                  // Only log error if it's not an abort error (navigation away)
                  if (!error.message.includes('aborted') && !error.message.includes('Operation aborted')) {
                    console.error('[ProfileContext] Continuing AI generation failed:', error);
                  } else {
                    console.log('[ProfileContext] AI generation continuation aborted due to navigation');
                  }
                });
              }, 500); // Shorter delay for continuation
            }
          } else {
            // Create new profile only if none exists
            const newProfile = createDefaultProfile(session);
            
            // React 18 will automatically batch these state updates
            setProfile(newProfile);
            profileRef.current = newProfile;
            setIsLoading(false);
            
            // Trigger AI generation after profile is set
            // Start immediately on setup page, continue on other pages if incomplete
            const shouldStartAIGeneration = pathname === '/setup' || 
              (!bioGeneratedRef.current || !backgroundImageGeneratedRef.current);
            
            if (shouldStartAIGeneration) {
              setTimeout(() => {
                orchestrateCompleteAIGeneration(
                  newProfile,
                  stableSetStreamingBackgroundImage,
                  {
                    bioGeneratedRef,
                    avatarGeneratedRef,
                    backgroundImageGeneratedRef
                  },
                  saveProfile,
                  session?.accessToken
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

    // Wait for any ongoing save operations to complete, with timeout
    const maxWaitTime = 30000; // 30 seconds max wait
    const waitStartTime = Date.now();
    while (savingRef.current) {
      if (Date.now() - waitStartTime > maxWaitTime) {
        console.warn('[ProfileContext] Timeout waiting for ongoing save operation, proceeding anyway');
        savingRef.current = false; // Reset the lock
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Set saving lock
    savingRef.current = true;

    // Set saving state to prevent setup effects from running during form submission
    const wasFormSubmission = !options.directUpdate && 
      data.contactChannels?.phoneInfo && 
      data.contactChannels.phoneInfo.internationalPhone && 
      data.contactChannels.phoneInfo.internationalPhone.trim() !== '';
    
    console.log('[ProfileContext] Save operation starting:', {
      wasFormSubmission,
      directUpdate: options.directUpdate,
      skipUIUpdate: options.skipUIUpdate,
      hasPhoneData: !!data.contactChannels?.phoneInfo,
      sessionUpdatedRef: sessionUpdatedRef.current
    });
    
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
        console.log('[ProfileContext] Saving profile to Firebase...');
        await ProfileService.saveProfile(merged);
        console.log('[ProfileContext] Firebase save completed successfully');
        
        // Update the ref with the latest saved data
        profileRef.current = merged;
        
        // Update session with new phone info ONLY for form submissions
        // This prevents session update cascades that cause profile reloads
        const currentSessionPhone = session?.profile?.contactChannels?.phoneInfo?.internationalPhone;
        const newPhone = merged.contactChannels?.phoneInfo?.internationalPhone;
        
        const shouldUpdateSession = wasFormSubmission && 
                                  newPhone &&
                                  currentSessionPhone !== newPhone; // Check if phone actually changed
                                  
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
            // Add timeout to prevent hanging on session update
            const sessionUpdatePromise = update(phoneData);
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Session update timeout')), 10000)
            );
            
            await Promise.race([sessionUpdatePromise, timeoutPromise]);
            console.log('[ProfileContext] Session updated successfully with phone data');
            // Note: We don't set sessionUpdatedRef here since this is for a specific phone number change
          } catch (error) {
            console.error('[ProfileContext] Error updating session:', error);
            // Don't throw here - session update failure shouldn't prevent profile save success
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
      // Always release the saving lock and reset saving state
      console.log('[ProfileContext] Cleaning up save operation state');
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

  // Enhanced setStreamingBackgroundImage that updates both state and ref
  const enhancedSetStreamingBackgroundImage = useCallback((imageUrl: string | null) => {
    setStreamingBackgroundImage(imageUrl);
    streamingBackgroundImageRef.current = imageUrl;
  }, []);

  // Create a stable reference to the streaming function that won't change across renders
  const stableStreamingBackgroundImageSetter = useRef(enhancedSetStreamingBackgroundImage);
  stableStreamingBackgroundImageSetter.current = enhancedSetStreamingBackgroundImage;

  // Wrapper function that always uses the current streaming setter
  const stableSetStreamingBackgroundImage = useCallback((imageUrl: string | null) => {
    stableStreamingBackgroundImageSetter.current(imageUrl);
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
      return await serviceBg(profile, stableSetStreamingBackgroundImage);
    } catch (error) {
      console.error('[ProfileContext] Background image generation error:', error);
      return null;
    }
  }, [stableSetStreamingBackgroundImage]);

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
      // Use helper function for avatar completion check
      const { isAvatarGenerationComplete } = await import('@/lib/services/aiGenerationService');
      if (isAvatarGenerationComplete(profileRef.current)) {
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
  }, [profile]); // Only depend on profile state to ensure re-renders when profile changes

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
