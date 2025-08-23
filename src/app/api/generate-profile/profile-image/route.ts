import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { AdminProfileService } from '@/lib/firebase/adminProfileService';
import { uploadImageBuffer } from '@/lib/firebase/adminConfig';
import { UserProfile, ContactEntry } from '@/types/profile';
import { getOpenAIClient } from '@/lib/openai/client';
import { getDefaultBackgroundColor } from '@/lib/services/server/colorService';
import { getFieldValue } from '@/lib/utils/profileTransforms';

/**
 * Converts a base64 string to a buffer
 * @param base64 Base64 encoded string (without the data:image prefix)
 * @returns Buffer containing the image data
 */
function base64ToBuffer(base64: string): Buffer {
  return Buffer.from(base64, 'base64');
}

/**
 * Generates a profile image for a user using OpenAI's gpt-image-1 model.
 * This is a server-side function.
 * @param profile The user profile object.
 * @returns A buffer containing the image data
 */
async function generateProfileImageForProfile(profile: UserProfile): Promise<Buffer> {
  const profileName = getFieldValue(profile.contactEntries, 'name');
  console.log(`[API/PROFILE-IMAGE] Starting profile image generation for: ${profileName}`);
  try {
    const client = getOpenAIClient();
    const backgroundColor = getDefaultBackgroundColor();
    const profileBio = getFieldValue(profile.contactEntries, 'bio');
    const prompt = `Create a profile picture for a person with this bio: ${profileBio || 'no bio available'}. ` +
      `The image should be a simple, casual, abstract, and modern. ` +
      `Use a clean, minimalist style with a solid ${backgroundColor} color background. ` +
      `There should be no text on the image`;
      
    console.log(`[API/PROFILE-IMAGE] Using prompt for ${profileName} with background ${backgroundColor}:`, prompt);

    const response = await client.images.generate({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'low',
    });

    console.log('[API/PROFILE-IMAGE] Response received from OpenAI API');
    
    if (!response || !response.data || !Array.isArray(response.data) || response.data.length === 0) {
      throw new Error('Invalid response from OpenAI');
    }
    
    // Check what we got in response
    const imageData = response.data[0];
    
    // We should always get base64 data with our request format
    if (imageData?.b64_json) {
      console.log('[API/PROFILE-IMAGE] Converting base64 image data to buffer');
      return base64ToBuffer(imageData.b64_json);
    }

    throw new Error('No base64 image data found in the response');
  } catch (error) {
    console.error('[API/PROFILE-IMAGE] Profile image generation failed:', error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const { imageData, streamingBio } = await req.json();
    let newImageUrl: string;

    if (imageData) {
      // Case 1: User uploaded an image
      console.log(`[API/PROFILE-IMAGE] Uploading profile image for user ${userId}`);
      // Log profile image generation start with request (upload)
      console.log('[API/PROFILE-IMAGE] Profile image upload starts', { userId, hasImageData: true });
      const imageBuffer = Buffer.from(imageData.replace(/^data:image\/[a-z]+;base64,/, ''), 'base64');
      newImageUrl = await uploadImageBuffer(imageBuffer, userId, 'profile');
    } else {
      // Case 2: No image data, generate one
      console.log(`[API/PROFILE-IMAGE] Generating profile image for user ${userId}`);
      // Log profile image generation start with request (AI gen)
      console.log('[API/PROFILE-IMAGE] Profile image generation starts', { userId, hasImageData: false, hasStreamingBio: !!streamingBio });
      
      // Always get the most recent profile to ensure we have any newly generated bio
      const profile = await AdminProfileService.getProfile(userId);
      if (!profile) {
        return NextResponse.json({ error: 'Profile not found, cannot generate image' }, { status: 404 });
      }
      
      // Use streaming bio if available, otherwise fall back to profile bio
      const profileBio = getFieldValue(profile.contactEntries, 'bio');
      const bioForGeneration = streamingBio || profileBio;
      
      const profileName = getFieldValue(profile.contactEntries, 'name');
      console.log('[API/PROFILE-IMAGE] Using profile for generation:', {
        name: profileName,
        usingStreamingBio: !!streamingBio,
        bioSource: streamingBio ? 'streaming' : 'profile',
        bioLength: bioForGeneration?.length || 0
      });
      
      // Create a modified profile object with the streaming bio for generation
      const bioEntry: ContactEntry = { fieldType: 'bio', value: bioForGeneration, section: 'universal', order: -1, isVisible: true, confirmed: true };
      const profileForGeneration: UserProfile = { ...profile, contactEntries: [...(profile.contactEntries || []).filter(e => e.fieldType !== 'bio'), bioEntry] };
      
      // Generate image using OpenAI
      const imageBuffer = await generateProfileImageForProfile(profileForGeneration);
      
      // Upload to our storage
      console.log('[API/PROFILE-IMAGE] Uploading AI-generated image to Firebase Storage');
      newImageUrl = await uploadImageBuffer(imageBuffer, userId, 'profile');
    }

    // Get current profile to update AI generation flags correctly
    const currentProfile = await AdminProfileService.getProfile(userId);
    
    // Save the new image URL to the profile
    await AdminProfileService.updateProfile(userId, {
      profileImage: newImageUrl,
      aiGeneration: {
        bioGenerated: currentProfile?.aiGeneration?.bioGenerated || false,
        avatarGenerated: true,
        backgroundImageGenerated: currentProfile?.aiGeneration?.backgroundImageGenerated || false
      }
    });
    // Log profile image generation complete and saved to Firestore with response
    console.log('[API/PROFILE-IMAGE] Profile image complete & saved to Firestore', { userId, imageUrl: newImageUrl });

    return NextResponse.json({ imageUrl: newImageUrl });

  } catch (error) {
    console.error(`[API/PROFILE-IMAGE] Error processing profile image for user ${userId}:`, error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return NextResponse.json({ error: 'Failed to process profile image.', details: message }, { status: 500 });
  }
}
