import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { ProfileService } from '@/lib/firebase/profileService';
import { AdminProfileService } from '@/lib/firebase/admin/profileService';
import { uploadImageBuffer } from '@/lib/firebase/adminConfig';
import { UserProfile } from '@/types/profile';
import { getOpenAIClient } from '@/lib/openai/client';

/**
 * Generates a profile image for a user using OpenAI's gpt-image-1 model.
 * This is a server-side function.
 * @param profile The user profile object.
 * @returns The generated profile image URL as a string, or null if an error occurs.
 */
async function generateProfileImageForProfile(profile: UserProfile): Promise<string | null> {
  console.log(`[AIGenerationService] Generating profile image for: ${profile.name}`);
  try {
    const openai = getOpenAIClient();
    const prompt = `Create a profile picture for a person with this bio: ${profile.bio || 'no bio available'}. ` +
      `The image should be a simple, casual, abstract, and modern. ` +
      `Use a clean, minimalist style with a solid color background. ` +
      `There should be no text on the image`;
      
    console.log(`[API/PROFILE-IMAGE] Using prompt for ${profile.name}:`, prompt);

    const response = await openai.images.generate({
      prompt,
      size: '1024x1024',
      quality: 'low',
      model: 'gpt-image-1'
      // Note: response_format is not needed and not supported by gpt-image-1
    });

    const imageUrl = response.data[0]?.url;
    if (!imageUrl) {
      throw new Error('No profile image was generated in the response');
    }

    console.log(`[API/PROFILE-IMAGE] Successfully generated profile image for: ${profile.name}`);
    return imageUrl;
  } catch (error) {
    console.error('[API/PROFILE-IMAGE] Profile image generation failed:', error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const { imageData } = await req.json();
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
      console.log('[API/PROFILE-IMAGE] Profile image generation starts', { userId, hasImageData: false });
      
      // Get profile and ensure bio is available for better profile image generation
      const profile = await ProfileService.getProfile(userId);
      if (!profile) {
        return NextResponse.json({ error: 'Profile not found, cannot generate image' }, { status: 404 });
      }
      
      // Check if bio exists, if not, try to generate one
      if (!profile.bio) {
        try {
          // Get the latest profile from AdminProfileService to ensure we have the most up-to-date data
          const adminProfile = await AdminProfileService.getProfile(userId);
          if (adminProfile && adminProfile.bio) {
            profile.bio = adminProfile.bio;
            console.log('[API/PROFILE-IMAGE] Using bio from admin profile for generation');
          } else {
            console.log('[API/PROFILE-IMAGE] No bio found for profile image generation');
          }
        } catch (error) {
          console.error('[API/PROFILE-IMAGE] Error retrieving bio:', error);
          // Continue anyway without bio
        }
      }
      
      // Generate image using OpenAI
      const imageUrl = await generateProfileImageForProfile(profile);
      
      if (!imageUrl) {
        return NextResponse.json({ error: 'Failed to generate profile image' }, { status: 500 });
      }
      
      console.log('[API/PROFILE-IMAGE] Successfully received AI-generated image URL, downloading...');
      
      // Download the AI-generated image to re-host it in our storage
      const aiImageResponse = await fetch(imageUrl);
      if (!aiImageResponse.ok) {
        throw new Error('Failed to download AI-generated image');
      }
      const aiImageBuffer = Buffer.from(await aiImageResponse.arrayBuffer());
      
      // Upload to our storage
      console.log('[API/PROFILE-IMAGE] Uploading AI-generated image to Firebase Storage');
      newImageUrl = await uploadImageBuffer(aiImageBuffer, userId, 'profile');
    }

    // Get current profile to update AI generation flags correctly
    const currentProfile = await ProfileService.getProfile(userId);
    
    // Save the new image URL to the profile
    await ProfileService.updateProfile(userId, { 
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
