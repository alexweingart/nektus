"use client";

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ClientProfileService as ProfileService } from '@/lib/firebase/clientProfileService';
import { UserProfile } from '@/types/profile';
import { createDefaultProfile as createDefaultProfileService } from '@/lib/services/newUserService';
import { shouldGenerateAvatarForGoogleUser } from '@/lib/utils/googleProfileImageDetector';
import { firebaseAuth } from '@/lib/firebase/auth';

// Types
type ProfileContextType = {
  profile: UserProfile | null;
  isLoading: boolean;
  isSaving: boolean;
  isDeletingAccount: boolean;
  isNavigatingFromSetup: boolean;
  saveProfile: (data: Partial<UserProfile>, options?: { directUpdate?: boolean; skipUIUpdate?: boolean }) => Promise<UserProfile | null>;
  getLatestProfile: () => UserProfile | null;
  setNavigatingFromSetup: (navigating: boolean) => void;
  // Streaming states for immediate UI feedback during generation
  streamingBio: string | null;
  streamingProfileImage: string | null;
  streamingSocialContacts: UserProfile['contactChannels'] | null;
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
  
  // Separate streaming state for immediate updates during generation
  const [streamingBio, setStreamingBio] = useState<string | null>(null);
  const [streamingProfileImage, setStreamingProfileImage] = useState<string | null>(null);
  const [streamingSocialContacts, setStreamingSocialContacts] = useState<UserProfile['contactChannels'] | null>(null);
  
  const loadingRef = useRef(false);
  const savingRef = useRef(false);
  const bioGenerationTriggeredRef = useRef(false);
  const backgroundGenerationTriggeredRef = useRef(false);
  const profileImageGenerationTriggeredRef = useRef(false);

  
  const profileRef = useRef<UserProfile | null>(null);

  // Profile creation/loading effect
  useEffect(() => {
    const loadProfile = async () => {
      if (authStatus === 'authenticated' && session?.user?.id && !profile && !loadingRef.current) {
        loadingRef.current = true;
        setIsLoading(true);
        
        // Detect Android for enhanced session sync
        const isAndroid = typeof window !== 'undefined' && /android/i.test(navigator.userAgent);
        
        try {
          // Sign in to Firebase Auth using the custom token from NextAuth
          if (session?.firebaseToken && !firebaseAuth.isAuthenticated()) {
            try {
              // Clear any stale auth state first
              if (firebaseAuth.getCurrentUser()) {
                await firebaseAuth.signOut();
              }
              
              await firebaseAuth.signInWithCustomToken(session.firebaseToken);
            } catch (authError) {
              console.error('[ProfileContext] Firebase Auth failed, continuing without auth:', authError);
              // Continue without Firebase Auth - the app should still work
              // Continue without Firebase Auth - the app should still work
            }
          }
          
          const existingProfile = await ProfileService.getProfile(session.user.id);
          if (existingProfile) {
            setProfile(existingProfile);
            
            // Android-specific: Ensure session is synced with loaded profile
            if (isAndroid && existingProfile.contactChannels?.phoneInfo?.internationalPhone) {
              const sessionPhone = session?.profile?.contactChannels?.phoneInfo?.internationalPhone;
              const profilePhone = existingProfile.contactChannels.phoneInfo.internationalPhone;
              
              if (sessionPhone !== profilePhone) {
                // Force session update to sync with Firebase data
                try {
                  if (update) {
                    await update({
                      profile: {
                        contactChannels: {
                          phoneInfo: {
                            internationalPhone: existingProfile.contactChannels.phoneInfo.internationalPhone,
                            nationalPhone: existingProfile.contactChannels.phoneInfo.nationalPhone || '',
                            userConfirmed: existingProfile.contactChannels.phoneInfo.userConfirmed || false
                          }
                        }
                      }
                    });
                  }
                } catch (error) {
                  console.error('[ProfileContext] Failed to update session:', error);
                }
              }
            }
            
            // Check each asset individually and trigger only what's needed
            // Only generate what's actually missing
            let needsGeneration = false;
            
            if (!existingProfile.bio) {
              console.log('[ProfileContext] Bio missing, will generate');
              needsGeneration = true;
            }
            
            if (!existingProfile.backgroundImage) {
              console.log('[ProfileContext] Background image missing, will generate');
              needsGeneration = true;
            }
            
            // Check if we need to generate a profile image
            let shouldGenerateProfileImage = false;
            
            // If we already have a profile image stored in Firebase, skip all checks
            if (existingProfile.profileImage) {
              // Skip generation check
            } else {
              // Only check if we need to generate when no profile image exists in Firebase
              const currentProfileImage = session?.user?.image;
              
              console.log('[ProfileContext] Profile image check in initial load:', {
                existingProfileImage: existingProfile.profileImage,
                sessionImage: session?.user?.image,
                currentProfileImage,
                hasGoogleImage: currentProfileImage?.includes('googleusercontent.com')
              });
              
              if (!currentProfileImage) {
                console.log('[ProfileContext] No profile image, will generate');
                shouldGenerateProfileImage = true;
              } else if (currentProfileImage?.includes('googleusercontent.com')) {
                // For Google users, use the proper API to check if it's auto-generated initials
                try {
                  const accessToken = session?.accessToken;
                  if (accessToken) {
                    console.log('[ProfileContext] Checking Google profile image via People API...');
                    const shouldGenerate = await shouldGenerateAvatarForGoogleUser(accessToken);
                    if (shouldGenerate) {
                      console.log('[ProfileContext] Google profile image is auto-generated initials, will generate custom one');
                      shouldGenerateProfileImage = true;
                    } else {
                      console.log('[ProfileContext] Google profile image is user-uploaded, keeping existing');
                    }
                  } else {
                    console.log('[ProfileContext] No Google access token available, falling back to URL check');
                    // Fallback to simple string check if no access token
                    if (currentProfileImage?.includes('=s96-c')) {
                      console.log('[ProfileContext] Google profile image appears to be initials (URL check), will generate');
                      shouldGenerateProfileImage = true;
                    }
                  }
                } catch (error) {
                  console.error('[ProfileContext] Error checking Google profile image, falling back to URL check:', error);
                  // Fallback to simple string check on error
                  if (currentProfileImage?.includes('=s96-c')) {
                    console.log('[ProfileContext] Google profile image appears to be initials (URL fallback), will generate');
                    shouldGenerateProfileImage = true;
                  }
                }
              }
            }
            
            if (shouldGenerateProfileImage) {
              needsGeneration = true;
            }
            
            if (needsGeneration) {
              generateProfileAssets().catch(error => {
                console.error('[ProfileContext] Asset generation error:', error);
              });
            } else {
              console.log('[ProfileContext] All assets exist, skipping generation');
            }
          } else {
            const newProfile = createDefaultProfile(session);
            setProfile(newProfile);
            
            // First save the profile to Firebase with phone data, then generate assets
            const savedProfile = await saveProfile(newProfile); // This adds phone data and returns merged profile
            
            // Now trigger asset generation with the updated profile that includes phone data
            if (savedProfile) {
              console.log('[ProfileContext] Profile saved with phone data, triggering asset generation');
              generateProfileAssets().catch(error => {
                console.error('[ProfileContext] Asset generation error:', error);
              });
            }
          }
        } catch (error) {
          console.error('[ProfileContext] Failed to load or create profile:', error);
          // Optionally handle fallback to a default profile without saving
        } finally {
          setIsLoading(false);
          loadingRef.current = false;
        }
      } else if (authStatus === 'unauthenticated') {
        // Sign out of Firebase Auth when NextAuth session ends
        if (firebaseAuth.isAuthenticated()) {
          console.log('[ProfileContext] Signing out of Firebase Auth...');
          try {
            await firebaseAuth.signOut();
          } catch (error) {
            console.error('[ProfileContext] Error signing out of Firebase Auth:', error);
          }
        }
        setProfile(null);
        setIsLoading(false);
      }
    };
    loadProfile();
  }, [authStatus, session?.user?.id, update]);

  // Centralized background image management - single fixed background across all views
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const currentBackgroundImage = profile?.backgroundImage;
    
    // Enhanced logging for debugging production issues
    console.log('[ProfileContext] Background image management:', {
      hasBackgroundImage: !!currentBackgroundImage,
      backgroundImageUrl: currentBackgroundImage,
      isProduction: process.env.NODE_ENV === 'production',
      urlLength: currentBackgroundImage?.length || 0,
      urlStartsWith: currentBackgroundImage?.substring(0, 50) || 'N/A',
      serviceWorkerActive: typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller
    });
    
    // Clean up existing background div
    const existingBg = document.getElementById('app-background');
    if (existingBg) {
      console.log('[ProfileContext] Removing existing background div');
      existingBg.remove();
    }

    // Create new background div if we have a background image
    if (currentBackgroundImage) {
      console.log('[ProfileContext] Creating new background div with URL:', currentBackgroundImage);
      
      const backgroundDiv = document.createElement('div');
      backgroundDiv.id = 'app-background';
      backgroundDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-image: url(${currentBackgroundImage});
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        z-index: -1;
        pointer-events: none;
      `;
      document.body.appendChild(backgroundDiv);
      
      // Test if the image loads successfully
      const testImg = new Image();
      testImg.onload = () => {
        console.log('[ProfileContext] Background image loaded successfully:', currentBackgroundImage);
      };
      testImg.onerror = (error) => {
        console.error('[ProfileContext] Background image failed to load:', currentBackgroundImage, error);
        
        // If in production and service worker is active, suggest cache clearing
        if (process.env.NODE_ENV === 'production' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
          console.warn('[ProfileContext] Background image failed to load in production with active service worker. This might be a caching issue.');
          console.warn('[ProfileContext] To clear service worker cache, open DevTools -> Application -> Storage -> Clear site data');
        }
      };
      testImg.src = currentBackgroundImage;
      
      // Verify the div was added
      const addedDiv = document.getElementById('app-background');
      console.log('[ProfileContext] Background div added to DOM:', {
        exists: !!addedDiv,
        hasBackgroundImage: !!addedDiv?.style.backgroundImage,
        backgroundImageValue: addedDiv?.style.backgroundImage?.substring(0, 100) || 'N/A'
      });
    } else {
      console.log('[ProfileContext] No background image to display');
    }

    // Cleanup function
    return () => {
      const bgDiv = document.getElementById('app-background');
      if (bgDiv) {
        console.log('[ProfileContext] Cleaning up background div');
        bgDiv.remove();
      }
    };
  }, [profile?.backgroundImage]);

  // Helper function to generate bio and background image independently
  const generateProfileAssets = async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    
    const generations = [];
    let bioGenerationPromise: Promise<any> | null = null;
    
    // Generate bio if not already triggered and bio doesn't exist in current profile
    if (!bioGenerationTriggeredRef.current && !profile?.bio) {
      bioGenerationTriggeredRef.current = true;
      console.log('[ProfileContext] Making bio API call');

      bioGenerationPromise = fetch('/api/bio', { method: 'POST' })
        .then(res => {
          if (!res.ok) {
            throw new Error(`Bio generation API request failed with status: ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          if (data.bio) {
            console.log('[ProfileContext] Bio generated and saved to Firebase:', data.bio);
            // Update streaming state for immediate UI feedback
            setStreamingBio(data.bio);
            
            // Update local data state immediately to prevent race conditions with phone save
            if (profileRef.current) {
              profileRef.current = { ...profileRef.current, bio: data.bio };
            }
            
            return data.bio;
          }
        })
        .catch(error => {
          console.error('[ProfileContext] Bio generation failed:', error);
          bioGenerationTriggeredRef.current = false;
          throw error;
        });
      
      generations.push(bioGenerationPromise);
    }

    // Check if we need to generate a profile image
    let shouldGenerateProfileImage = false;
    
    // Only generate profile image if not already triggered
    if (!profileImageGenerationTriggeredRef.current) {
      profileImageGenerationTriggeredRef.current = true;

      // Check for profile image in existing profile or fall back to session
      const currentProfileImage = profile?.profileImage || session?.user?.image;
      
      // Determine if we should generate an avatar
      let shouldGenerate = false;
      
      if (!currentProfileImage) {
        shouldGenerate = true;
      } else if (currentProfileImage?.includes('googleusercontent.com')) {
        // For Google users, use the proper API to check if it's auto-generated initials
        try {
          const accessToken = session?.accessToken;
          if (accessToken) {
            shouldGenerate = await shouldGenerateAvatarForGoogleUser(accessToken);
          } else {
            // Fallback to simple string check if no access token
            shouldGenerate = currentProfileImage?.includes('=s96-c') || false;
          }
        } catch (error) {
          console.error('[ProfileContext] Error checking Google profile image, falling back to URL check:', error);
          // Fallback to simple string check on error
          shouldGenerate = currentProfileImage?.includes('=s96-c') || false;
        }
      }

      if (shouldGenerate) {
        shouldGenerateProfileImage = true;
        
        // If bio is being generated, wait for it first
        const profileImageGeneration = (async () => {
          let bioToUse = streamingBio;
          
          if (bioGenerationPromise && !bioToUse) {
            try {
              bioToUse = await bioGenerationPromise;
            } catch (error) {
              // Bio generation failed, proceeding with profile image without bio
            }
          }
          
          return fetch('/api/media/profile-image', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ streamingBio: bioToUse }) 
          })
          .then(res => {
            if (!res.ok) {
              throw new Error(`Profile image generation API failed with status: ${res.status}`);
            }
            return res.json();
          })
          .then(data => {
            if (data.imageUrl) {
              // Update streaming state for immediate UI feedback
              setStreamingProfileImage(data.imageUrl);
              
              // API already saved to Firebase, no local state update needed
            }
          })
          .catch(error => {
            console.error('[ProfileContext] Profile image generation failed:', error);
            profileImageGenerationTriggeredRef.current = false;
          });
        })();
        
        generations.push(profileImageGeneration);
      }
    }

    // Generate background image if not already triggered and background doesn't exist in current profile
    if (!backgroundGenerationTriggeredRef.current && !profile?.backgroundImage) {
      backgroundGenerationTriggeredRef.current = true;
      console.log('[ProfileContext] Making background image API call');

      const backgroundGeneration = fetch('/api/media/background-image', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ streamingBio })
      })
        .then(res => {
          if (!res.ok) {
            throw new Error(`Background generation API failed with status: ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          if (data.imageUrl) {
            console.log('[ProfileContext] Background image saved to Firebase storage:', data.imageUrl);
            // Background image will be handled by individual view components
          }
        })
        .catch(error => {
          console.error('[ProfileContext] Background generation failed:', error);
          backgroundGenerationTriggeredRef.current = false;
        });
      
      generations.push(backgroundGeneration);
    }
    
    // Wait for all generations to complete, then reload profile from Firebase
    if (generations.length > 0) {
      try {
        await Promise.all(generations);
        
        // Reload the complete profile from Firebase
        const updatedProfile = await ProfileService.getProfile(userId);
        if (updatedProfile) {
          // Clear streaming states and set final profile
          setStreamingBio(null);
          setStreamingProfileImage(null);
          setStreamingSocialContacts(null);
          setProfile(updatedProfile);
        }
      } catch (error) {
        console.error('[ProfileContext] Error waiting for generations or reloading profile:', error);
      }
    }
  };

  // Update profileRef whenever profile changes
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // Save profile to Firestore
  const saveProfile = useCallback(async (data: Partial<UserProfile>, options: { directUpdate?: boolean; skipUIUpdate?: boolean } = {}): Promise<UserProfile | null> => {
    if (!session?.user?.id) {
      console.error('[ProfileContext] No authenticated user');
      return null;
    }

    // Detect Android for enhanced session sync
    const isAndroid = typeof window !== 'undefined' && /android/i.test(navigator.userAgent);

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
    
    // Save operation starting
    if (wasFormSubmission) {
      setIsSaving(true);
    }

    let merged: UserProfile;

    try {
      const current = profileRef.current || profile || createDefaultProfile(session);
      merged = options.directUpdate 
        ? { ...current, ...data, userId: session.user.id, lastUpdated: Date.now() }
        : { ...mergeNonEmpty(current, data), userId: session.user.id, lastUpdated: Date.now() };

      // Process social media data only for new profiles
      if (merged.contactChannels) {
        // Generate phone-based social media profiles if phone number is provided
        if (merged.contactChannels.phoneInfo?.internationalPhone && 
            (!current.contactChannels?.whatsapp?.username || 
             !current.contactChannels?.telegram?.username || 
             !current.contactChannels?.wechat?.username)) {
          
          console.log('[ProfileContext] Generating phone-based social media profiles');
          const phoneNumber = merged.contactChannels.phoneInfo.internationalPhone;
          const cleanPhone = phoneNumber.replace(/\D/g, ''); // Remove non-digits
          
          // Update WhatsApp
          merged.contactChannels.whatsapp = {
            username: cleanPhone,
            url: `https://wa.me/${cleanPhone}`,
            userConfirmed: false
          };
          
          // Update Telegram
          merged.contactChannels.telegram = {
            username: cleanPhone,
            url: `https://t.me/${cleanPhone}`,
            userConfirmed: false
          };
          
          // Update WeChat
          merged.contactChannels.wechat = {
            username: cleanPhone,
            url: `weixin://dl/chat?${cleanPhone}`,
            userConfirmed: false
          };
          
          // Update streaming state for immediate UI feedback
          setStreamingSocialContacts(merged.contactChannels);
        }
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
        
        // Update React state with the saved data to ensure UI reflects confirmed channels
        if (skipReactUpdate) {
          setProfile(merged);
        }
        
        // Update session with new phone info ONLY for form submissions
        // This prevents session update cascades that cause profile reloads
        const currentSessionPhone = session?.profile?.contactChannels?.phoneInfo?.internationalPhone;
        const newPhone = merged.contactChannels?.phoneInfo?.internationalPhone;
        
        const shouldUpdateSession = wasFormSubmission && 
                                  newPhone &&
                                  currentSessionPhone !== newPhone; // Check if phone actually changed
                                  
        const currentSessionBg = session?.user?.backgroundImage;
        const newBg = merged.backgroundImage;



        // Build session update payload
        let sessionUpdateData: any = {};

        // Include phone data if phone changed via form submission
        if (shouldUpdateSession) {
          sessionUpdateData.profile = {
            contactChannels: {
              phoneInfo: {
                internationalPhone: merged.contactChannels.phoneInfo.internationalPhone,
                nationalPhone: merged.contactChannels.phoneInfo.nationalPhone,
                userConfirmed: merged.contactChannels.phoneInfo.userConfirmed
              }
            }
          };
        }

        // Include background image if it changed
        if (newBg && newBg !== currentSessionBg) {
          sessionUpdateData.backgroundImage = newBg;
        }

        // Perform session update if we have data to send
        if (Object.keys(sessionUpdateData).length && update) {
          try {
            // Cast to any to allow optional options param not present in older typings
            const sessionUpdatePromise = (update as any)(sessionUpdateData, { broadcast: false });
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Session update timeout')), 10000)
            );
            await Promise.race([sessionUpdatePromise, timeoutPromise]);
            console.log('[ProfileContext] Session updated successfully');
          } catch (error) {
            console.error('[ProfileContext] Error updating session:', error);
            // Non-fatal
          }
        }
      } catch (error) {
        console.warn('[ProfileContext] Could not save to Firebase:', error);
        if (isAndroid) {
          console.error('[ProfileContext] 🤖 Android - Firebase save failed:', error);
        }
        // Re-throw the error so the caller knows the save failed
        throw error;
      }
    } catch (error) {
      console.error('[ProfileContext] Error saving profile:', error);
      throw error;
    } finally {
      // Always release the saving lock and reset saving state
      savingRef.current = false;
      if (wasFormSubmission) {
        setIsSaving(false);
      }
    }
    
    return merged;
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

  // Get the latest profile (for external use)
  const getLatestProfile = useCallback((): UserProfile | null => {
    return profileRef.current;
  }, []);

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
        saveProfile,
        getLatestProfile,
        setNavigatingFromSetup,
        streamingBio,
        streamingProfileImage,
        streamingSocialContacts
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
