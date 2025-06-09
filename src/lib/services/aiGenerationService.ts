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
export async function generateAvatar(profile: UserProfile, saveProfile: SaveProfile): Promise<string> {
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
        bio: profile.bio,
        name: profile.name,
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
    let buffer = ''; // Buffer to accumulate incomplete lines across chunks

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('[AIGenerationService] Streaming reader finished - no more data');
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        console.log('[AIGenerationService] Received chunk size:', chunk.length);
        
        // Add chunk to buffer
        buffer += chunk;
        
        // Split buffer into lines, keeping the last incomplete line in buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last (potentially incomplete) line in buffer
        
        console.log('[AIGenerationService] Processing', lines.length, 'complete lines');

        for (const line of lines) {
          if (line.trim() === '') continue; // Skip empty lines
          
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6);
              console.log('[AIGenerationService] Parsing complete JSON line, length:', jsonStr.length);
              const data = JSON.parse(jsonStr);
              console.log('[AIGenerationService] Parsed data type:', data.type);
              
              if (data.type === 'partial_image' && data.imageUrl) {
                console.log('[AIGenerationService] Received partial background image');
                console.log('[AIGenerationService] Setting streaming background image:', data.imageUrl.substring(0, 50) + '...');
                setStreamingBackgroundImage(data.imageUrl);
                console.log('[AIGenerationService] Streaming background image set successfully');
              } else if (data.type === 'completed' && data.imageUrl) {
                console.log('[AIGenerationService] Background image generation completed');
                console.log('[AIGenerationService] Final image URL:', data.imageUrl.substring(0, 50) + '...');
                finalImageUrl = data.imageUrl;
                console.log('[AIGenerationService] Setting final image as streaming background for mobile compatibility');
                setStreamingBackgroundImage(data.imageUrl); // Set final image as streaming for mobile
                console.log('[AIGenerationService] Final streaming image set successfully');
                break;
              }
            } catch (e) {
              console.warn('[AIGenerationService] Failed to parse JSON:', e, 'Line length:', line.length);
            }
          } else {
            // Non-data lines are expected (base64 chunks, etc.)
            console.log('[AIGenerationService] Non-data line, length:', line.length);
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
  bioGeneratedRef: React.MutableRefObject<boolean>,
  saveProfile: SaveProfile
): Promise<UserProfile> {
  try {
    const generatedBio = await generateBio(profile, saveProfile);
    
    console.log('[AIGenerationService] Successfully generated bio:', generatedBio.substring(0, 100) + '...');
    console.log('[AIGenerationService] Full bio length:', generatedBio.length);
    console.log('[AIGenerationService] About to save bio using ProfileContext...');

    // Save bio using ProfileContext (silent save - no UI updates)
    const updatedProfile = await saveProfile({ bio: generatedBio }, { directUpdate: true, skipUIUpdate: true });
    
    console.log('[AIGenerationService] === BIO SAVED USING PROFILE CONTEXT ===');
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
    
    console.log('[AIGenerationService] Successfully generated avatar');
    console.log('[AIGenerationService] About to save avatar using ProfileContext...');

    // Save avatar using ProfileContext (silent save - no UI updates)
    await saveProfile({ profileImage: generatedAvatarUrl }, { directUpdate: true, skipUIUpdate: true });
    
    console.log('[AIGenerationService] === AVATAR SAVED USING PROFILE CONTEXT ===');
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
    
    // Save background image using ProfileContext (silent save - no UI updates)
    await saveProfile({ backgroundImage: generatedImageUrl }, { directUpdate: true, skipUIUpdate: true });
    
    console.log('[AIGenerationService] Final background image saved silently');
    console.log('[AIGenerationService] === BACKGROUND IMAGE GENERATED AND SAVED ===');
    console.log('[AIGenerationService] Keeping final streaming image visible for current session');
    backgroundImageGeneratedRef.current = true;
    
    // Note: We intentionally DO NOT clear setStreamingBackgroundImage(null) here
    // The final streaming image remains visible for the current session
    // Firebase save happens silently for future page loads/sessions
    
  } catch (error) {
    console.error('[AIGenerationService] Background image generation and save failed:', error);
    // Clear streaming state immediately on error
    setStreamingBackgroundImage(null);
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
  console.log('[AIGenerationService] === COMPLETE AI GENERATION ORCHESTRATION STARTED ===');
  
  // Early exit: Check if all content already exists
  const hasBio = profile.bio && profile.bio.trim() !== '';
  const hasAvatar = profile.profileImage && profile.profileImage.trim() !== '' && !profile.profileImage.includes('default-avatar');
  const hasBackgroundImage = profile.backgroundImage && profile.backgroundImage.trim() !== '';
  
  if (hasBio && hasAvatar && hasBackgroundImage) {
    console.log('[AIGenerationService] All content already exists, skipping orchestration');
    refs.bioGeneratedRef.current = true;
    refs.avatarGeneratedRef.current = true;
    refs.backgroundImageGeneratedRef.current = true;
    console.log('[AIGenerationService] === COMPLETE AI GENERATION ORCHESTRATION COMPLETED (EARLY EXIT) ===');
    return;
  }
  
  try {
    let updatedProfile = profile; // Track the updated profile
    
    // Step 1: Generate bio if needed  
    if (shouldGenerateBio(profile, refs.bioGeneratedRef)) {
      console.log('[AIGenerationService] Bio needs generation');
      const updatedProfileFromBio = await generateAndSaveBio(profile, refs.bioGeneratedRef, saveProfile);
      if (updatedProfileFromBio) {
        updatedProfile = updatedProfileFromBio; // Use updated profile with bio
        console.log('[AIGenerationService] Using updated profile with bio for subsequent generations');
      }
    } else {
      console.log('[AIGenerationService] Bio already exists, marking as generated');
      refs.bioGeneratedRef.current = true;
    }

    // Step 2: Generate avatar if needed (doesn't require bio)
    if (shouldGenerateAvatar(updatedProfile, refs.avatarGeneratedRef)) {
      console.log('[AIGenerationService] Avatar needs generation');
      await generateAndSaveAvatar(updatedProfile, refs.avatarGeneratedRef, saveProfile);
    } else {
      console.log('[AIGenerationService] Avatar already exists or user has profile image, marking as generated');
      refs.avatarGeneratedRef.current = true;
    }

    // Step 3: Generate background image if needed (requires bio to exist)
    if (shouldGenerateBackgroundImage(updatedProfile, refs.backgroundImageGeneratedRef)) {
      console.log('[AIGenerationService] Background image needs generation');
      await generateAndSaveBackgroundImage(updatedProfile, setStreamingBackgroundImage, refs.backgroundImageGeneratedRef, saveProfile);
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
