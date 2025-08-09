"use client";

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { ClientProfileService as ProfileService } from '@/lib/firebase/clientProfileService';
import { UserProfile } from '@/types/profile';
import { createDefaultProfile as createDefaultProfileService } from '@/lib/services/server/newUserService';
import { isGoogleInitialsImage } from '@/lib/services/client/googleProfileImageService';
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
            if (isAndroid && existingProfile.contactChannels?.entries) {
              const phoneEntry = existingProfile.contactChannels.entries.find(e => e.platform === 'phone');
              const sessionPhoneEntry = (session?.profile?.contactChannels as any)?.entries?.find((e: any) => e.platform === 'phone');
              
              if (phoneEntry?.internationalPhone && sessionPhoneEntry?.internationalPhone !== phoneEntry.internationalPhone) {
                // Force session update to sync with Firebase data
                try {
                  if (update) {
                    await update({
                      profile: {
                        contactChannels: {
                          entries: [
                            {
                              platform: 'phone',
                              section: phoneEntry.section,
                              userConfirmed: phoneEntry.userConfirmed,
                              internationalPhone: phoneEntry.internationalPhone,
                              nationalPhone: phoneEntry.nationalPhone || ''
                            }
                          ]
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
            
            // Note: Background generation logic moved to generateProfileAssets() 
            // to properly wait for profile image generation decisions
            
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
                    const shouldGenerate = await isGoogleInitialsImage(accessToken);
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


  // Helper function to generate bio, background image, and social links
  const generateProfileAssets = async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    
    const generations: Promise<any>[] = [];
    let bioAndSocialGenerationPromise: Promise<any> | null = null;
    
    // Generate bio and social links together if not already triggered
    if (!bioAndSocialGenerationTriggeredRef.current && (!profile?.bio || !profile?.contactChannels?.entries?.some(e => e.platform === 'facebook' && e.username))) {
      bioAndSocialGenerationTriggeredRef.current = true;
      console.log('[ProfileContext] Making unified bio and social API call');

      bioAndSocialGenerationPromise = fetch('/api/generate-profile/bio-and-social', { method: 'POST' })
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
            shouldGenerate = await isGoogleInitialsImage(accessToken);
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
          
          return fetch('/api/generate-profile/profile-image', { 
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
              // Add cache busting to ensure fresh image display
              const cacheBustingUrl = `${data.imageUrl}?v=${Date.now()}`;
              
              // Update streaming state for immediate UI feedback
              setStreamingProfileImage(cacheBustingUrl);
              
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

    // Generate background image only if user has a non-initials profile image
    // Wait for profile image generation decision before triggering background generation
    if (!backgroundGenerationTriggeredRef.current && !profile?.backgroundImage) {
      
      // Only generate background if we have a custom (non-initials) profile image
      const shouldGenerateBackground = async () => {
        // If profile image generation is happening, wait for it to complete
        if (shouldGenerateProfileImage && generations.length > 0) {
          try {
            await Promise.all(generations);
            // After profile image generation, check if we now have a custom profile image
            const updatedProfile = await ProfileService.getProfile(userId);
            // Only generate background for user-uploaded images, not AI-generated ones
            return updatedProfile?.profileImage && 
                   !updatedProfile.profileImage.includes('googleusercontent.com') &&
                   !updatedProfile.aiGeneration?.avatarGenerated;
          } catch (error) {
            console.error('[ProfileContext] Error waiting for profile image generation:', error);
            return false;
          }
        } else {
          // Check current profile image state
          const currentProfileImage = profile?.profileImage || session?.user?.image;
          
          // Only generate background if we have a custom profile image (not Google initials)
          if (!currentProfileImage) return false;
          if (currentProfileImage.includes('googleusercontent.com')) {
            // Check if it's initials
            try {
              const accessToken = session?.accessToken;
              if (accessToken) {
                const isInitials = await isGoogleInitialsImage(accessToken);
                return !isInitials; // Generate background only if it's NOT initials
              } else {
                // Fallback: if URL contains =s96-c, it's likely initials
                return !currentProfileImage.includes('=s96-c');
              }
            } catch (error) {
              console.error('[ProfileContext] Error checking if Google image is initials:', error);
              return !currentProfileImage.includes('=s96-c');
            }
          }
          
          // For Firebase-stored images, only generate background if it's user-uploaded (not AI-generated)
          return !profile?.aiGeneration?.avatarGenerated;
        }
      };
      
      backgroundGenerationTriggeredRef.current = true;
      
      const backgroundGeneration = shouldGenerateBackground().then(async (shouldGenerate) => {
        if (!shouldGenerate) {
          console.log('[ProfileContext] Skipping background generation - user has initials or no custom profile image');
          return;
        }
        
        console.log('[ProfileContext] Making background image API call');
        
        return fetch('/api/generate-profile/background-image', { 
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
          });
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
    const phoneEntry = data.contactChannels?.entries?.find(e => e.platform === 'phone');
    const wasFormSubmission = !options.directUpdate && 
      phoneEntry?.internationalPhone && 
      phoneEntry.internationalPhone.trim() !== '';
    
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

      // Phone-based social media generation is now handled by verify-phone-socials API
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
        const mergedPhoneEntry = merged.contactChannels?.entries?.find(e => e.platform === 'phone');
        if (wasFormSubmission && mergedPhoneEntry?.internationalPhone) {
          const phoneNumber = mergedPhoneEntry.internationalPhone;
          console.log('[ProfileContext] Phone saved, triggering phone-based social generation');
          
          // Generate and verify WhatsApp profile asynchronously (don't block)
          fetch('/api/generate-profile/verify-phone-socials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phoneNumber: phoneNumber,
              platforms: ['whatsapp']
            })
          }).then(async response => {
            if (response.ok) {
              const data = await response.json();
              const whatsappResult = data.results?.find((r: any) => r.platform === 'whatsapp');
              
              if (whatsappResult && whatsappResult.verified) {
                console.log('[ProfileContext] WhatsApp profile verified:', {
                  phoneNumber: phoneNumber,
                  verified: true
                });
                
                // Create WhatsApp profile
                const whatsappProfile = {
                  username: phoneNumber.replace(/\D/g, ''),
                  url: `https://wa.me/${phoneNumber.replace(/\D/g, '')}`,
                  userConfirmed: true
                };
                
                // Update WhatsApp profile in Firebase
                const phoneBasedUpdate: any = {};
                phoneBasedUpdate['contactChannels.whatsapp'] = whatsappProfile;
                
                // Save phone-based socials to Firebase and update UI
                if (Object.keys(phoneBasedUpdate).length > 0) {
                  // Get fresh profile data to avoid overwriting concurrent AI social updates
                  const freshProfile = profileRef.current;
                  // Use fresh profile data or fallback to merged, then update with new phone-based socials
                  const baseEntries = freshProfile?.contactChannels?.entries || merged.contactChannels?.entries || [];
                  const updatedEntries = [...baseEntries];
                  
                  // Add or update WhatsApp entry if generated
                  if (whatsappProfile) {
                    const whatsappIndex = updatedEntries.findIndex(e => e.platform === 'whatsapp');
                    const whatsappEntry = {
                      platform: 'whatsapp' as const,
                      section: 'personal' as const,
                      userConfirmed: false, // Phone-based generation is unconfirmed
                      username: whatsappProfile.username,
                      url: whatsappProfile.url
                    };
                    
                    if (whatsappIndex >= 0) {
                      updatedEntries[whatsappIndex] = whatsappEntry;
                    } else {
                      updatedEntries.push(whatsappEntry);
                    }
                  }
                  
                  const updatedContactChannels = { entries: updatedEntries };
                  
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
              } else {
                console.log('[ProfileContext] WhatsApp verification failed or not verified');
              }
            } else {
              console.error('[ProfileContext] WhatsApp verification API failed:', response.status);
            }
          }).catch(error => {
            console.error('[ProfileContext] WhatsApp verification request failed:', error);
          });
        }
        
        // Update session with new phone info ONLY for form submissions
        // This prevents session update cascades that cause profile reloads
        const currentSessionPhoneEntry = session?.profile?.contactChannels?.entries?.find((e: any) => e.platform === 'phone');
        const newPhoneEntry = merged.contactChannels?.entries?.find(e => e.platform === 'phone');
        
        const shouldUpdateSession = wasFormSubmission && 
                                  newPhoneEntry?.internationalPhone &&
                                  currentSessionPhoneEntry?.internationalPhone !== newPhoneEntry.internationalPhone; // Check if phone actually changed
                                  
        const currentSessionBg = session?.user?.backgroundImage;
        const newBg = merged.backgroundImage;



        // Build session update payload
        let sessionUpdateData: any = {};

        // Include phone data if phone changed via form submission
        if (shouldUpdateSession && newPhoneEntry) {
          sessionUpdateData.profile = {
            contactChannels: {
              entries: [
                {
                  platform: 'phone',
                  section: newPhoneEntry.section || 'universal',
                  userConfirmed: newPhoneEntry.userConfirmed || false,
                  internationalPhone: newPhoneEntry.internationalPhone,
                  nationalPhone: newPhoneEntry.nationalPhone || ''
                }
              ]
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
      
      // CRITICAL: Get fresh profile data from Firebase before saving to prevent overwrites
      // This ensures we have the latest bio and other data if they were generated in parallel
      const freshProfile = await ProfileService.getProfile(session.user.id);
      if (!freshProfile) {
        console.error('[ProfileContext] Fresh profile not found, falling back to local data');
        const merged = { ...current, ...data, userId: session.user.id };
        profileRef.current = merged;
        await ProfileService.saveProfile(merged);
        return;
      }
      
      // Build merged profile preserving fresh Firebase data
      const merged = { 
        ...freshProfile, // Start with fresh Firebase data
        ...data, // Apply the specific updates we want to make
        userId: session.user.id,
        lastUpdated: Date.now()
      };
      
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
        const vCardService = await import('@/lib/utils/vCardGeneration');
        (window as any).generateVCard = vCardService.generateVCard;
        (window as any).generateVCard30 = vCardService.generateVCard30;
        (window as any).generateSimpleVCard = vCardService.generateSimpleVCard;
        (window as any).createVCardFile = vCardService.createVCardFile;
        (window as any).downloadVCard = vCardService.downloadVCard;
        (window as any).saveVCard = vCardService.saveVCard;
        (window as any).displayVCardInlineForIOS = vCardService.displayVCardInlineForIOS;
        console.log('✅ vCard testing functions loaded! Available functions:');
        console.log('- generateVCard(profile)');
        console.log('- generateVCard30(profile)');
        console.log('- generateSimpleVCard(profile)');
        console.log('- createVCardFile(profile)');
        console.log('- downloadVCard(profile)');
        console.log('- saveVCard(profile)');
        console.log('- displayVCardInlineForIOS(profile)');
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
  if (!profile?.contactChannels?.entries) return false;
  
  const phoneEntry = profile.contactChannels.entries.find(e => e.platform === 'phone');
  return !!(phoneEntry?.internationalPhone && phoneEntry.internationalPhone.trim() !== '');
}

// Helper function to merge objects deeply
function mergeNonEmpty<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] !== undefined && source[key] !== null) {
      // Special handling for contactChannels to merge entries array properly
      if (key === 'contactChannels' && typeof source[key] === 'object' && source[key] !== null) {
        const targetChannels = (result[key] as any)?.entries || [];
        const sourceChannels = (source[key] as any)?.entries || [];
        
        // Create a copy of target entries to avoid mutation
        const mergedEntries = [...targetChannels];
        
        // Merge entries by platform - preserve existing entries and add/update new ones
        for (const sourceEntry of sourceChannels) {
          const existingIndex = mergedEntries.findIndex(
            (entry: any) => entry.platform === sourceEntry.platform
          );
          
          if (existingIndex >= 0) {
            // Merge the existing entry with new data, preserving existing fields
            mergedEntries[existingIndex] = {
              ...mergedEntries[existingIndex],
              ...sourceEntry
            };
          } else {
            // Add new entry
            mergedEntries.push(sourceEntry);
          }
        }
        
        result[key] = {
          entries: mergedEntries
        } as T[Extract<keyof T, string>];
      } else if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
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
