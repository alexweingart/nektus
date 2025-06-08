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

  // Log auth status changes only when they actually change
  useEffect(() => {
    console.log('[ProfileContext] Status:', authStatus, 'User ID:', session?.user?.id);
  }, [authStatus, session?.user?.id]);

  // Load profile from Firebase
  const loadProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    if (loadingRef.current) {
      console.log('[ProfileContext] Already loading profile, skipping');
      return null;
    }
    
    loadingRef.current = true;
    console.log('[ProfileContext] Loading profile for user:', userId);
    
    try {
      const loadedProfile = await ProfileService.getProfile(userId);
      if (loadedProfile) {
        console.log('[ProfileContext] Profile loaded successfully');
        return loadedProfile;
      }
      console.log('[ProfileContext] No existing profile found');
      return null;
    } catch (error) {
      console.warn('[ProfileContext] Could not load profile:', error);
      return null;
    } finally {
      loadingRef.current = false;
    }
  }, []);

  const loadProfileForUser = useCallback(async () => {
    if (authStatus !== 'authenticated' || !session?.user?.id) {
      if (authStatus === 'unauthenticated') {
        setProfile(null);
      }
      setIsLoading(false);
      return;
    }

    const userId = session.user.id;

    // Skip reload if already loaded for current user
    if (lastUserIdRef.current === userId && profile?.userId === userId) {
      console.log('[ProfileContext] Profile already loaded for current user:', userId);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    console.log('[ProfileContext] Loading profile for user:', userId);

    // Check if this is a different user
    if (lastUserIdRef.current && lastUserIdRef.current !== userId) {
      console.log('[ProfileContext] New user detected, resetting generation refs');
      bioGeneratedRef.current = false;
      avatarGeneratedRef.current = false;
      backgroundImageGeneratedRef.current = false;
    }

    lastUserIdRef.current = userId;

    try {
      console.log('[ProfileContext] Loading profile for user:', userId);
      const existingProfile = await loadProfile(userId);
      
      if (existingProfile) {
        console.log('[ProfileContext] Profile loaded successfully');
        console.log('[ProfileContext] Profile loaded from Firebase:', {
          userId: existingProfile.userId,
          hasPhone: !!existingProfile.contactChannels?.phoneInfo?.internationalPhone,
          phoneNumber: existingProfile.contactChannels?.phoneInfo?.internationalPhone,
          whatsappUsername: existingProfile.contactChannels?.whatsapp?.username,
          telegramUsername: existingProfile.contactChannels?.telegram?.username,
          wechatUsername: existingProfile.contactChannels?.wechat?.username
        });
        
        // Mark as generated if bio already exists
        if (existingProfile.bio && existingProfile.bio.trim() !== '') {
          console.log('[ProfileContext] Profile already has bio, marking as generated');
          bioGeneratedRef.current = true;
        }
        
        // Mark as generated if background image already exists
        if (existingProfile.backgroundImage && existingProfile.backgroundImage.trim() !== '') {
          console.log('[ProfileContext] Profile already has background image, marking as generated');
          backgroundImageGeneratedRef.current = true;
        }
        
        setProfile(existingProfile);
        profileRef.current = existingProfile;
        
        // Check if we need to update session with loaded profile phone data
        if (existingProfile.contactChannels?.phoneInfo?.internationalPhone && 
            (!session.profile?.contactChannels?.phoneInfo?.internationalPhone ||
             session.profile.contactChannels.phoneInfo.internationalPhone !== existingProfile.contactChannels.phoneInfo.internationalPhone)) {
          
          console.log('[ProfileContext] Updating session with phone data from loaded profile');
          try {
            await update({
              profile: existingProfile
            });
            console.log('[ProfileContext] Session updated successfully with loaded profile phone data');
          } catch (updateError) {
            console.error('[ProfileContext] Failed to update session with loaded profile:', updateError);
          }
        }
      } else {
        console.log('[ProfileContext] No existing profile found');
        
        // Create a new default profile  
        console.log('[ProfileContext] Creating new default profile for session:', {
          userId: session.user.id,
          email: session.user.email,
          name: session.user.name
        });
        console.log('[ProfileContext] Session user data available:', {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          image: session.user.image,
          allUserKeys: Object.keys(session.user || {})
        });
        
        const newProfile = await createDefaultProfile(session);
        console.log('[ProfileContext] New default profile created:', {
          hasPhone: !!newProfile.contactChannels?.phoneInfo?.internationalPhone,
          phoneNumber: newProfile.contactChannels?.phoneInfo?.internationalPhone,
          whatsappUsername: newProfile.contactChannels?.whatsapp?.username,
          telegramUsername: newProfile.contactChannels?.telegram?.username,
          wechatUsername: newProfile.contactChannels?.wechat?.username
        });
        
        setProfile(newProfile);
        profileRef.current = newProfile;
      }

      console.log('[ProfileContext] Profile loaded and state updated');
      
    } catch (error) {
      console.error('[ProfileContext] Error loading profile:', error);
    } finally {
      setIsLoading(false);
    }
  }, [session, loadProfile, authStatus]);

  // Single effect to handle profile loading
  useEffect(() => {
    const isNewUser = session?.isNewUser;
    
    if (isNewUser) {
      console.log('[ProfileContext] New user detected - skipping initial profile loading for fast setup');
      setIsLoading(false);
      
      // Listen for event to trigger background profile creation
      const handleTriggerProfileCreation = () => {
        console.log('[ProfileContext] Received trigger for background profile creation');
        // Now load profile normally
        loadProfileForUser();
      };
      
      window.addEventListener('triggerProfileCreation', handleTriggerProfileCreation);
      
      return () => {
        window.removeEventListener('triggerProfileCreation', handleTriggerProfileCreation);
      };
    }
    
    // For existing users, load immediately
    loadProfileForUser();
  }, [session, loadProfileForUser]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // Save profile to Firestore
  const saveProfile = useCallback(async (data: Partial<UserProfile>, options: { directUpdate?: boolean; skipUIUpdate?: boolean } = {}): Promise<UserProfile | null> => {
    console.log('[ProfileContext] saveProfile called with data:', data);
    console.log('[ProfileContext] saveProfile options:', options);
    
    if (!session?.user?.id) {
      console.error('[ProfileContext] No authenticated user');
      return null;
    }

    // Wait for any ongoing save operations to complete
    while (savingRef.current) {
      console.log('[ProfileContext] Waiting for ongoing save operation to complete...');
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
        console.log('[ProfileContext] Updating React state for UI updates');
        setProfile(merged);
      } else {
        console.log('[ProfileContext] Skipping React state update - background operation or form submission');
        // However, if this is a background operation and the current profile state is stale (empty userId),
        // we should update it to prevent UI showing empty data during streaming
        if (options.directUpdate && (!profile || !profile.userId) && merged.userId) {
          console.log('[ProfileContext] Updating stale profile state with background operation data');
          setProfile(merged);
        }
      }
      
      // Save to Firebase
      try {
        await ProfileService.saveProfile(merged);
        console.log('[ProfileContext] Profile saved to Firebase');
        
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
            console.log('[ProfileContext] Updating session with phone data from form submission');
            await update(phoneData);
            sessionUpdatedRef.current = true; // Mark as updated to prevent repeated updates
            console.log('[ProfileContext] Session updated successfully with new profile data');
          } catch (error) {
            console.error('[ProfileContext] Error updating session:', error);
          }
        } else {
          console.log('[ProfileContext] Skipping session update - not form submission or already updated');
        }
      } catch (error) {
        console.warn('[ProfileContext] Could not save to Firebase:', error);
      }
      
      return merged;
    } catch (error) {
      console.error('[ProfileContext] Error saving profile:', error);
      console.error('[ProfileContext] Error type:', typeof error);
      console.error('[ProfileContext] Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('[ProfileContext] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
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
      console.log('[ProfileContext] Silent save to Firebase completed:', Object.keys(data));
    } catch (error) {
      console.error('[ProfileContext] Silent save failed:', error);
      console.error('[ProfileContext] Error type:', typeof error);
      console.error('[ProfileContext] Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('[ProfileContext] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    }
  }, [session]);

  // Silent update for streaming background image - no React state changes
  const silentUpdateStreamingBackground = useCallback((imageUrl: string | null) => {
    if (profileRef.current) {
      // Store streaming image separately in ref without triggering React re-renders
      (profileRef.current as any).__streamingBackgroundImage = imageUrl;
    }
    setStreamingBackgroundImage(imageUrl);
  }, []);

  // Clear profile
  const clearProfile = useCallback(async (): Promise<void> => {
    setIsDeletingAccount(true);
    try {
      console.log('[ProfileContext] Starting profile deletion...');
      
      // Call the delete account API
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[ProfileContext] Error response from delete API:', errorData);
        throw new Error(`Failed to delete account: ${response.status} - ${errorData.error || response.statusText}`);
      }

      const result = await response.json();
      console.log('[ProfileContext] Delete account API response:', result);

      // Clear local profile state
      setProfile(null);
      console.log('[ProfileContext] Local profile state cleared');
      
      console.log('[ProfileContext] Account deletion completed successfully');
      // Clear isDeletingAccount since deletion is complete
      setIsDeletingAccount(false);
      
    } catch (error) {
      console.error('[ProfileContext] Error clearing profile:', error);
      console.error('[ProfileContext] Error type:', typeof error);
      console.error('[ProfileContext] Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('[ProfileContext] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      setIsDeletingAccount(false); // Reset on error
      throw error; // Re-throw to be handled by the UI
    }
  }, []);

  // Generate functions - now just wrappers around services
  const generateBio = useCallback(async (profile: UserProfile): Promise<string | null> => {
    try {
      const { generateBio: serviceBio } = await import('@/lib/services/aiGenerationService');
      return await serviceBio(profile);
    } catch (error) {
      console.error('[ProfileContext] Bio generation error:', error);
      return null;
    }
  }, []);

  const generateProfileImage = useCallback(async (profile: UserProfile): Promise<string | null> => {
    try {
      const { generateAvatar } = await import('@/lib/services/aiGenerationService');
      return await generateAvatar(profile);
    } catch (error) {
      console.error('[ProfileContext] Avatar generation error:', error);
      return null;
    }
  }, []);

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
    console.log('[ProfileContext] === SETUP EFFECT RUNNING ===');
    console.log('[ProfileContext] pathname:', pathname);
    console.log('[ProfileContext] profile exists:', !!profileRef.current);
    console.log('[ProfileContext] session email:', session?.user?.email);
    console.log('[ProfileContext] bioGeneratedRef.current:', bioGeneratedRef.current);
    console.log('[ProfileContext] avatarGeneratedRef.current:', avatarGeneratedRef.current);
    console.log('[ProfileContext] backgroundImageGeneratedRef.current:', backgroundImageGeneratedRef.current);

    // Reset generation tracking when user changes
    if (session?.user?.id !== lastUserIdRef.current) {
      bioGeneratedRef.current = false;
      avatarGeneratedRef.current = false;
      backgroundImageGeneratedRef.current = false;
      generatingBackgroundImageRef.current = false; // Reset generating flag for new user
      lastUserIdRef.current = session?.user?.id || null;
    }

    // Check if profile already has content and mark as generated
    if (profileRef.current) {
      if (profileRef.current.bio && profileRef.current.bio.trim() !== '') {
        console.log('[ProfileContext] Profile already has bio, marking bioGeneratedRef as true');
        bioGeneratedRef.current = true;
      }
      if (profileRef.current.profileImage && profileRef.current.profileImage.trim() !== '' && !profileRef.current.profileImage.includes('default-avatar')) {
        console.log('[ProfileContext] Profile already has avatar, marking avatarGeneratedRef as true');
        avatarGeneratedRef.current = true;
      }
      if (profileRef.current.backgroundImage && profileRef.current.backgroundImage.trim() !== '') {
        console.log('[ProfileContext] Profile already has background image, marking backgroundImageGeneratedRef as true');
        backgroundImageGeneratedRef.current = true;
      }
    }
    
    // Only run AI generation on setup page for users with profiles
    if (pathname === '/setup' && profileRef.current && session?.user?.email && !isSaving && !isNavigatingFromSetup) {
      console.log('[ProfileContext] === SETUP CONDITIONS MET ===');
      
      try {
        // Use the new AI generation service to orchestrate everything
        await orchestrateCompleteAIGeneration(
          profileRef.current,
          saveProfile,
          setStreamingBackgroundImage,
          {
            bioGeneratedRef,
            avatarGeneratedRef,
            backgroundImageGeneratedRef
          }
        );
      } catch (error) {
        console.error('[ProfileContext] AI generation orchestration failed:', error);
      }
    } else {
      console.log('[ProfileContext] === SETUP CONDITIONS NOT MET ===');
      if (pathname !== '/setup') console.log('[ProfileContext] Not on setup page');
      if (!profileRef.current) console.log('[ProfileContext] No profile');
      if (!session?.user?.email) console.log('[ProfileContext] No user email');
      if (isSaving) console.log('[ProfileContext] Saving in progress');
      if (isNavigatingFromSetup) console.log('[ProfileContext] Navigation in progress');
    }
  }, [pathname, session?.user?.email, saveProfile, isSaving, isNavigatingFromSetup]);

  useEffect(() => {
    if (pathname === '/setup') {
      // Check if any component is attempting to navigate away from setup
      // If so, don't run setup effects to avoid blocking navigation
      const isNavigatingAway = window.location.pathname !== '/setup' || 
                               document.querySelector('[data-navigating="true"]');
      
      if (!isNavigatingAway) {
        setupPageEffect();
      } else {
        console.log('[ProfileContext] Skipping setup effect - navigation in progress');
      }
    }
  }, [pathname, setupPageEffect]);

  // Get the latest profile (for external use)
  const getLatestProfile = useCallback((): UserProfile | null => {
    const currentProfile = profileRef.current || profile;
    if (!currentProfile) return null;
    
    return {
      ...currentProfile,
      backgroundImage: streamingBackgroundImage || currentProfile.backgroundImage
    };
  }, [profile, streamingBackgroundImage]);

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
