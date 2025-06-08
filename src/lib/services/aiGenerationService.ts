import { UserProfile } from '@/types/profile';

/**
 * AI Generation Service
 * Handles bio, avatar, and background image generation orchestration
 */

interface GenerationRefs {
  bioGeneratedRef: React.MutableRefObject<boolean>;
  avatarGeneratedRef: React.MutableRefObject<boolean>;
  backgroundImageGeneratedRef: React.MutableRefObject<boolean>;
}

interface SetStreamingBackgroundImage {
  (imageUrl: string | null): void;
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
export async function generateBio(profile: UserProfile): Promise<string> {
  console.log('[AIGenerationService] === BIO GENERATION TRIGGERED ===');
  console.log('[AIGenerationService] Bio is empty, generating bio...');
  console.log('[AIGenerationService] Profile userId:', profile.userId);
  
  console.log('Generating bio for profile:', profile.name);

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
    console.log('Bio generation result:', { bio: result.bio });

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
export async function generateAvatar(profile: UserProfile): Promise<string> {
  console.log('[AIGenerationService] === AVATAR GENERATION TRIGGERED ===');
  console.log('[AIGenerationService] Profile image is empty or default, generating avatar...');
  console.log('[AIGenerationService] Profile userId:', profile.userId);
  console.log('[AIGenerationService] Current profile image:', profile.profileImage);
  
  console.log('Generating avatar for profile:', profile.name);

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
    console.log('Avatar generation result:', { 
      imageUrl: result.imageUrl ? 'Generated' : 'None',
      generated: result.generated 
    });

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
  console.log('[AIGenerationService] === BACKGROUND IMAGE GENERATION TRIGGERED ===');
  console.log('[AIGenerationService] Background image is empty but bio exists, generating background image...');
  console.log('[AIGenerationService] Profile userId:', profile.userId);
  console.log('[AIGenerationService] Bio preview:', profile.bio.substring(0, 100) + '...');

  console.log('Generating background image for profile:', profile.name);
  console.log('[AIGenerationService] Profile image available:', !!profile.profileImage);
  console.log('[AIGenerationService] About to call /api/background-image...');

  try {
    const response = await fetch('/api/background-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        profile: profile,
        profileImage: profile.profileImage
      })
    });

    console.log('[AIGenerationService] Background image API response status:', response.status);
    console.log('[AIGenerationService] Background image API response ok:', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Background image generation failed: ${response.status} - ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body for streaming');
    }

    console.log('[AIGenerationService] Processing streaming background image response');
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let finalImageUrl = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'partial' && data.imageUrl) {
                console.log('[AIGenerationService] Received partial background image');
                setStreamingBackgroundImage(data.imageUrl);
              } else if (data.type === 'complete' && data.imageUrl) {
                console.log('[AIGenerationService] Background image generation completed');
                finalImageUrl = data.imageUrl;
                setStreamingBackgroundImage(null); // Clear streaming state
                break;
              }
            } catch (e) {
              // Ignore parsing errors for partial chunks
            }
          }
        }

        if (finalImageUrl) break;
      }
    } finally {
      reader.releaseLock();
    }

    if (!finalImageUrl) {
      throw new Error('No final image URL received from streaming response');
    }

    console.log('[AIGenerationService] Successfully generated background image');
    return finalImageUrl;

  } catch (error) {
    console.error('[AIGenerationService] Background image generation failed:', error);
    setStreamingBackgroundImage(null); // Clear streaming state on error
    throw error;
  }
}

/**
 * Orchestrates bio generation and saving
 */
export async function generateAndSaveBio(
  profile: UserProfile,
  saveProfile: SaveProfile,
  bioGeneratedRef: React.MutableRefObject<boolean>
): Promise<void> {
  try {
    const generatedBio = await generateBio(profile);
    
    console.log('[AIGenerationService] Successfully generated bio:', generatedBio.substring(0, 100) + '...');
    console.log('[AIGenerationService] Full bio length:', generatedBio.length);
    console.log('[AIGenerationService] About to save bio to Firebase with saveProfile...');

    // Save bio with background operation flags
    await saveProfile({ bio: generatedBio }, { directUpdate: true, skipUIUpdate: true });
    
    console.log('[AIGenerationService] === BIO SAVED TO FIREBASE ===');
    bioGeneratedRef.current = true;
    
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
  saveProfile: SaveProfile,
  avatarGeneratedRef: React.MutableRefObject<boolean>
): Promise<void> {
  try {
    const generatedAvatarUrl = await generateAvatar(profile);
    
    console.log('[AIGenerationService] Successfully generated avatar');
    console.log('[AIGenerationService] About to save avatar to Firebase with saveProfile...');

    // Save avatar with background operation flags
    await saveProfile({ profileImage: generatedAvatarUrl }, { directUpdate: true, skipUIUpdate: true });
    
    console.log('[AIGenerationService] === AVATAR SAVED TO FIREBASE ===');
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
  saveProfile: SaveProfile,
  setStreamingBackgroundImage: SetStreamingBackgroundImage,
  backgroundImageGeneratedRef: React.MutableRefObject<boolean>
): Promise<void> {
  try {
    const generatedImageUrl = await generateBackgroundImage(profile, setStreamingBackgroundImage);
    
    // Save background image with background operation flags
    await saveProfile({ backgroundImage: generatedImageUrl }, { directUpdate: true, skipUIUpdate: true });
    
    console.log('[AIGenerationService] Final background image saved silently');
    console.log('[AIGenerationService] === BACKGROUND IMAGE GENERATED AND SAVED ===');
    backgroundImageGeneratedRef.current = true;
    
  } catch (error) {
    console.error('[AIGenerationService] Background image generation and save failed:', error);
    throw error;
  }
}

/**
 * Orchestrates the complete AI generation sequence for new users
 * Sequence: Bio → Avatar (if needed) → Background Image
 */
export async function orchestrateCompleteAIGeneration(
  profile: UserProfile,
  saveProfile: SaveProfile,
  setStreamingBackgroundImage: SetStreamingBackgroundImage,
  refs: {
    bioGeneratedRef: React.MutableRefObject<boolean>;
    avatarGeneratedRef: React.MutableRefObject<boolean>;
    backgroundImageGeneratedRef: React.MutableRefObject<boolean>;
  }
): Promise<void> {
  console.log('[AIGenerationService] === COMPLETE AI GENERATION ORCHESTRATION STARTED ===');
  
  try {
    // Step 1: Generate bio if needed
    if (shouldGenerateBio(profile, refs.bioGeneratedRef)) {
      console.log('[AIGenerationService] Bio needs generation');
      await generateAndSaveBio(profile, saveProfile, refs.bioGeneratedRef);
      
      // Update profile with generated bio for subsequent generations
      const updatedProfile = { ...profile, bio: await getBioFromLastSave() };
      profile = updatedProfile;
    } else {
      console.log('[AIGenerationService] Bio already exists, marking as generated');
      refs.bioGeneratedRef.current = true;
    }

    // Step 2: Generate avatar if needed
    if (shouldGenerateAvatar(profile, refs.avatarGeneratedRef)) {
      console.log('[AIGenerationService] Avatar needs generation');
      await generateAndSaveAvatar(profile, saveProfile, refs.avatarGeneratedRef);
    } else {
      console.log('[AIGenerationService] Avatar already exists or user has profile image, marking as generated');
      refs.avatarGeneratedRef.current = true;
    }

    // Step 3: Generate background image if needed (requires bio to exist)
    if (shouldGenerateBackgroundImage(profile, refs.backgroundImageGeneratedRef)) {
      console.log('[AIGenerationService] Background image needs generation');
      await generateAndSaveBackgroundImage(profile, saveProfile, setStreamingBackgroundImage, refs.backgroundImageGeneratedRef);
    } else {
      console.log('[AIGenerationService] Background image already exists, marking as generated');
      refs.backgroundImageGeneratedRef.current = true;
    }

    console.log('[AIGenerationService] === COMPLETE AI GENERATION ORCHESTRATION COMPLETED ===');
    
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
