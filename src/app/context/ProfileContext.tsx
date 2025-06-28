"use client";

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ProfileService } from '@/lib/firebase/profileService';
import { UserProfile } from '@/types/profile';
import { createDefaultProfile as createDefaultProfileService } from '@/lib/services/newUserService';
import { shouldGenerateAvatarForGoogleUser } from '@/lib/utils/googleProfileImageDetector';

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
            
            // Check each asset individually and trigger only what's needed
            console.log('[ProfileContext] Checking what needs generation:', {
              hasBio: !!existingProfile.bio,
              hasBackgroundImage: !!existingProfile.backgroundImage,
              hasProfileImage: !!existingProfile.profileImage,
              aiGeneration: existingProfile.aiGeneration
            });
            console.log('[ProfileContext] Full profile backgroundImage value:', existingProfile.backgroundImage);
            
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
            
            // Check for profile image in existing profile or fall back to session
            const currentProfileImage = existingProfile.profileImage || session?.user?.image;
            
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
            if (isAndroid) {
              console.log('[ProfileContext] 🤖 Android - Creating new profile');
            }
            const newProfile = createDefaultProfile(session);
            setProfile(newProfile);
            
            // First save the profile to Firebase with phone data, then generate assets
            console.log('[ProfileContext] Saving new profile to Firebase before generating assets');
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

    console.log('[ProfileContext] Background image useEffect triggered:', {
      profileExists: !!profile,
      backgroundImage: profile?.backgroundImage,
      hasBackgroundImage: !!profile?.backgroundImage
    });

    const htmlEl = document.documentElement;
    if (profile?.backgroundImage) {
      console.log('[ProfileContext] Applying background image to DOM:', profile.backgroundImage);
      
      // Decode URL to handle any URL encoding issues
      const decodedUrl = decodeURIComponent(profile.backgroundImage);
      console.log('[ProfileContext] Decoded URL:', decodedUrl);
      
      htmlEl.style.transition = 'background-image 0.5s ease-in-out';
      htmlEl.style.backgroundImage = `url("${decodedUrl}")`;
      htmlEl.style.backgroundSize = 'cover';
      htmlEl.style.backgroundPosition = 'center top';
      htmlEl.style.backgroundRepeat = 'no-repeat';
      console.log('[ProfileContext] Background image applied. DOM style:', htmlEl.style.backgroundImage);
    } else {
      console.log('[ProfileContext] No background image, clearing DOM style');
      htmlEl.style.backgroundImage = '';
    }
  }, [profile?.backgroundImage]);

  // Helper function to generate bio and background image independently
  const generateProfileAssets = async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    
    console.log('[ProfileContext] === STARTING ASSET GENERATION ===');
    console.log('[ProfileContext] Current profile state:', {
      hasBio: !!profile?.bio,
      hasPhone: !!profile?.contactChannels?.phoneInfo?.internationalPhone,
      hasWhatsApp: !!profile?.contactChannels?.whatsapp?.username,
      hasTelegram: !!profile?.contactChannels?.telegram?.username,
      hasWeChat: !!profile?.contactChannels?.wechat?.username
    });
    
    const generations = [];
    let bioGenerationPromise: Promise<any> | null = null;
    
    // Generate bio if not already triggered and bio doesn't exist in current profile
    if (!bioGenerationTriggeredRef.current && !profile?.bio) {
      bioGenerationTriggeredRef.current = true;
      console.log('[ProfileContext] === BIO GENERATION STARTED ===');

      bioGenerationPromise = fetch('/api/bio', { method: 'POST' })
        .then(res => {
          if (!res.ok) {
            throw new Error(`Bio generation API request failed with status: ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          if (data.bio) {
            console.log('[ProfileContext] === BIO GENERATION COMPLETED ===');
            console.log('[ProfileContext] Bio received from API:', data.bio);
            
            // Update streaming state for immediate UI feedback
            setStreamingBio(data.bio);
            
            // API already saved to Firebase, no local state update needed
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
      console.log('[ProfileContext] === PROFILE IMAGE GENERATION STARTED ===');

      // Check for profile image in existing profile or fall back to session
      const currentProfileImage = profile?.profileImage || session?.user?.image;
      
      console.log('[ProfileContext] Profile image check in generation flow:', {
        existingProfileImage: profile?.profileImage,
        sessionImage: session?.user?.image,
        currentProfileImage,
        hasGoogleImage: currentProfileImage?.includes('googleusercontent.com')
      });

      // Determine if we should generate an avatar
      let shouldGenerate = false;
      
      if (!currentProfileImage) {
        console.log('[ProfileContext] No profile image, will generate');
        shouldGenerate = true;
      } else if (currentProfileImage?.includes('googleusercontent.com')) {
        // For Google users, use the proper API to check if it's auto-generated initials
        try {
          const accessToken = session?.accessToken;
          if (accessToken) {
            console.log('[ProfileContext] Checking Google profile image via People API...');
            shouldGenerate = await shouldGenerateAvatarForGoogleUser(accessToken);
            console.log('[ProfileContext] Google profile image check result:', shouldGenerate ? 'auto-generated, will generate' : 'user-uploaded, keeping existing');
          } else {
            console.log('[ProfileContext] No Google access token available, falling back to URL check');
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
            console.log('[ProfileContext] Waiting for bio generation to complete before profile image...');
            try {
              bioToUse = await bioGenerationPromise;
            } catch (error) {
              console.log('[ProfileContext] Bio generation failed, proceeding with profile image without bio');
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
              console.log('[ProfileContext] === PROFILE IMAGE GENERATION COMPLETED ===');
              
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
      } else {
        console.log('[ProfileContext] Skipping profile image generation - user has custom image');
      }
    }

    // Generate background image if not already triggered and background doesn't exist in current profile
    if (!backgroundGenerationTriggeredRef.current && !profile?.backgroundImage) {
      backgroundGenerationTriggeredRef.current = true;
      console.log('[ProfileContext] === BACKGROUND IMAGE GENERATION STARTED ===');

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
          console.log('[ProfileContext] Background generation API response:', data);
          if (data.imageUrl) {
            console.log('[ProfileContext] === BACKGROUND IMAGE GENERATION COMPLETED ===');
            console.log('[ProfileContext] Background image URL:', data.imageUrl);
            // Update DOM immediately for visual effect
            document.documentElement.style.transition = 'background-image 0.5s ease-in-out';
            document.documentElement.style.backgroundImage = `url(${data.imageUrl})`;
            console.log('[ProfileContext] Applied background image to DOM:', document.documentElement.style.backgroundImage);
            // API already saved to Firebase, no local state update needed
          } else {
            console.log('[ProfileContext] No imageUrl in response!');
          }
        })
        .catch(error => {
          console.error('[ProfileContext] Background generation failed:', error);
          backgroundGenerationTriggeredRef.current = false;
        });
      
      generations.push(backgroundGeneration);
    }
    
    console.log('[ProfileContext] === ASSET GENERATION TRIGGERS COMPLETED ===');
    
    // Wait for all generations to complete, then reload profile from Firebase
    if (generations.length > 0) {
      try {
        await Promise.all(generations);
        console.log('[ProfileContext] === ALL GENERATIONS COMPLETED, RELOADING PROFILE ===');
        
        // Reload the complete profile from Firebase
        const updatedProfile = await ProfileService.getProfile(userId);
        if (updatedProfile) {
          console.log('[ProfileContext] Profile reloaded from Firebase:', {
            hasBio: !!updatedProfile.bio,
            hasPhone: !!updatedProfile.contactChannels?.phoneInfo?.internationalPhone,
            hasWhatsApp: !!updatedProfile.contactChannels?.whatsapp?.username,
            hasTelegram: !!updatedProfile.contactChannels?.telegram?.username,
            hasWeChat: !!updatedProfile.contactChannels?.wechat?.username,
            hasBackgroundImage: !!updatedProfile.backgroundImage,
            hasProfileImage: !!updatedProfile.profileImage
          });
          
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
