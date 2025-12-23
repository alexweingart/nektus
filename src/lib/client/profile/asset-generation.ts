/**
 * Profile Asset Generation Service
 * Handles AI-powered profile image and background generation
 */

import type { UserProfile } from '@/types/profile';
import { ClientProfileService as ProfileService } from '@/lib/client/profile/firebase-save';
import { isGoogleInitialsImage } from '@/lib/client/profile/google-image';
import type { MutableRefObject } from 'react';

interface GenerateAssetsParams {
  userId: string;
  profile: UserProfile | null;
  profileRef: MutableRefObject<UserProfile | null>;
  session: {
    user?: { image?: string | null };
    accessToken?: string;
  } | null;
  profileImageGenerationTriggeredRef: MutableRefObject<boolean>;
  backgroundGenerationTriggeredRef: MutableRefObject<boolean>;
  setIsGoogleInitials: (value: boolean) => void;
  setIsCheckingGoogleImage: (value: boolean) => void;
  setStreamingProfileImage: (value: string | null) => void;
  setStreamingSocialContacts: (value: UserProfile['contactEntries'] | null) => void;
  setStreamingBackgroundImage: (value: string | null) => void;
  setProfile: (profile: UserProfile) => void;
}

/**
 * Generate profile assets (profile image and background colors)
 * This function orchestrates AI-powered asset generation based on user's current state
 */
export async function generateProfileAssets(params: GenerateAssetsParams): Promise<void> {
  const {
    userId,
    profile,
    session,
    profileImageGenerationTriggeredRef,
    backgroundGenerationTriggeredRef,
    setIsGoogleInitials,
    setIsCheckingGoogleImage,
    setStreamingProfileImage,
    setStreamingSocialContacts,
    setStreamingBackgroundImage,
    setProfile
  } = params;

  const generations: Promise<unknown>[] = [];
  // Track Google initials check result locally (React state isn't immediate)
  let localIsGoogleInitials = false;

  // Check if we need to generate a profile image
  let shouldGenerateProfileImage = false;

  // Only generate profile image if not already triggered AND not already generated
  if (!profileImageGenerationTriggeredRef.current && !profile?.aiGeneration?.avatarGenerated) {
    profileImageGenerationTriggeredRef.current = true;

    // Check for profile image in existing profile or fall back to session
    const currentProfileImage = profile?.profileImage || session?.user?.image;

    // Determine if we should generate an avatar
    let shouldGenerate = false;

    if (!currentProfileImage) {
      shouldGenerate = true;
    } else if (currentProfileImage?.includes('googleusercontent.com')) {
      // For Google users, check if it's auto-generated initials
      setIsCheckingGoogleImage(true); // Start checking
      try {
        const accessToken = session?.accessToken;
        if (accessToken) {
          shouldGenerate = await isGoogleInitialsImage(accessToken);
          localIsGoogleInitials = shouldGenerate; // Track locally for use later in this function
          setIsGoogleInitials(shouldGenerate);
          console.log('[AssetGeneration] Google profile check result:', shouldGenerate ? 'initials' : 'real photo');
        } else {
          // No access token - assume it's a real photo to avoid unnecessary generation
          shouldGenerate = false;
          localIsGoogleInitials = false;
          setIsGoogleInitials(false);
          console.log('[AssetGeneration] No access token available, assuming real photo');
        }
      } catch (error) {
        console.error('[AssetGeneration] Error checking Google profile image:', error);
        // On error, assume it's a real photo to avoid unnecessary generation
        shouldGenerate = false;
        localIsGoogleInitials = false;
        setIsGoogleInitials(false);
      } finally {
        setIsCheckingGoogleImage(false); // Done checking
      }
    } else {
      setIsGoogleInitials(false);
    }

    if (shouldGenerate) {
      shouldGenerateProfileImage = true;

      const profileImageGeneration = (async () => {
        console.log('[AssetGeneration] Making profile image API call');

        return fetch('/api/profile/generate/profile-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
        .then(res => {
          if (!res.ok) {
            throw new Error(`Profile image generation API failed with status: ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          if (data.imageUrl) {
            console.log('[AssetGeneration] Profile image saved to Firebase storage:', data.imageUrl);
            // Update streaming state for immediate UI feedback
            setStreamingProfileImage(data.imageUrl);
          }
        })
        .catch(error => {
          console.error('[AssetGeneration] Profile image generation failed:', error);
          profileImageGenerationTriggeredRef.current = false;
        });
      })();

      generations.push(profileImageGeneration);
    }
  }

  // Extract background colors only if user has a non-initials profile image
  // Wait for profile image generation decision before triggering background color extraction
  // Skip if already extracted (check aiGeneration flag) OR if colors already exist
  if (!backgroundGenerationTriggeredRef.current &&
      !profile?.backgroundColors &&
      !profile?.aiGeneration?.backgroundImageGenerated) {

    console.log('[AssetGeneration] Background color extraction conditions check:', {
      backgroundColors: profile?.backgroundColors,
      backgroundImageGenerated: profile?.aiGeneration?.backgroundImageGenerated
    });

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
                 !updatedProfile.aiGeneration?.avatarGenerated;
        } catch (error) {
          console.error('[AssetGeneration] Error waiting for profile image generation:', error);
          return false;
        }
      } else {
        // Check current profile image state
        const currentProfileImage = profile?.profileImage || session?.user?.image;

        // Only generate background if we have a custom profile image
        // Don't generate for:
        // 1. No profile image at all
        // 2. AI-generated avatars (those get solid color backgrounds)
        // 3. Google auto-generated initials (use localIsGoogleInitials for immediate check)
        if (!currentProfileImage) return false;
        if (localIsGoogleInitials) return false; // Skip Google initials, but allow real Google photos

        // For Firebase-stored images, only generate background if it's user-uploaded (not AI-generated)
        return !profile?.aiGeneration?.avatarGenerated;
      }
    };

    backgroundGenerationTriggeredRef.current = true;

    const backgroundGeneration = shouldGenerateBackground().then(async (shouldGenerate) => {
      console.log('[AssetGeneration] Background color extraction check - shouldGenerate:', shouldGenerate);
      if (!shouldGenerate) {
        console.log('[AssetGeneration] Skipping background color extraction - user has initials or no custom profile image');
        return;
      }

      console.log('[AssetGeneration] Making background color extraction API call');

      // Get the current bio from profile for background generation
      const bioEntry = profile?.contactEntries?.find(e => e.fieldType === 'bio');
      const bioForBackground = bioEntry?.value || '';

      return fetch('/api/profile/generate/background-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamingBio: bioForBackground }),
        credentials: 'include'
      })
        .then(res => {
          if (!res.ok) {
            throw new Error(`Background color extraction API failed with status: ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          if (data.backgroundColors) {
            console.log('[AssetGeneration] Background colors extracted and saved to Firestore:', data.backgroundColors);
            // Colors are saved to Firestore by the API - profile will be reloaded
          }
        });
    })
      .catch(error => {
        console.error('[AssetGeneration] Background color extraction failed:', error);
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
        setStreamingSocialContacts(null);
        setStreamingBackgroundImage(null);
        setProfile(updatedProfile);
      }
    } catch (error) {
      console.error('[AssetGeneration] Error waiting for generations or reloading profile:', error);
    }
  }
}
