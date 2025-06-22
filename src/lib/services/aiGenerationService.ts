import { UserProfile } from '@/types/profile';
import { shouldGenerateAvatarForGoogleUser } from '@/lib/utils/googleProfileImageDetector';

/**
 * AI Generation Service
 * Handles bio, avatar, and background image generation with proper service separation
 */

// Type definitions for service dependencies
export interface SetStreamingBackgroundImage {
  (url: string | null): void;
}

interface SaveProfile {
  (data: Partial<UserProfile>, options?: { directUpdate?: boolean; skipUIUpdate?: boolean }): Promise<UserProfile | null>;
}

/**
 * Checks if bio generation is needed and conditions are met
 */
export function shouldGenerateBio(
  profile: UserProfile | null,
  bioGeneratedRef: React.MutableRefObject<boolean>
): boolean {
  if (!profile) return false;
  // Check persistent flag first, then ref
  if (profile.aiGeneration?.bioGenerated) return false;
  if (bioGeneratedRef.current) return false;
  if (profile.bio && profile.bio.trim() !== '') return false;
  
  return true;
}

/**
 * Checks if avatar generation is needed and conditions are met
 */
export async function shouldGenerateAvatar(
  profile: UserProfile | null,
  avatarGeneratedRef: React.MutableRefObject<boolean>,
  accessToken?: string
): Promise<boolean> {
  if (!profile) return false;
  // Check persistent flag first, then ref
  if (profile.aiGeneration?.avatarGenerated) return false;
  if (avatarGeneratedRef.current) return false;
  
  // Check if user already has a profile image (from Google/social login)
  if (profile.profileImage && profile.profileImage.trim() !== '' && !profile.profileImage.includes('default-avatar')) {
    // Special handling for Google profile images - check if they're just initials
    const isGoogleImage = profile.profileImage.includes('googleusercontent.com') || profile.profileImage.includes('lh3.googleusercontent.com');
    
    if (isGoogleImage && accessToken) {
      // Use People API to check if it's auto-generated initials
      const shouldGenerate = await shouldGenerateAvatarForGoogleUser(accessToken);
      console.log(`🔍 Google profile photo People API result: should generate = ${shouldGenerate}`);
      return shouldGenerate;
    } else if (isGoogleImage) {
      console.log('⚠️ Google profile image detected but no access token available for People API check');
      // Fallback: don't generate if we can't check
      return false;
    }
    
    // For non-Google images, assume they are real profile photos
    return false;
  }
  
  return true;
}

/**
 * Checks if background image generation is needed and conditions are met
 */
export function shouldGenerateBackgroundImage(
  profile: UserProfile | null,
  backgroundImageGeneratedRef: React.MutableRefObject<boolean>
): boolean {
  if (!profile) return false;
  // Check persistent flag first, then ref
  if (profile.aiGeneration?.backgroundImageGenerated) return false;
  if (backgroundImageGeneratedRef.current) return false;
  if (profile.backgroundImage && profile.backgroundImage.trim() !== '') return false;
  if (!profile.bio || profile.bio.trim() === '') return false; // Bio needed for background generation
  
  return true;
}

/**
 * Generates bio for a profile
 */
export async function generateBio(profile: UserProfile, saveProfile: SaveProfile): Promise<string> {
  console.log('[OpenAI] Generating bio for:', profile.name);

  try {
    const response = await fetch('/api/openai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'bio',
        profile: profile
      })
    });

    if (!response.ok) {
      throw new Error(`Bio generation failed: ${response.status}`);
    }

    const result = await response.json();
    console.log('[OpenAI] Generated bio, length:', result.bio?.length || 0);

    if (!result.bio) {
      throw new Error('No bio returned from API');
    }

    return result.bio;
  } catch (error) {
    console.error('[AIGenerationService] Bio generation failed:', error);
    throw error;
  }
}

/**
 * Generates avatar for a profile
 */
export async function generateAvatar(profile: UserProfile, saveProfile: SaveProfile): Promise<string> {
  console.log('[OpenAI] Generating avatar for:', profile.name);

  try {
    const response = await fetch('/api/openai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'avatar',
        profile: profile
      })
    });

    if (!response.ok) {
      throw new Error(`Avatar generation failed: ${response.status}`);
    }

    const result = await response.json();
    console.log('[OpenAI] Generated avatar, size:', result.imageUrl?.length || 0);

    if (!result.imageUrl) {
      throw new Error('No avatar image URL returned from API');
    }

    // If it's a base64 data URL, upload via API route
    if (result.imageUrl.startsWith('data:image/')) {
      console.log('[Upload] Uploading generated avatar via API...');
      
      const uploadResponse = await fetch('/api/media/profile-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageData: result.imageUrl
        })
      });

      if (!uploadResponse.ok) {
        throw new Error(`Avatar upload failed: ${uploadResponse.status}`);
      }

      const uploadResult = await uploadResponse.json();
      console.log('[Upload] Avatar uploaded successfully');
      return uploadResult.imageUrl;
    }

    return result.imageUrl;
  } catch (error) {
    console.error('[AIGenerationService] Avatar generation failed:', error);
    throw error;
  }
}

/**
 * Generates background image for a profile
 */
export async function generateBackgroundImage(
  profile: UserProfile,
  setStreamingBackgroundImage: SetStreamingBackgroundImage
): Promise<string> {
  let lastPartialImageUrl = '';

  try {
    const response = await fetch('/api/media/background-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bio: profile.bio,
        name: profile.name,
        profileImage: profile.profileImage
      })
    });

    if (!response.ok) {
      throw new Error(`Background image generation failed: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body for streaming');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let finalImageUrl = '';
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '' || !line.startsWith('data: ')) continue;
          
          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === 'partial_image' && data.imageUrl) {
              console.log('[OpenAI] Received partial background image, size:', data.imageUrl.length);
              lastPartialImageUrl = data.imageUrl;
              setStreamingBackgroundImage(data.imageUrl);
            } 
            else if (data.type === 'completed' && data.imageUrl) {
              console.log('[OpenAI] Received final background image, size:', data.imageUrl.length);
              finalImageUrl = data.imageUrl;
              setStreamingBackgroundImage(data.imageUrl);
            }            } catch (e) {
              // Silently skip malformed JSON lines
            }
        }

        if (finalImageUrl) break;
      }
    } finally {
      reader.releaseLock();
    }

    // Use final image URL or fallback to last partial
    if (!finalImageUrl && lastPartialImageUrl) {
      finalImageUrl = lastPartialImageUrl;
      setStreamingBackgroundImage(lastPartialImageUrl);
    }

    if (!finalImageUrl) {
      throw new Error('No image URL received from streaming response');
    }

    return finalImageUrl;

  } catch (error) {
    console.error('[AIGenerationService] Error in generateBackgroundImage:', error);
    
    // If we have a partial image, use it as fallback
    if (lastPartialImageUrl) {
      setStreamingBackgroundImage(lastPartialImageUrl);
      return lastPartialImageUrl;
    }
    
    console.error('[AIGenerationService] Background image generation failed:', error);
    setStreamingBackgroundImage(null);
    throw error;
  }
}

/**
 * Orchestrates bio generation and saving
 */
export async function generateAndSaveBio(
  profile: UserProfile,
  bioGeneratedRef: React.MutableRefObject<boolean>,
  saveProfile: SaveProfile
): Promise<UserProfile> {
  try {
    const generatedBio = await generateBio(profile, saveProfile);

    // Save bio with persistent flag
    const updatedProfile = await saveProfile({ 
      bio: generatedBio,
      aiGeneration: {
        ...profile.aiGeneration,
        bioGenerated: true,
        avatarGenerated: profile.aiGeneration?.avatarGenerated || false,
        backgroundImageGenerated: profile.aiGeneration?.backgroundImageGenerated || false
      }
    }, { directUpdate: true, skipUIUpdate: true });
    
    console.log('[Firebase] Saved bio to Firestore for user:', profile.userId);
    bioGeneratedRef.current = true;
    
    // Return updated profile or fallback with bio added
    return updatedProfile || { 
      ...profile, 
      bio: generatedBio,
      aiGeneration: {
        ...profile.aiGeneration,
        bioGenerated: true,
        avatarGenerated: profile.aiGeneration?.avatarGenerated || false,
        backgroundImageGenerated: profile.aiGeneration?.backgroundImageGenerated || false
      }
    };
  } catch (error) {
    console.error('[AIGenerationService] Bio generation and save failed:', error);
    throw error;
  }
}

/**
 * Orchestrates avatar generation and saving
 */
export async function generateAndSaveAvatar(
  profile: UserProfile,
  avatarGeneratedRef: React.MutableRefObject<boolean>,
  saveProfile: SaveProfile
): Promise<UserProfile | null> {
  try {
    const generatedAvatarUrl = await generateAvatar(profile, saveProfile);

    // Create updated profile with new avatar
    const updatedProfile: UserProfile = {
      ...profile,
      profileImage: generatedAvatarUrl,
      aiGeneration: {
        ...profile.aiGeneration,
        bioGenerated: profile.aiGeneration?.bioGenerated || false,
        avatarGenerated: true,
        backgroundImageGenerated: profile.aiGeneration?.backgroundImageGenerated || false
      }
    };

    // Save avatar with immediate UI update for visual feedback
    const savedProfile = await saveProfile(updatedProfile, { directUpdate: false, skipUIUpdate: false });
    
    console.log('[Firebase] Saved avatar URL to Firestore for user:', profile.userId);
    avatarGeneratedRef.current = true;
    
    return savedProfile || updatedProfile;
    
  } catch (error) {
    console.error('[AIGenerationService] Avatar generation and save failed:', error);
    throw error;
  }
}

/**
 * Orchestrates background image generation and saving
 */
export async function generateAndSaveBackgroundImage(
  profile: UserProfile,
  setStreamingBackgroundImage: SetStreamingBackgroundImage,
  backgroundImageGeneratedRef: React.MutableRefObject<boolean>,
  saveProfile: SaveProfile
): Promise<void> {
  try {
    const generatedImageUrl = await generateBackgroundImage(profile, setStreamingBackgroundImage);
    
    // Try to upload to Firebase Storage for persistence
    try {
      const uploadResponse = await fetch('/api/media/background-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          base64Data: generatedImageUrl,
          action: 'upload'
        })
      });

      if (uploadResponse.ok) {
        const { imageUrl: storageUrl } = await uploadResponse.json();
        console.log('[Firebase] Background image uploaded to Storage:', storageUrl);
        
        // Save storage URL with persistent flag
        await saveProfile({ 
          backgroundImage: storageUrl,
          aiGeneration: {
            ...profile.aiGeneration,
            bioGenerated: profile.aiGeneration?.bioGenerated || false,
            avatarGenerated: profile.aiGeneration?.avatarGenerated || false,
            backgroundImageGenerated: true
          }
        }, { directUpdate: true, skipUIUpdate: true });
        console.log('[Firebase] Background image URL saved to Firestore for user:', profile.userId);
        
        backgroundImageGeneratedRef.current = true;
      } else {
        console.warn('[Firebase] Upload failed, keeping streaming image visible');
      }
    } catch (uploadError) {
      console.warn('[Firebase] Upload error, keeping streaming image visible:', uploadError);
    }
    
  } catch (error) {
    console.error('[AIGenerationService] Background image generation failed:', error);
    setStreamingBackgroundImage(null); // Clear streaming state on generation error
    throw error;
  }
}

/**
 * Complete AI generation orchestration: bio → avatar → background image
 */
export async function orchestrateCompleteAIGeneration(
  profile: UserProfile,
  setStreamingBackgroundImage: (url: string | null) => void,
  refs: {
    bioGeneratedRef: React.MutableRefObject<boolean>;
    avatarGeneratedRef: React.MutableRefObject<boolean>;
    backgroundImageGeneratedRef: React.MutableRefObject<boolean>;
  },
  saveProfile: SaveProfile,
  accessToken?: string
): Promise<void> {
  // Initialize refs from persistent flags
  if (profile.aiGeneration?.bioGenerated) {
    refs.bioGeneratedRef.current = true;
  }
  if (profile.aiGeneration?.avatarGenerated) {
    refs.avatarGeneratedRef.current = true;
  }
  if (profile.aiGeneration?.backgroundImageGenerated) {
    refs.backgroundImageGeneratedRef.current = true;
  }

  // Early exit: Check if all content already exists (both content and flags)
  const hasBio = profile.bio && profile.bio.trim() !== '';
  const hasAvatar = profile.profileImage && profile.profileImage.trim() !== '' && !profile.profileImage.includes('default-avatar');
  const hasBackgroundImage = profile.backgroundImage && profile.backgroundImage.trim() !== '';
  const allGenerated = profile.aiGeneration?.bioGenerated && profile.aiGeneration?.avatarGenerated && profile.aiGeneration?.backgroundImageGenerated;
  
  if (hasBio && hasAvatar && hasBackgroundImage && allGenerated) {
    refs.bioGeneratedRef.current = true;
    refs.avatarGeneratedRef.current = true;
    refs.backgroundImageGeneratedRef.current = true;
    return;
  }
  
  try {
    let updatedProfile = profile; // Track the updated profile
    
    // Step 1: Generate bio if needed  
    if (shouldGenerateBio(profile, refs.bioGeneratedRef)) {
      const updatedProfileFromBio = await generateAndSaveBio(profile, refs.bioGeneratedRef, saveProfile);
      if (updatedProfileFromBio) {
        updatedProfile = updatedProfileFromBio; // Use updated profile with bio
      }
    } else {
      refs.bioGeneratedRef.current = true;
    }

    // Step 2: Generate avatar if needed (doesn't require bio)
    const shouldGenAvatar = await shouldGenerateAvatar(updatedProfile, refs.avatarGeneratedRef, accessToken);
    if (shouldGenAvatar) {
      const updatedProfileFromAvatar = await generateAndSaveAvatar(updatedProfile, refs.avatarGeneratedRef, saveProfile);
      if (updatedProfileFromAvatar) {
        updatedProfile = updatedProfileFromAvatar; // Use updated profile with new avatar
      }
    } else {
      refs.avatarGeneratedRef.current = true;
    }

    // Step 3: Generate background image if needed (requires bio to exist and uses latest profile with avatar)
    if (shouldGenerateBackgroundImage(updatedProfile, refs.backgroundImageGeneratedRef)) {
      await generateAndSaveBackgroundImage(updatedProfile, setStreamingBackgroundImage, refs.backgroundImageGeneratedRef, saveProfile);
    } else {
      refs.backgroundImageGeneratedRef.current = true;
    }
    
  } catch (error) {
    console.error('[AIGenerationService] Complete AI generation orchestration failed:', error);
    throw error;
  }
}

/**
 * Helper function to check if avatar generation is complete for a profile
 * This is used for initialization and doesn't require async Google image detection
 */
export function isAvatarGenerationComplete(profile: UserProfile): boolean {
  // Check persistent flag first
  if (profile.aiGeneration?.avatarGenerated) return true;
  
  // Check if user has a non-default profile image
  if (profile.profileImage && profile.profileImage.trim() !== '' && !profile.profileImage.includes('default-avatar')) {
    // For Google images, we'll be more conservative in initialization
    // If it's a Google image, we'll let the full async check run later
    const isGoogleImage = profile.profileImage.includes('googleusercontent.com') || profile.profileImage.includes('lh3.googleusercontent.com');
    if (isGoogleImage) {
      // Don't assume it's complete - let the async process determine this
      return false;
    }
    // For non-Google images, assume they are real profile photos
    return true;
  }
  
  return false;
}

// Helper function to get bio from the last save (this would need to be implemented based on your profile refresh logic)
async function getBioFromLastSave(): Promise<string> {
  // This is a placeholder - in the real implementation, you'd get the updated profile
  // For now, we'll just return empty string as the bio is already saved to Firebase
  return '';
}
