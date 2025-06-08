"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { ProfileService } from '@/lib/firebase/profileService';
import { UserProfile, SocialProfile } from '@/types/profile';
import { generateSocialProfilesFromEmail, processSocialProfile } from '@/lib/utils/socialMedia';

// Types
type ProfileContextType = {
  profile: UserProfile | null;
  isLoading: boolean;
  isSaving: boolean;
  isDeletingAccount: boolean;
  streamingBackgroundImage: string | null;
  saveProfile: (data: Partial<UserProfile>, options?: { directUpdate?: boolean; skipUIUpdate?: boolean }) => Promise<UserProfile | null>;
  clearProfile: () => Promise<void>;
  generateBackgroundImage: (profile: UserProfile) => Promise<string | null>;
  generateBio: (profile: UserProfile) => Promise<string | null>;
  generateProfileImage: (profile: UserProfile) => Promise<string | null>;
  getLatestProfile: () => UserProfile | null;
};

// Create context
const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

// Helper functions
const createDefaultProfile = (session?: any): UserProfile => {
  const email = session?.user?.email || '';
  const generatedSocialProfiles = generateSocialProfilesFromEmail(email);
  
  return {
    userId: '',
    name: session?.user?.name || '',
    bio: '',
    profileImage: session?.user?.image || '',
    backgroundImage: '',
    lastUpdated: Date.now(),
    contactChannels: {
      phoneInfo: { internationalPhone: '', nationalPhone: '', userConfirmed: false },
      email: { email: email, userConfirmed: !!email },
      facebook: generatedSocialProfiles.facebook,
      instagram: generatedSocialProfiles.instagram,
      x: generatedSocialProfiles.x,
      linkedin: generatedSocialProfiles.linkedin,
      snapchat: generatedSocialProfiles.snapchat,
      whatsapp: generatedSocialProfiles.whatsapp,
      telegram: generatedSocialProfiles.telegram,
      wechat: generatedSocialProfiles.wechat,
    },
  };
};

// Provider component
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status: authStatus, update } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [streamingBackgroundImage, setStreamingBackgroundImage] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);
  const pathname = usePathname();
  const bioGeneratedRef = useRef(false);
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

  // Single effect to handle profile loading
  useEffect(() => {
    if (authStatus !== 'authenticated' || !session?.user?.id) {
      if (authStatus === 'unauthenticated') {
        setProfile(null);
      }
      setIsLoading(false);
      return;
    }

    const userId = session.user.id;
    
    // Skip if we already loaded for this user
    if (lastUserIdRef.current === userId && profile?.userId === userId) {
      setIsLoading(false);
      return;
    }

    console.log('[ProfileContext] Loading profile for user:', userId);
    setIsLoading(true);
    
    // Only reset bio generation flag when switching to a different user
    if (lastUserIdRef.current !== userId) {
      console.log('[ProfileContext] New user detected, resetting bioGeneratedRef');
      bioGeneratedRef.current = false;
      backgroundImageGeneratedRef.current = false;
      generatingBackgroundImageRef.current = false; // Reset generating flag for new user
      sessionUpdatedRef.current = false; // Reset session update flag for new user
    }
    lastUserIdRef.current = userId;
    
    loadProfile(userId).then(async (loadedProfile) => {
      if (loadedProfile) {
        console.log('[ProfileContext] Profile loaded from Firebase:', {
          userId: loadedProfile.userId,
          hasPhone: !!loadedProfile.contactChannels?.phoneInfo?.internationalPhone,
          phoneNumber: loadedProfile.contactChannels?.phoneInfo?.internationalPhone,
          whatsappUsername: loadedProfile.contactChannels?.whatsapp?.username,
          telegramUsername: loadedProfile.contactChannels?.telegram?.username,
          wechatUsername: loadedProfile.contactChannels?.wechat?.username,
          hasBio: !!loadedProfile.bio,
          bioLength: loadedProfile.bio?.length || 0,
          bioPreview: loadedProfile.bio ? loadedProfile.bio.substring(0, 50) + '...' : 'No bio',
          hasBackgroundImage: !!loadedProfile.backgroundImage
        });
        setProfile(loadedProfile);
        profileRef.current = loadedProfile;
        
        // If profile already has a bio, mark as generated to prevent regeneration
        if (loadedProfile.bio && loadedProfile.bio.trim() !== '') {
          console.log('[ProfileContext] Profile already has bio, marking as generated');
          bioGeneratedRef.current = true;
        }
        
        console.log('[ProfileContext] Profile loaded and state updated - no session update needed');
      } else {
        // Create default profile
        console.log('[ProfileContext] Creating new default profile for session:', {
          userId: session?.user?.id,
          email: session?.user?.email,
          name: session?.user?.name
        });
        const newProfile = createDefaultProfile(session);
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
      setIsLoading(false);
    }).catch((error) => {
      console.error('[ProfileContext] Error loading profile:', error);
      setIsLoading(false);
    });
  }, [authStatus, session?.user?.id, loadProfile]);

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
        merged.contactChannels.facebook = processSocialProfile('facebook', merged.contactChannels.facebook);
        merged.contactChannels.instagram = processSocialProfile('instagram', merged.contactChannels.instagram);
        merged.contactChannels.linkedin = processSocialProfile('linkedin', merged.contactChannels.linkedin);
        merged.contactChannels.snapchat = processSocialProfile('snapchat', merged.contactChannels.snapchat);
        merged.contactChannels.whatsapp = processSocialProfile('whatsapp', merged.contactChannels.whatsapp);
        merged.contactChannels.telegram = processSocialProfile('telegram', merged.contactChannels.telegram);
        merged.contactChannels.wechat = processSocialProfile('wechat', merged.contactChannels.wechat);
        merged.contactChannels.x = processSocialProfile('x', merged.contactChannels.x);
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
                                  
        if (update && shouldUpdateSession) {
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
            console.log('[ProfileContext] Session updated with new profile data');
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
  }, [session?.user?.id, profile, update]);

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
  }, [session?.user?.id]);

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

  // Generate background image with completely isolated save
  const generateBackgroundImage = useCallback(async (profile: UserProfile): Promise<string | null> => {
    if (!profile || !profile.userId) {
      console.error('Cannot generate background image: Invalid profile or missing userId');
      return null;
    }

    // Clear any previous streaming state when starting new generation
    setStreamingBackgroundImage(null);

    try {
      console.log('Generating background image for profile:', profile.name);
      console.log('[ProfileContext] Profile image available:', !!profile.profileImage);
      console.log('[ProfileContext] About to call /api/background-image...');
      
      const response = await fetch('/api/background-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Ensure session cookies are included
        body: JSON.stringify({ 
          bio: profile.bio, 
          name: profile.name,
          profileImage: profile.profileImage // Pass profile image for enhanced personalization
        }),
      });

      console.log('[ProfileContext] Background image API response status:', response.status);
      console.log('[ProfileContext] Background image API response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to generate background image:', errorData);
        return null;
      }

      // Handle streaming response
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('text/event-stream')) {
        console.log('[ProfileContext] Processing streaming background image response');
        return await handleStreamingBackgroundImage(response);
      } else {
        // Fallback for regular JSON response
        const result = await response.json();
        const imageUrl = result.imageUrl;
        
        if (imageUrl) {
          console.log('[ProfileContext] Background image generated, saving silently...');
          // Use silent save to avoid any React state updates
          await silentSaveToFirebase({ backgroundImage: imageUrl });
          console.log('[ProfileContext] Background image saved silently');
        }
        
        return imageUrl || null;
      }
    } catch (error) {
      console.error('[ProfileContext] Background image generation error:', error);
      console.error('[ProfileContext] Error type:', typeof error);
      console.error('[ProfileContext] Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('[ProfileContext] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      return null;
    }
  }, [silentSaveToFirebase]);

  // Handle streaming background image responses with silent saves
  const handleStreamingBackgroundImage = useCallback(async (response: Response): Promise<string | null> => {
    const reader = response.body?.getReader();
    if (!reader) return null;

    try {
      const decoder = new TextDecoder();
      let buffer = '';
      let finalUrl: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'partial_image' && data.imageUrl) {
                console.log('[ProfileContext] Received partial background image');
                // Update streaming state for UI to show partial images
                setStreamingBackgroundImage(data.imageUrl);
              } else if (data.type === 'completed' && data.imageUrl) {
                console.log('[ProfileContext] Background image generation completed');
                finalUrl = data.imageUrl;
                
                // Save to Firebase silently - NO React state updates to avoid triggering effects
                await silentSaveToFirebase({ backgroundImage: data.imageUrl });
                console.log('[ProfileContext] Final background image saved silently');
                
                // Update ref only (no React state) for getLatestProfile consistency
                if (profileRef.current) {
                  profileRef.current = { ...profileRef.current, backgroundImage: data.imageUrl };
                }
                
                // DON'T clear streaming state or call setProfile - this prevents the flash
                // The streaming image stays visible until next generation or navigation
                console.log('[ProfileContext] Keeping streaming image visible to prevent flash');
              }
            } catch (e) {
              console.warn('[ProfileContext] Failed to parse streaming data:', e);
            }
          }
        }
      }

      return finalUrl;
    } catch (error) {
      console.error('[ProfileContext] Error handling streaming background image:', error);
      console.error('[ProfileContext] Error type:', typeof error);
      console.error('[ProfileContext] Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('[ProfileContext] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      return null;
    } finally {
      reader.releaseLock();
    }
  }, [silentSaveToFirebase]);

  const generateBio = useCallback(async (profile: UserProfile): Promise<string | null> => {
    if (!profile || !profile.userId) {
      console.error('Cannot generate bio: Invalid profile or missing userId');
      return null;
    }

    try {
      console.log('Generating bio for profile:', profile.name);
      
      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'bio',
          profile: profile,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to generate bio:', errorData);
        return null;
      }

      const result = await response.json();
      console.log('Bio generation result:', result);
      
      return result.bio || null;
    } catch (error) {
      console.error('Bio generation error:', error);
      console.error('[ProfileContext] Error type:', typeof error);
      console.error('[ProfileContext] Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('[ProfileContext] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      return null;
    }
  }, []);

  const generateProfileImage = useCallback(async (profile: UserProfile): Promise<string | null> => {
    return null;
  }, []);

  // Helper function to check and generate bio if needed
  const checkAndGenerateBio = async (profileToCheck: UserProfile) => {
    // Double-check if bio has already been generated to prevent duplicates
    if (bioGeneratedRef.current) {
      console.log('[ProfileContext] Bio already generated (ref check), skipping');
      return;
    }
    
    if (!profileToCheck.bio || profileToCheck.bio.trim() === '') {
      console.log('[ProfileContext] === BIO GENERATION TRIGGERED ===');
      console.log('[ProfileContext] Bio is empty, generating bio...');
      console.log('[ProfileContext] Profile userId:', profileToCheck.userId);
      console.log('[ProfileContext] Session userId:', session?.user?.id);
      
      // Mark as generated immediately to prevent duplicate calls
      bioGeneratedRef.current = true;
      
      // Ensure profile has userId before generating bio
      const profileWithUserId = {
        ...profileToCheck,
        userId: profileToCheck.userId || session?.user?.id || ''
      };
      
      try {
        const generatedBio = await generateBio(profileWithUserId);
        if (generatedBio) {
          console.log('[ProfileContext] Successfully generated bio:', generatedBio.substring(0, 100) + '...');
          console.log('[ProfileContext] Full bio length:', generatedBio.length);
          console.log('[ProfileContext] About to save bio to Firebase with saveProfile...');
          // Save the generated bio to Firebase
          const updatedProfile = await saveProfile({ bio: generatedBio }, { directUpdate: true, skipUIUpdate: true });
          console.log('[ProfileContext] === BIO SAVED TO FIREBASE ===');
          console.log('[ProfileContext] Updated profile bio length:', updatedProfile?.bio?.length || 0);
          console.log('[ProfileContext] Updated profile bio preview:', updatedProfile?.bio ? updatedProfile.bio.substring(0, 50) + '...' : 'No bio');
          
          // After bio is generated and saved, check if background image should be generated
          if (updatedProfile) {
            await checkAndGenerateBackgroundImage(updatedProfile);
          }
        } else {
          console.warn('[ProfileContext] Failed to generate bio');
          // Reset ref if generation failed
          bioGeneratedRef.current = false;
        }
      } catch (error) {
        console.error('[ProfileContext] Error generating bio:', error);
        console.error('[ProfileContext] Error type:', typeof error);
        console.error('[ProfileContext] Error message:', error instanceof Error ? error.message : 'Unknown error');
        console.error('[ProfileContext] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        // Reset ref if generation failed
        bioGeneratedRef.current = false;
      }
    } else {
      console.log('[ProfileContext] Bio already exists, skipping generation');
      bioGeneratedRef.current = true;
      // Bio exists, but check if background image should be generated
      (async () => {
        await checkAndGenerateBackgroundImage(profileToCheck);
      })();
    }
  };

  // Helper function to check and generate background image if needed
  const checkAndGenerateBackgroundImage = async (profileToCheck: UserProfile) => {
    // Double-check if background image has already been generated to prevent duplicates
    if (backgroundImageGeneratedRef.current) {
      console.log('[ProfileContext] Background image already generated (ref check), skipping');
      return;
    }
    
    // Check if generation is already in progress
    if (generatingBackgroundImageRef.current) {
      console.log('[ProfileContext] Background image generation already in progress, skipping');
      return;
    }
    
    if ((!profileToCheck.backgroundImage || profileToCheck.backgroundImage.trim() === '') && 
        profileToCheck.bio && profileToCheck.bio.trim() !== '') {
      console.log('[ProfileContext] === BACKGROUND IMAGE GENERATION TRIGGERED ===');
      console.log('[ProfileContext] Background image is empty but bio exists, generating background image...');
      console.log('[ProfileContext] Profile userId:', profileToCheck.userId);
      console.log('[ProfileContext] Bio preview:', profileToCheck.bio.substring(0, 100) + '...');
      
      // Mark as generating immediately to prevent concurrent calls
      generatingBackgroundImageRef.current = true;
      
      try {
        const generatedBackgroundImage = await generateBackgroundImage(profileToCheck);
        if (generatedBackgroundImage) {
          console.log('[ProfileContext] Successfully generated background image');
          // Mark as generated AFTER successful generation
          backgroundImageGeneratedRef.current = true;
          // Note: Firebase save and UI update is now handled by the streaming generateBackgroundImage function
          console.log('[ProfileContext] === BACKGROUND IMAGE GENERATED AND SAVED ===');
        } else {
          console.warn('[ProfileContext] Failed to generate background image');
          // Don't mark as generated if it failed
        }
      } catch (error) {
        console.error('[ProfileContext] Error generating background image:', error);
        console.error('[ProfileContext] Error type:', typeof error);
        console.error('[ProfileContext] Error message:', error instanceof Error ? error.message : 'Unknown error');
        console.error('[ProfileContext] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        // Don't mark as generated if there was an error
      } finally {
        // Always clear the generating flag
        generatingBackgroundImageRef.current = false;
      }
    } else {
      if (profileToCheck.backgroundImage && profileToCheck.backgroundImage.trim() !== '') {
        console.log('[ProfileContext] Background image already exists, skipping generation');
        backgroundImageGeneratedRef.current = true;
      } else if (!profileToCheck.bio || profileToCheck.bio.trim() === '') {
        console.log('[ProfileContext] Bio does not exist yet, skipping background image generation');
      } else if (backgroundImageGeneratedRef.current) {
        console.log('[ProfileContext] Background image already generated, skipping');
      }
    }
  };

  // Handle setup page onboarding - auto-generate social media profiles
  useEffect(() => {
    console.log('[ProfileContext] === SETUP EFFECT RUNNING ===');
    console.log('[ProfileContext] pathname:', pathname);
    console.log('[ProfileContext] profile exists:', !!profileRef.current);
    console.log('[ProfileContext] session email:', session?.user?.email);
    console.log('[ProfileContext] bioGeneratedRef.current:', bioGeneratedRef.current);
    console.log('[ProfileContext] backgroundImageGeneratedRef.current:', backgroundImageGeneratedRef.current);
    console.log('[ProfileContext] profile data:', profileRef.current);
    
    // Reset generation tracking when user changes
    if (session?.user?.id !== lastUserIdRef.current) {
      bioGeneratedRef.current = false;
      backgroundImageGeneratedRef.current = false;
      generatingBackgroundImageRef.current = false; // Reset generating flag for new user
      lastUserIdRef.current = session?.user?.id || null;
    }

    // Check if profile already has bio/background image and mark as generated
    if (profileRef.current) {
      if (profileRef.current.bio && profileRef.current.bio.trim() !== '') {
        console.log('[ProfileContext] Profile already has bio, marking bioGeneratedRef as true');
        bioGeneratedRef.current = true;
      }
      if (profileRef.current.backgroundImage && profileRef.current.backgroundImage.trim() !== '') {
        console.log('[ProfileContext] Profile already has background image, marking backgroundImageGeneratedRef as true');
        backgroundImageGeneratedRef.current = true;
      }
    }
    
    if (pathname === '/setup' && profileRef.current && session?.user?.email && !isSaving) {
      console.log('[ProfileContext] === SETUP CONDITIONS MET ===');
      const email = session.user.email;
      const phone = profileRef.current.contactChannels?.phoneInfo?.internationalPhone;
      
      console.log('[ProfileContext] email:', email);
      console.log('[ProfileContext] phone:', phone);
      console.log('[ProfileContext] current bio:', profileRef.current.bio);
      console.log('[ProfileContext] current backgroundImage:', profileRef.current.backgroundImage);
      
      // Check if bio already exists - if so, mark as generated to prevent future attempts
      if (profileRef.current.bio && profileRef.current.bio.trim() !== '') {
        console.log('[ProfileContext] Bio already exists in profile, marking as generated');
        bioGeneratedRef.current = true;
        
        // Always check if background image should be generated when bio exists
        console.log('[ProfileContext] Checking background image generation since bio exists...');
        (async () => {
          await checkAndGenerateBackgroundImage(profileRef.current!);
        })();
        
        // If bio generation hasn't been attempted yet, we still need to continue with the setup flow
        if (!bioGeneratedRef.current) {
          console.log('[ProfileContext] Bio generation not completed yet, continuing setup flow...');
        } else {
          console.log('[ProfileContext] Bio and background image check completed, setup flow finished');
          return;
        }
      }
      
      // Only continue with bio generation if it hasn't been generated yet
      if (!bioGeneratedRef.current) {
        console.log('[ProfileContext] === SETUP CONDITIONS MET ===');
        console.log('[ProfileContext] Setup conditions met, checking social media fields...');
        
        // Get current social media fields
        const currentSocialFields = profileRef.current.contactChannels;
        
        // Check if all social media fields are empty (excluding phone and email)
        const socialPlatforms = ['facebook', 'instagram', 'x', 'linkedin', 'snapchat', 'whatsapp', 'telegram', 'wechat'];
        const allSocialFieldsEmpty = socialPlatforms.every(platform => {
          const field = currentSocialFields[platform as keyof typeof currentSocialFields] as SocialProfile;
          return !field?.username || field.username.trim() === '';
        });
        
        if (allSocialFieldsEmpty) {
          console.log('[ProfileContext] Generating social media profiles from email...');
          
          // Generate social media profiles from email - wrap in async function
          (async () => {
            try {
              // Generate social media profiles from email
              const socialProfiles = generateSocialProfilesFromEmail(email);
              
              // Update profile with generated social media data
              const updatedProfile = {
                ...profileRef.current!,
                contactChannels: {
                  ...profileRef.current!.contactChannels,
                  ...socialProfiles
                }
              };
              
              await saveProfile(updatedProfile, { directUpdate: true, skipUIUpdate: true });
              console.log('[ProfileContext] Social media profiles saved successfully');
              
              // After saving social media, check if we should generate bio
              await checkAndGenerateBio(updatedProfile);
              
            } catch (error) {
              console.error('[ProfileContext] Error saving social media profiles:', error);
              console.error('[ProfileContext] Error type:', typeof error);
              console.error('[ProfileContext] Error message:', error instanceof Error ? error.message : 'Unknown error');
              console.error('[ProfileContext] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
            }
          })();
        } else {
          // Social media already exists, proceed to bio generation
          (async () => {
            await checkAndGenerateBio(profileRef.current!);
          })();
        }
      } else {
        console.log('[ProfileContext] === BIO ALREADY GENERATED ===');
        console.log('[ProfileContext] Bio already generated, only checking background image...');
        
        // Wrap in async function
        (async () => {
          await checkAndGenerateBackgroundImage(profileRef.current!);
        })();
      }
    } else {
      console.log('[ProfileContext] === SETUP CONDITIONS NOT MET ===');
      if (pathname !== '/setup') console.log('[ProfileContext] Not on setup page');
      if (!profileRef.current) console.log('[ProfileContext] No profile');
      if (!session?.user?.email) console.log('[ProfileContext] No user email');
      if (isSaving) console.log('[ProfileContext] Saving in progress');
    }
  }, [pathname, session?.user?.email, saveProfile, generateBio, isSaving]);
  
  // Get the latest profile (for external use)
  const getLatestProfile = useCallback((): UserProfile | null => {
    const currentProfile = profileRef.current || profile;
    if (!currentProfile) return null;
    
    // If there's a streaming background image, use it
    if (streamingBackgroundImage) {
      return {
        ...currentProfile,
        backgroundImage: streamingBackgroundImage
      };
    }
    
    // Otherwise, use the profile with its saved background image (from ref which is most up-to-date)
    return profileRef.current || currentProfile;
  }, [streamingBackgroundImage]);

  return (
    <ProfileContext.Provider
      value={{
        profile,
        isLoading,
        isSaving,
        isDeletingAccount,
        streamingBackgroundImage,
        saveProfile,
        clearProfile,
        generateBackgroundImage,
        generateBio,
        generateProfileImage,
        getLatestProfile
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
