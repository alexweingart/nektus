/**
 * iOS Profile Asset Generation Service
 * Handles AI-powered profile image and background generation for iOS native app
 */

import type { UserProfile } from '@nektus/shared-client';
import { isGoogleInitialsImage } from '@nektus/shared-client';
import { ClientProfileService } from '../firebase';
import { getApiBaseUrl, getIdToken } from '../auth/firebase';

export interface AssetGenerationState {
  isCheckingGoogleImage: boolean;
  isGoogleInitials: boolean;
  streamingProfileImage: string | null;
  profileImageGenerationTriggered: boolean;
  backgroundGenerationTriggered: boolean;
}

export interface GenerateAssetsParams {
  userId: string;
  profile: UserProfile | null;
  session: {
    user?: { image?: string | null };
    accessToken?: string;
  } | null;
  currentState: AssetGenerationState;
  onStateChange: (updates: Partial<AssetGenerationState>) => void;
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
    currentState,
    onStateChange,
  } = params;

  const apiBaseUrl = getApiBaseUrl();
  const generations: Promise<unknown>[] = [];
  let localIsGoogleInitials = false;

  // Check if we need to generate a profile image
  let shouldGenerateProfileImage = false;

  // Only generate profile image if not already triggered AND not already generated
  if (!currentState.profileImageGenerationTriggered && !profile?.aiGeneration?.avatarGenerated) {
    onStateChange({ profileImageGenerationTriggered: true });

    // Check for profile image in existing profile or fall back to session
    const currentProfileImage = profile?.profileImage || session?.user?.image;

    // Determine if we should generate an avatar
    let shouldGenerate = false;

    if (!currentProfileImage) {
      shouldGenerate = true;
    } else if (currentProfileImage?.includes('googleusercontent.com')) {
      // For Google users, check if it's auto-generated initials
      onStateChange({ isCheckingGoogleImage: true });
      try {
        const accessToken = session?.accessToken;
        if (accessToken) {
          shouldGenerate = await isGoogleInitialsImage(accessToken);
          localIsGoogleInitials = shouldGenerate;
          onStateChange({
            isGoogleInitials: shouldGenerate,
            isCheckingGoogleImage: false
          });
          console.log('[AssetGeneration] Google profile check result:', shouldGenerate ? 'initials' : 'real photo');
        } else {
          // No access token - assume it's a real photo to avoid unnecessary generation
          shouldGenerate = false;
          localIsGoogleInitials = false;
          onStateChange({
            isGoogleInitials: false,
            isCheckingGoogleImage: false
          });
          console.log('[AssetGeneration] No access token available, assuming real photo');
        }
      } catch (error) {
        console.error('[AssetGeneration] Error checking Google profile image:', error);
        // On error, assume it's a real photo to avoid unnecessary generation
        shouldGenerate = false;
        localIsGoogleInitials = false;
        onStateChange({
          isGoogleInitials: false,
          isCheckingGoogleImage: false
        });
      }
    } else {
      onStateChange({ isGoogleInitials: false });
    }

    if (shouldGenerate) {
      shouldGenerateProfileImage = true;

      const profileImageGeneration = (async () => {
        console.log('[AssetGeneration] Making profile image API call');

        // Get Firebase ID token for authentication
        const idToken = await getIdToken();
        if (!idToken) {
          throw new Error('No Firebase ID token available');
        }

        return fetch(`${apiBaseUrl}/api/profile/generate/profile-image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
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
            onStateChange({ streamingProfileImage: data.imageUrl });
          }
        })
        .catch(error => {
          console.error('[AssetGeneration] Profile image generation failed:', error);
          onStateChange({ profileImageGenerationTriggered: false });
        });
      })();

      generations.push(profileImageGeneration);
    }
  }

  // Extract background colors only if user has a non-initials profile image
  // Skip if already extracted (check aiGeneration flag) OR if colors already exist
  if (!currentState.backgroundGenerationTriggered &&
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
          const updatedProfile = await ClientProfileService.getProfile(userId);
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
        // 3. Google auto-generated initials
        if (!currentProfileImage) return false;
        if (localIsGoogleInitials) return false;

        // For Firebase-stored images, only generate background if it's user-uploaded (not AI-generated)
        return !profile?.aiGeneration?.avatarGenerated;
      }
    };

    onStateChange({ backgroundGenerationTriggered: true });

    const backgroundGeneration = shouldGenerateBackground().then(async (shouldGenerate) => {
      console.log('[AssetGeneration] Background color extraction check - shouldGenerate:', shouldGenerate);
      if (!shouldGenerate) {
        console.log('[AssetGeneration] Skipping background color extraction - user has initials or no custom profile image');
        return;
      }

      console.log('[AssetGeneration] Making background color extraction API call');

      // Get Firebase ID token for authentication
      const idToken = await getIdToken();
      if (!idToken) {
        throw new Error('No Firebase ID token available');
      }

      // Get the current bio from profile for background generation
      const bioEntry = profile?.contactEntries?.find(e => e.fieldType === 'bio');
      const bioForBackground = bioEntry?.value || '';

      return fetch(`${apiBaseUrl}/api/profile/generate/background-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ streamingBio: bioForBackground }),
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
        onStateChange({ backgroundGenerationTriggered: false });
      });

    generations.push(backgroundGeneration);
  }

  // Wait for all generations to complete
  // Don't manually reload profile or clear streaming — Firestore subscription
  // handles profile updates, and clearing streaming can race with the subscription
  // (getProfile may return stale cached data that overwrites the fresh subscription data)
  if (generations.length > 0) {
    try {
      await Promise.all(generations);
    } catch (error) {
      console.error('[AssetGeneration] Error waiting for generations:', error);
    }
  }
}

/**
 * Create initial asset generation state
 */
export function createAssetGenerationState(): AssetGenerationState {
  return {
    isCheckingGoogleImage: false,
    isGoogleInitials: false,
    streamingProfileImage: null,
    profileImageGenerationTriggered: false,
    backgroundGenerationTriggered: false,
  };
}

/**
 * Extract background colors from the user's profile image
 * Called when a user uploads a new profile image
 * The API reads the profile image from Firestore, so call this AFTER saving the profile
 * Returns the extracted backgroundColors, or null on failure
 */
export async function extractBackgroundColors(
  userId: string
): Promise<{ backgroundColors: string[] } | null> {
  const apiBaseUrl = getApiBaseUrl();

  try {
    console.log('[AssetGeneration] Extracting background colors for profile image');

    // Get Firebase ID token for authentication
    const idToken = await getIdToken();
    if (!idToken) {
      console.error('[AssetGeneration] No Firebase ID token available');
      return null;
    }

    const response = await fetch(`${apiBaseUrl}/api/profile/generate/background-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({ streamingBio: '' }),
    });

    if (!response.ok) {
      console.error('[AssetGeneration] Background color extraction API failed:', response.status);
      return null;
    }

    const data = await response.json();
    if (data.backgroundColors) {
      console.log('[AssetGeneration] Background colors extracted:', data.backgroundColors);
      return { backgroundColors: data.backgroundColors };
    }

    return null;
  } catch (error) {
    console.error('[AssetGeneration] Background color extraction failed:', error);
    return null;
  }
}
