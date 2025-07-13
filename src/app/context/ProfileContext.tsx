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
  const bioAndSocialGenerationTriggeredRef = useRef(false);
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
    
    // Clean up existing background div
    const existingBg = document.getElementById('app-background');
    if (existingBg) {
      existingBg.remove();
    }

    // Create new background div if we have a background image
    if (currentBackgroundImage) {
      // Clean the URL to remove any newlines or whitespace that could break CSS
      const cleanedUrl = currentBackgroundImage.replace(/[\n\r\t]/g, '').trim();
      
      const backgroundDiv = document.createElement('div');
      backgroundDiv.id = 'app-background';
      backgroundDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-image: url(${cleanedUrl});
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        z-index: -1;
        pointer-events: none;
      `;
      document.body.appendChild(backgroundDiv);
    }

    // Cleanup function
    return () => {
      const bgDiv = document.getElementById('app-background');
      if (bgDiv) {
        bgDiv.remove();
      }
    };
  }, [profile?.backgroundImage]);

  // Helper function to generate bio, background image, and social links
  const generateProfileAssets = async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    
    const generations = [];
    let bioAndSocialGenerationPromise: Promise<any> | null = null;
    
    // Generate bio and social links together if not already triggered
    if (!bioAndSocialGenerationTriggeredRef.current && (!profile?.bio || !profile?.contactChannels?.facebook?.username)) {
      bioAndSocialGenerationTriggeredRef.current = true;
      console.log('[ProfileContext] Making unified bio and social API call');

      bioAndSocialGenerationPromise = fetch('/api/bio-and-social', { method: 'POST' })
        .then(res => {
          if (!res.ok) {
            throw new Error(`Bio and social generation API request failed with status: ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          if (data.bio && data.contactChannels) {
            console.log('[ProfileContext] Bio and social links generated and saved to Firebase:', {
              bio: data.bio,
              contactChannels: data.contactChannels
            });
            // Update streaming states for immediate UI feedback
            setStreamingBio(data.bio);
            setStreamingSocialContacts(data.contactChannels);
            
            // Update local data state immediately to prevent race conditions
            if (profileRef.current) {
              profileRef.current = { 
                ...profileRef.current, 
                bio: data.bio,
                contactChannels: data.contactChannels
              };
            }
            
            return { bio: data.bio, contactChannels: data.contactChannels };
          }
        })
        .catch(error => {
          console.error('[ProfileContext] Bio and social generation failed:', error);
          bioAndSocialGenerationTriggeredRef.current = false;
          throw error;
        });
      
      generations.push(bioAndSocialGenerationPromise);
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
        
        // If bio and social are being generated, wait for them first
        const profileImageGeneration = (async () => {
          let bioToUse = streamingBio;
          
          if (bioAndSocialGenerationPromise && !bioToUse) {
            try {
              const result = await bioAndSocialGenerationPromise;
              bioToUse = result?.bio;
            } catch (error) {
              // Bio and social generation failed, proceeding with profile image without bio
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

      // Phone-based social media generation is now handled by PhoneBasedSocialService
      // after the profile is successfully saved (see phone save trigger below)

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
        
        // Trigger phone-based social generation if phone number was saved
        if (wasFormSubmission && merged.contactChannels?.phoneInfo?.internationalPhone) {
          const phoneNumber = merged.contactChannels.phoneInfo.internationalPhone;
          console.log('[ProfileContext] Phone saved, triggering phone-based social generation');
          
          // Import and call PhoneBasedSocialService asynchronously (don't block)
          import('@/lib/services/phoneBasedSocialService').then(({ PhoneBasedSocialService }) => {
            PhoneBasedSocialService.generatePhoneBasedSocials(phoneNumber).then(result => {
              if (result.success && (result.whatsapp || result.telegram)) {
                console.log('[ProfileContext] Phone-based socials generated:', {
                  whatsapp: !!result.whatsapp,
                  telegram: !!result.telegram,
                  profilesVerified: result.profilesVerified
                });
                
                // Update only phone-based social profiles in Firebase
                const phoneBasedUpdate: any = {};
                if (result.whatsapp) phoneBasedUpdate['contactChannels.whatsapp'] = result.whatsapp;
                if (result.telegram) phoneBasedUpdate['contactChannels.telegram'] = result.telegram;
                
                // Save phone-based socials to Firebase and update UI
                if (Object.keys(phoneBasedUpdate).length > 0) {
                  // Get fresh profile data to avoid overwriting concurrent AI social updates
                  const freshProfile = profileRef.current;
                  const updatedContactChannels = { 
                    // Use fresh contact channels data, with fallbacks to avoid undefined errors
                    phoneInfo: freshProfile?.contactChannels?.phoneInfo || merged.contactChannels.phoneInfo,
                    email: freshProfile?.contactChannels?.email || merged.contactChannels.email,
                    facebook: freshProfile?.contactChannels?.facebook || merged.contactChannels.facebook,
                    instagram: freshProfile?.contactChannels?.instagram || merged.contactChannels.instagram,
                    x: freshProfile?.contactChannels?.x || merged.contactChannels.x,
                    linkedin: freshProfile?.contactChannels?.linkedin || merged.contactChannels.linkedin,
                    snapchat: freshProfile?.contactChannels?.snapchat || merged.contactChannels.snapchat,
                    wechat: freshProfile?.contactChannels?.wechat || merged.contactChannels.wechat,
                    // Override with new phone-based socials
                    whatsapp: result.whatsapp || freshProfile?.contactChannels?.whatsapp || merged.contactChannels.whatsapp,
                    telegram: result.telegram || freshProfile?.contactChannels?.telegram || merged.contactChannels.telegram
                  };
                  
                  // Update both Firebase and React state for immediate UI feedback
                  silentSaveToFirebase({ contactChannels: updatedContactChannels }).then(() => {
                    console.log('[ProfileContext] Phone-based socials saved to Firebase');
                    
                    // Update React state so UI shows the new social icons immediately
                    if (profileRef.current) {
                      const updatedProfile = {
                        ...profileRef.current,
                        contactChannels: updatedContactChannels
                      };
                      profileRef.current = updatedProfile;
                      setProfile(updatedProfile);
                      
                      // Also update streaming state for immediate feedback
                      setStreamingSocialContacts(updatedContactChannels);
                    }
                  }).catch(error => {
                    console.error('[ProfileContext] Failed to save phone-based socials:', error);
                  });
                }
              }
            }).catch(error => {
              console.error('[ProfileContext] Phone-based social generation failed:', error);
            });
          }).catch(error => {
            console.error('[ProfileContext] Failed to import PhoneBasedSocialService:', error);
          });
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

  // Make profile available globally for easy debugging
  if (typeof window !== 'undefined') {
    (window as any).getProfile = () => {
      return profileRef.current;
    };
    
    // Helper to load vCard testing functions
    (window as any).loadVCardTests = async () => {
      try {
        const vCardService = await import('@/lib/services/vCardService');
        (window as any).testVCardPhoto = vCardService.testVCardPhoto;
        (window as any).debugVCardPhoto = vCardService.debugVCardPhoto;
        (window as any).generateVCard = vCardService.generateVCard;
        (window as any).generateTestVCardWithPhoto = vCardService.generateTestVCardWithPhoto;
        console.log('✅ vCard testing functions loaded! Available functions:');
        console.log('- testVCardPhoto(profile)');
        console.log('- debugVCardPhoto(imageUrl)');
        console.log('- generateVCard(profile)');
        console.log('- generateTestVCardWithPhoto(profile)');
        return true;
      } catch (error) {
        console.error('❌ Failed to load vCard testing functions:', error);
        return false;
      }
    };
  }

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
