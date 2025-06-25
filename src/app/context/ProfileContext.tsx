"use client";

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ProfileService } from '@/lib/firebase/profileService';
import { UserProfile } from '@/types/profile';
import { createDefaultProfile as createDefaultProfileService } from '@/lib/services/newUserService';

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
  
  const loadingRef = useRef(false);
  const savingRef = useRef(false);
  
  const profileRef = useRef<UserProfile | null>(null);

  // Profile creation/loading effect
  useEffect(() => {
    const loadProfile = async () => {
      if (authStatus === 'authenticated' && session?.user?.id && !profile && !loadingRef.current) {
        loadingRef.current = true;
        setIsLoading(true);
        
        // Add Android-specific debugging
        const isAndroid = typeof window !== 'undefined' && /android/i.test(navigator.userAgent);
        if (isAndroid) {
          console.log('[ProfileContext] 🤖 Android detected - Enhanced debugging enabled');
          console.log('[ProfileContext] Session profile phone:', session?.profile?.contactChannels?.phoneInfo?.internationalPhone);
          console.log('[ProfileContext] User ID:', session.user.id);
        }
        
        try {
          const existingProfile = await ProfileService.getProfile(session.user.id);
          if (existingProfile) {
            if (isAndroid) {
              console.log('[ProfileContext] 🤖 Android - Loaded existing profile with phone:', existingProfile.contactChannels?.phoneInfo?.internationalPhone);
            }
            setProfile(existingProfile);
            
            // Android-specific: Ensure session is synced with loaded profile
            if (isAndroid && existingProfile.contactChannels?.phoneInfo?.internationalPhone) {
              const sessionPhone = session?.profile?.contactChannels?.phoneInfo?.internationalPhone;
              const profilePhone = existingProfile.contactChannels.phoneInfo.internationalPhone;
              
              if (sessionPhone !== profilePhone) {
                console.log('[ProfileContext] 🤖 Android - Session/profile phone mismatch, updating session');
                console.log('[ProfileContext] Session phone:', sessionPhone);
                console.log('[ProfileContext] Profile phone:', profilePhone);
                
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
                    console.log('[ProfileContext] 🤖 Android - Session updated successfully');
                  }
                } catch (error) {
                  console.error('[ProfileContext] 🤖 Android - Failed to update session:', error);
                }
              }
            }
            
            // Trigger asset generation for missing assets independently
            if (!existingProfile.bio && !existingProfile.aiGeneration?.bioGenerated) {
              // Generate bio only if missing and not already generated
              fetch('/api/bio', { method: 'POST' })
                .then(res => res.ok ? res.json() : Promise.reject())
                .then(data => data.bio && saveProfile({ bio: data.bio }))
                .catch(error => console.error('[ProfileContext] Bio generation failed:', error));
            }
            if (!existingProfile.backgroundImage && !existingProfile.aiGeneration?.backgroundImageGenerated) {
              // Generate background only if missing and not already generated
              fetch('/api/media/background-image', { method: 'POST' })
                .then(res => res.ok ? res.json() : Promise.reject())
                .then(data => {
                  if (data.imageUrl) {
                    document.documentElement.style.transition = 'background-image 0.5s ease-in-out';
                    document.documentElement.style.backgroundImage = `url(${data.imageUrl})`;
                    if (profileRef.current) {
                      const updatedProfile = { ...profileRef.current, backgroundImage: data.imageUrl };
                      profileRef.current = updatedProfile;
                      ProfileService.saveProfile(updatedProfile).catch(error => 
                        console.error('[ProfileContext] Failed to save background image:', error));
                    }
                  }
                })
                .catch(error => console.error('[ProfileContext] Background generation failed:', error));
            }
          } else {
            if (isAndroid) {
              console.log('[ProfileContext] 🤖 Android - Creating new profile');
            }
            const newProfile = createDefaultProfile(session);
            setProfile(newProfile);
            
            // First save the profile to Firebase, then generate assets in parallel
            console.log('[ProfileContext] Saving new profile to Firebase before generating assets');
            await saveProfile(newProfile); // Save the newly created profile
            
            // Now trigger both bio and background generation for new profiles
            if (!newProfile.bio) {
              fetch('/api/bio', { method: 'POST' })
                .then(res => res.ok ? res.json() : Promise.reject())
                .then(data => data.bio && saveProfile({ bio: data.bio }))
                .catch(error => console.error('[ProfileContext] Bio generation failed:', error));
            }
            if (!newProfile.backgroundImage) {
              fetch('/api/media/background-image', { method: 'POST' })
                .then(res => res.ok ? res.json() : Promise.reject())
                .then(data => {
                  if (data.imageUrl) {
                    document.documentElement.style.transition = 'background-image 0.5s ease-in-out';
                    document.documentElement.style.backgroundImage = `url(${data.imageUrl})`;
                    if (profileRef.current) {
                      const updatedProfile = { ...profileRef.current, backgroundImage: data.imageUrl };
                      profileRef.current = updatedProfile;
                      ProfileService.saveProfile(updatedProfile).catch(error => 
                        console.error('[ProfileContext] Failed to save background image:', error));
                    }
                  }
                })
                .catch(error => console.error('[ProfileContext] Background generation failed:', error));
            }
          }
        } catch (error) {
          console.error('[ProfileContext] Failed to load or create profile:', error);
          if (isAndroid) {
            console.error('[ProfileContext] 🤖 Android - Profile loading error:', error);
          }
          // Optionally handle fallback to a default profile without saving
        } finally {
          setIsLoading(false);
          loadingRef.current = false;
        }
      } else if (authStatus === 'unauthenticated') {
        setProfile(null);
        setIsLoading(false);
      }
    };
    loadProfile();
  }, [authStatus, session?.user?.id, update]);

  // New: keep <html> background in sync with stored profile background
  useEffect(() => {
    if (typeof window === 'undefined') return; // Ensure client-side

    const htmlEl = document.documentElement;
    if (profile?.backgroundImage) {
      htmlEl.style.transition = 'background-image 0.5s ease-in-out';
      htmlEl.style.backgroundImage = `url(${profile.backgroundImage})`;
      htmlEl.style.backgroundSize = 'cover';
      htmlEl.style.backgroundPosition = 'center top';
      htmlEl.style.backgroundRepeat = 'no-repeat';
    } else {
      htmlEl.style.backgroundImage = '';
    }
  }, [profile?.backgroundImage]);



  // Removed the separate background image generation effect as it's now part of generateProfileAssets

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

    // Android-specific debugging
    const isAndroid = typeof window !== 'undefined' && /android/i.test(navigator.userAgent);
    if (isAndroid && data.contactChannels?.phoneInfo) {
      console.log('[ProfileContext] 🤖 Android - Saving profile with phone data:');
      console.log('[ProfileContext] 🤖 Phone data:', data.contactChannels.phoneInfo);
      console.log('[ProfileContext] 🤖 Options:', options);
      console.log('[ProfileContext] 🤖 Current session phone:', session?.profile?.contactChannels?.phoneInfo?.internationalPhone);
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
    
    // Save operation starting
    if (isAndroid && wasFormSubmission) {
      console.log('[ProfileContext] 🤖 Android - This is a form submission with phone data');
    }
    
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
        if (isAndroid) {
          console.log('[ProfileContext] 🤖 Android - About to save to Firebase');
          console.log('[ProfileContext] 🤖 Merged profile phone:', merged.contactChannels?.phoneInfo?.internationalPhone);
          console.log('[ProfileContext] 🤖 All fields being saved:', Object.keys(merged));
          console.log('[ProfileContext] 🤖 Full merged profile:', JSON.stringify(merged, null, 2));
        }
        await ProfileService.saveProfile(merged);
        
        if (isAndroid) {
          console.log('[ProfileContext] 🤖 Android - Firebase save completed successfully');
        }
        
        // Update the ref with the latest saved data
        profileRef.current = merged;
        
        // Update session with new phone info ONLY for form submissions
        // This prevents session update cascades that cause profile reloads
        const currentSessionPhone = session?.profile?.contactChannels?.phoneInfo?.internationalPhone;
        const newPhone = merged.contactChannels?.phoneInfo?.internationalPhone;
        
        const shouldUpdateSession = wasFormSubmission && 
                                  newPhone &&
                                  currentSessionPhone !== newPhone; // Check if phone actually changed
                                  
        const currentSessionBg = session?.user?.backgroundImage;
        const newBg = merged.backgroundImage;

        if (isAndroid) {
          console.log('[ProfileContext] 🤖 Android - Session update check:');
          console.log('[ProfileContext] 🤖 Should update session:', shouldUpdateSession);
          console.log('[ProfileContext] 🤖 Current session phone:', currentSessionPhone);
          console.log('[ProfileContext] 🤖 New phone:', newPhone);
          console.log('[ProfileContext] 🤖 Was form submission:', wasFormSubmission);
        }

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
            if (isAndroid) {
              console.log('[ProfileContext] 🤖 Android - Updating session with data:', sessionUpdateData);
            }
            // Cast to any to allow optional options param not present in older typings
            const sessionUpdatePromise = (update as any)(sessionUpdateData, { broadcast: false });
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Session update timeout')), 10000)
            );
            await Promise.race([sessionUpdatePromise, timeoutPromise]);
            console.log('[ProfileContext] Session updated successfully');
            if (isAndroid) {
              console.log('[ProfileContext] 🤖 Android - Session updated successfully');
            }
          } catch (error) {
            console.error('[ProfileContext] Error updating session:', error);
            if (isAndroid) {
              console.error('[ProfileContext] 🤖 Android - Session update failed:', error);
            }
            // Non-fatal
          }
        } else if (isAndroid) {
          console.log('[ProfileContext] 🤖 Android - No session update needed');
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
