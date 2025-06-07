"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { ProfileService } from '@/lib/firebase/profileService';
import { UserProfile } from '@/types/profile';
import { generateSocialProfilesFromEmail, processSocialProfile } from '@/lib/utils/socialMedia';

// Types
type ProfileContextType = {
  profile: UserProfile | null;
  isLoading: boolean;
  isSaving: boolean;
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
  const loadingRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);
  const pathname = usePathname();
  const bioGeneratedRef = useRef(false);
  const backgroundImageGeneratedRef = useRef(false);
  
  // Ref to store the latest profile data without triggering re-renders
  const profileRef = useRef<UserProfile | null>(null);

  console.log('[ProfileContext] Status:', authStatus, 'User ID:', session?.user?.id);

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
          hasBio: !!loadedProfile.bio
        });
        setProfile(loadedProfile);
        profileRef.current = loadedProfile;
        
        // If profile already has a bio, mark as generated to prevent regeneration
        if (loadedProfile.bio && loadedProfile.bio.trim() !== '') {
          console.log('[ProfileContext] Profile already has bio, marking as generated');
          bioGeneratedRef.current = true;
        }
        
        // Update session with phone info (ONLY ONCE, no circular updates)
        if (update && loadedProfile.contactChannels?.phoneInfo) {
          try {
            await update({
              profile: {
                contactChannels: {
                  phoneInfo: {
                    internationalPhone: loadedProfile.contactChannels.phoneInfo.internationalPhone || '',
                    nationalPhone: loadedProfile.contactChannels.phoneInfo.nationalPhone || '',
                    userConfirmed: loadedProfile.contactChannels.phoneInfo.userConfirmed || false
                  }
                }
              }
            });
            console.log('[ProfileContext] Session updated with profile data');
          } catch (error) {
            console.warn('[ProfileContext] Could not update session:', error);
          }
        }
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
  }, [authStatus, session?.user?.id, loadProfile, update]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // Save profile to Firestore
  const saveProfile = useCallback(async (data: Partial<UserProfile>, options: { directUpdate?: boolean; skipUIUpdate?: boolean } = {}): Promise<UserProfile | null> => {
    console.log('[ProfileContext] saveProfile called with data:', data);
    
    if (!session?.user?.id) {
      console.error('[ProfileContext] No authenticated user');
      return null;
    }

    // Set saving state to prevent setup effects from running during form submission
    const wasFormSubmission = !options.directUpdate && data.contactChannels?.phoneInfo;
    if (wasFormSubmission) {
      setIsSaving(true);
    }

    try {
      const current = profile || createDefaultProfile(session);
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
      const skipReactUpdate = wasFormSubmission || options.directUpdate || options.skipUIUpdate;
      
      if (!skipReactUpdate) {
        console.log('[ProfileContext] Updating React state for UI updates');
        setProfile(merged);
      } else {
        console.log('[ProfileContext] Skipping React state update - background operation or form submission');
      }
      
      // Save to Firebase
      try {
        await ProfileService.saveProfile(merged);
        console.log('[ProfileContext] Profile saved to Firebase');
        
        // Update session with new phone info (only if phone changed AND it's not a background operation)
        if (update && merged.contactChannels?.phoneInfo && !options.directUpdate) {
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
            console.log('[ProfileContext] Session updated with new profile data');
          } catch (error) {
            console.error('[ProfileContext] Error updating session:', error);
          }
        } else {
          console.log('[ProfileContext] Skipping session update - background operation or no phone change');
        }
      } catch (error) {
        console.warn('[ProfileContext] Could not save to Firebase:', error);
      }
      
      return merged;
    } catch (error) {
      console.error('[ProfileContext] Error saving profile:', error);
      throw error;
    } finally {
      if (wasFormSubmission) {
        setIsSaving(false);
      }
    }
  }, [session?.user?.id, profile, update]);

  // Clear profile
  const clearProfile = useCallback(async (): Promise<void> => {
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
      
    } catch (error) {
      console.error('[ProfileContext] Error clearing profile:', error);
      throw error; // Re-throw to be handled by the UI
    }
  }, []);

  // Placeholder generation functions
  const generateBackgroundImage = useCallback(async (profile: UserProfile): Promise<string | null> => {
    try {
      console.log('Generating background image for profile:', profile.name);
      
      const response = await fetch('/api/background-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bio: profile.bio,
          name: profile.name,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to generate background image:', errorData);
        return null;
      }

      const result = await response.json();
      console.log('Background image generation result:', result);
      
      return result.imageUrl || null;
    } catch (error) {
      console.error('Background image generation error:', error);
      return null;
    }
  }, []);

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
          // Save the generated bio to Firebase
          const updatedProfile = await saveProfile({ bio: generatedBio }, { directUpdate: true, skipUIUpdate: true });
          console.log('[ProfileContext] === BIO SAVED TO FIREBASE ===');
          
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
    
    if ((!profileToCheck.backgroundImage || profileToCheck.backgroundImage.trim() === '') && 
        profileToCheck.bio && profileToCheck.bio.trim() !== '') {
      console.log('[ProfileContext] === BACKGROUND IMAGE GENERATION TRIGGERED ===');
      console.log('[ProfileContext] Background image is empty but bio exists, generating background image...');
      console.log('[ProfileContext] Profile userId:', profileToCheck.userId);
      console.log('[ProfileContext] Bio preview:', profileToCheck.bio.substring(0, 100) + '...');
      
      // Mark as generated immediately to prevent duplicate calls
      backgroundImageGeneratedRef.current = true;
      
      try {
        const generatedBackgroundImage = await generateBackgroundImage(profileToCheck);
        if (generatedBackgroundImage) {
          console.log('[ProfileContext] Successfully generated background image');
          // Save the generated background image to Firebase
          await saveProfile({ backgroundImage: generatedBackgroundImage }, { directUpdate: true, skipUIUpdate: true });
          console.log('[ProfileContext] === BACKGROUND IMAGE SAVED TO FIREBASE ===');
        } else {
          console.warn('[ProfileContext] Failed to generate background image');
          // Reset ref if generation failed
          backgroundImageGeneratedRef.current = false;
        }
      } catch (error) {
        console.error('[ProfileContext] Error generating background image:', error);
        // Reset ref if generation failed
        backgroundImageGeneratedRef.current = false;
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
    console.log('[ProfileContext] profile exists:', !!profile);
    console.log('[ProfileContext] session email:', session?.user?.email);
    console.log('[ProfileContext] bioGeneratedRef.current:', bioGeneratedRef.current);
    console.log('[ProfileContext] backgroundImageGeneratedRef.current:', backgroundImageGeneratedRef.current);
    console.log('[ProfileContext] profile data:', profile);
    
    // Reset generation tracking when user changes
    if (session?.user?.id !== lastUserIdRef.current) {
      bioGeneratedRef.current = false;
      backgroundImageGeneratedRef.current = false;
      lastUserIdRef.current = session?.user?.id || null;
    }

    // Check if profile already has bio/background image and mark as generated
    if (profile) {
      if (profile.bio && profile.bio.trim() !== '') {
        console.log('[ProfileContext] Profile already has bio, marking bioGeneratedRef as true');
        bioGeneratedRef.current = true;
      }
      if (profile.backgroundImage && profile.backgroundImage.trim() !== '') {
        console.log('[ProfileContext] Profile already has background image, marking backgroundImageGeneratedRef as true');
        backgroundImageGeneratedRef.current = true;
      }
    }
    
    if (pathname === '/setup' && profile && session?.user?.email && !isSaving) {
      console.log('[ProfileContext] === SETUP CONDITIONS MET ===');
      const email = session.user.email;
      const phone = profile.contactChannels?.phoneInfo?.internationalPhone;
      
      console.log('[ProfileContext] email:', email);
      console.log('[ProfileContext] phone:', phone);
      console.log('[ProfileContext] current bio:', profile.bio);
      console.log('[ProfileContext] current backgroundImage:', profile.backgroundImage);
      
      // Check if bio already exists - if so, mark as generated to prevent future attempts
      if (profile.bio && profile.bio.trim() !== '') {
        console.log('[ProfileContext] Bio already exists in profile, marking as generated');
        bioGeneratedRef.current = true;
        
        // Always check if background image should be generated when bio exists
        console.log('[ProfileContext] Checking background image generation since bio exists...');
        (async () => {
          await checkAndGenerateBackgroundImage(profile);
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
        
        // Check if social media fields are empty (indicating first-time setup)
        const socialPlatforms = ['facebook', 'instagram', 'x', 'linkedin', 'snapchat', 'whatsapp', 'telegram', 'wechat'] as const;
        
        // Debug: show actual social media field values
        console.log('[ProfileContext] Current social media fields:');
        socialPlatforms.forEach(platform => {
          const channel = profile.contactChannels?.[platform];
          console.log(`  ${platform}:`, channel);
        });
        
        const allSocialEmpty = socialPlatforms.every(platform => {
          const channel = profile.contactChannels?.[platform];
          return !channel?.username || channel.username === '';
        });
        
        console.log('[ProfileContext] All social media fields empty:', allSocialEmpty);
        
        // Execute the logic
        (async () => {
          if (allSocialEmpty) {
            console.log('[ProfileContext] === SOCIAL MEDIA GENERATION TRIGGERED ===');
            console.log('[ProfileContext] Setup page: Auto-generating social media profiles from email:', email);
            const generatedProfiles = generateSocialProfilesFromEmail(email, phone);
            console.log('[ProfileContext] Generated social profiles:', generatedProfiles);
            
            // Update the profile with auto-generated social media data
            const updatedContactChannels = {
              ...profile.contactChannels,
              ...generatedProfiles
            };
            
            console.log('[ProfileContext] About to save updated contact channels to Firebase:', updatedContactChannels);
            
            // Save the updated profile
            try {
              const savedProfile = await saveProfile({ contactChannels: updatedContactChannels }, { directUpdate: true });
              console.log('[ProfileContext] === SOCIAL MEDIA SAVED SUCCESSFULLY ===');
              console.log('[ProfileContext] Successfully saved social media data to Firebase:', savedProfile?.contactChannels);
              
              // After social media is saved, check if bio should be generated
              await checkAndGenerateBio(savedProfile || profile);
            } catch (error) {
              console.error('[ProfileContext] Failed to save social media data to Firebase:', error);
            }
          } else {
            console.log('[ProfileContext] === SOCIAL MEDIA ALREADY EXISTS ===');
            console.log('[ProfileContext] Social media fields are not empty, checking if bio should be generated...');
            
            // Social media exists, check if bio should be generated
            await checkAndGenerateBio(profile);
          }
        })();
      } else {
        console.log('[ProfileContext] === BIO ALREADY GENERATED ===');
        console.log('[ProfileContext] Bio already generated, only checking background image...');
      }
    } else {
      console.log('[ProfileContext] === SETUP CONDITIONS NOT MET ===');
      if (pathname !== '/setup') console.log('[ProfileContext] Not on setup page');
      if (!profile) console.log('[ProfileContext] No profile');
      if (!session?.user?.email) console.log('[ProfileContext] No user email');
      if (isSaving) console.log('[ProfileContext] Saving in progress');
    }
  }, [pathname, profile, session?.user?.email, saveProfile, generateBio, isSaving]);

  const getLatestProfile = useCallback(() => {
    return profileRef.current;
  }, []);

  return (
    <ProfileContext.Provider
      value={{
        profile,
        isLoading,
        isSaving,
        saveProfile,
        clearProfile,
        generateBackgroundImage,
        generateBio,
        generateProfileImage,
        getLatestProfile,
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
