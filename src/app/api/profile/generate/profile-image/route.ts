import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { AdminProfileService } from '@/lib/firebase/adminProfileService';
import { uploadImageBuffer } from '@/lib/firebase/adminConfig';
import { UserProfile } from '@/types/profile';
import { getFieldValue } from '@/lib/utils/profileTransforms';
import { generateInitialsAvatar, dataUrlToBuffer } from '@/lib/utils/initialsAvatar';

/**
 * Converts a base64 string to a buffer
 * @param base64 Base64 encoded string (without the data:image prefix)
 * @returns Buffer containing the image data
 */
function base64ToBuffer(base64: string): Buffer {
  return Buffer.from(base64, 'base64');
}

/**
 * Generates an initials-based profile image for a user.
 * PHASE 2: Changed from AI generation to initials for CalConnect merge
 * @param profile The user profile object
 * @returns A buffer containing the SVG image data
 */
function generateProfileImageForProfile(profile: UserProfile): Buffer {
  const profileName = getFieldValue(profile.contactEntries, 'name') || 'User';
  console.log(`[API/PROFILE-IMAGE] Generating initials avatar for: ${profileName}`);

  // Generate initials-based avatar (1024x1024 to match previous size)
  const avatarDataUrl = generateInitialsAvatar(profileName, 1024);
  const imageBuffer = dataUrlToBuffer(avatarDataUrl);

  console.log('[API/PROFILE-IMAGE] Initials avatar generated successfully');
  return imageBuffer;
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
      // Case 2: No image data, generate initials avatar
      console.log(`[API/PROFILE-IMAGE] Generating initials avatar for user ${userId}`);
      console.log('[API/PROFILE-IMAGE] Profile image generation starts', { userId, hasImageData: false });

      // Get the profile to extract the user's name
      const profile = await AdminProfileService.getProfile(userId);
      if (!profile) {
        return NextResponse.json({ error: 'Profile not found, cannot generate image' }, { status: 404 });
      }

      const profileName = getFieldValue(profile.contactEntries, 'name');
      console.log('[API/PROFILE-IMAGE] Generating initials for:', { name: profileName });

      // Generate initials-based avatar
      const imageBuffer = generateProfileImageForProfile(profile);

      // Upload to our storage
      console.log('[API/PROFILE-IMAGE] Uploading initials avatar to Firebase Storage');
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
