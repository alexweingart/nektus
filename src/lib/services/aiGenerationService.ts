import { UserProfile } from '@/types/profile';

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
  if (bioGeneratedRef.current) return false;
  if (profile.bio && profile.bio.trim() !== '') return false;
  
  return true;
}

/**
 * Checks if avatar generation is needed and conditions are met
 */
export function shouldGenerateAvatar(
  profile: UserProfile | null,
  avatarGeneratedRef: React.MutableRefObject<boolean>
): boolean {
  if (!profile) return false;
  if (avatarGeneratedRef.current) return false;
  
  // Check if user already has a profile image (from Google/social login)
  if (profile.profileImage && profile.profileImage.trim() !== '' && !profile.profileImage.includes('default-avatar')) {
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
    const response = await fetch('/api/background-image', {
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

    // Save bio using ProfileContext (silent save - no UI updates)
    const updatedProfile = await saveProfile({ bio: generatedBio }, { directUpdate: true, skipUIUpdate: true });
    
    console.log('[Firebase] Saved bio to Firestore for user:', profile.userId);
    bioGeneratedRef.current = true;
    
    // Return updated profile or fallback with bio added
    return updatedProfile || { ...profile, bio: generatedBio };
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
): Promise<void> {
  try {
    const generatedAvatarUrl = await generateAvatar(profile, saveProfile);

    // Save avatar using ProfileContext (silent save - no UI updates)
    await saveProfile({ profileImage: generatedAvatarUrl }, { directUpdate: true, skipUIUpdate: true });
    
    console.log('[Firebase] Saved avatar URL to Firestore for user:', profile.userId);
    avatarGeneratedRef.current = true;
    
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
      const uploadResponse = await fetch('/api/background-image', {
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
        
        // Save storage URL to Firestore (silent save - no UI updates)
        await saveProfile({ backgroundImage: storageUrl }, { directUpdate: true, skipUIUpdate: true });
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
  saveProfile: SaveProfile
): Promise<void> {
  // Early exit: Check if all content already exists
  const hasBio = profile.bio && profile.bio.trim() !== '';
  const hasAvatar = profile.profileImage && profile.profileImage.trim() !== '' && !profile.profileImage.includes('default-avatar');
  const hasBackgroundImage = profile.backgroundImage && profile.backgroundImage.trim() !== '';
  
  if (hasBio && hasAvatar && hasBackgroundImage) {
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
    if (shouldGenerateAvatar(updatedProfile, refs.avatarGeneratedRef)) {
      await generateAndSaveAvatar(updatedProfile, refs.avatarGeneratedRef, saveProfile);
    } else {
      refs.avatarGeneratedRef.current = true;
    }

    // Step 3: Generate background image if needed (requires bio to exist)
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

// Helper function to get bio from the last save (this would need to be implemented based on your profile refresh logic)
async function getBioFromLastSave(): Promise<string> {
  // This is a placeholder - in the real implementation, you'd get the updated profile
  // For now, we'll just return empty string as the bio is already saved to Firebase
  return '';
}
