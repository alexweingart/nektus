import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { AdminProfileService } from '@/lib/server/profile/firebase-admin';
import { uploadImageBuffer } from '@/lib/config/firebase/admin';
import { UserProfile } from '@/types/profile';
import { getFieldValue } from '@/lib/client/profile/transforms';
import { generateInitialsAvatar, dataUrlToBuffer } from '@/lib/client/profile/avatar';
import { getOpenAIClient } from '@/lib/config/openai';

/**
 * Extract initials from a name string
 */
function getInitials(name: string): string {
  if (!name) return '??';

  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  // Take first letter of first and last word
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Generate a prompt for AI profile image creation
 * Creates a robot glyph avatar with negative space forming the user's first initial
 */
function generateProfileImagePrompt(name: string): string {
  const initials = getInitials(name);
  const firstLetter = initials.charAt(0);

  return `Create a minimalist robot face/head icon in a bold, vector logo style. ` +
    `IMPORTANT: Show only the robot's face/head - no body, no torso, no shoulders. Just the head. ` +
    `The robot face should be a single iconic glyph composed of simple geometric shapes (circles, rounded rectangles, rounded triangles). ` +
    `CRITICAL: Use negative space within the robot's face/screen to form the letter "${firstLetter}". The letter should be clearly readable and integrated into the design, not added as text. ` +
    `Background: gradient from pale cream (#E7FED2) to lime green (#71E454) at 135 degrees, filling the entire square image edge-to-edge. ` +
    `The robot face should be centered and use thick, consistent strokes with rounded corners throughout. ` +
    `Style: modern, friendly, tech-forward. Think mascot-like but minimal—like a logo mark for a tech company. ` +
    `The person's name is "${name}" - use subtle design cues to suggest personality (e.g., bolder/angular shapes for masculine names, softer/rounder shapes for feminine names, balanced for neutral), but keep the core robot face structure. ` +
    `CRITICAL: The gradient (#E7FED2 to #71E454) must fill the entire image from edge to edge. ` +
    `CRITICAL: Do not add white backgrounds, white circles, or any other background shapes. ` +
    `CRITICAL: Do not include any text, letters as text, or typography. The "${firstLetter}" should be formed by negative space only. ` +
    `CRITICAL: Only show the robot's head/face - no body parts below the head. ` +
    `Color palette: Robot should use dark teal (#004D40) or near-black for maximum contrast against the nekt gradient background. ` +
    `Keep it simple, iconic, and instantly recognizable as a robot face.`;
}

/**
 * Converts a base64 string to a buffer
 */
function base64ToBuffer(base64: string): Buffer {
  return Buffer.from(base64, 'base64');
}

/**
 * Generates an AI profile image for a user with initials + animal
 * Falls back to initials SVG if AI generation fails
 */
async function generateProfileImageForProfile(profile: UserProfile): Promise<Buffer> {
  const profileName = getFieldValue(profile.contactEntries, 'name') || 'User';
  console.log(`[API/PROFILE-IMAGE] Starting profile image generation for: ${profileName}`);

  try {
    // Generate AI prompt based on user's name/initials
    const prompt = generateProfileImagePrompt(profileName);
    console.log(`[API/PROFILE-IMAGE] Using AI prompt:`, prompt);

    const client = getOpenAIClient();
    console.log(`[API/PROFILE-IMAGE] Calling OpenAI API with model: gpt-image-1.5, size: 1024x1024`);

    // Add timeout wrapper for OpenAI API call
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('OpenAI API timeout after 30 seconds')), 30000)
    );

    // Generate the image - GPT image models return base64 by default (response_format not supported)
    const imageGenerationPromise = client.images.generate({
      model: 'gpt-image-1.5',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'low',
    });

    console.log('[API/PROFILE-IMAGE] Waiting for OpenAI response...');
    const response = await Promise.race([imageGenerationPromise, timeoutPromise]) as { data?: Array<{ b64_json?: string; url?: string }> };

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
    console.error('[API/PROFILE-IMAGE] AI generation failed, falling back to initials SVG:', error);

    // Fallback to initials SVG
    const avatarDataUrl = generateInitialsAvatar(profileName, 1024);
    const imageBuffer = dataUrlToBuffer(avatarDataUrl);
    console.log('[API/PROFILE-IMAGE] Initials SVG fallback generated successfully');
    return imageBuffer;
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    // Parse request body, handling empty or malformed JSON
    let imageData: string | undefined;
    try {
      const body = await req.json();
      imageData = body.imageData;
    } catch (jsonError) {
      console.log('[API/PROFILE-IMAGE] No valid JSON body, proceeding with AI generation');
      imageData = undefined;
    }

    let newImageUrl: string;

    if (imageData) {
      // Case 1: User uploaded an image
      console.log(`[API/PROFILE-IMAGE] Uploading profile image for user ${userId}`);
      // Log profile image generation start with request (upload)
      console.log('[API/PROFILE-IMAGE] Profile image upload starts', { userId, hasImageData: true });
      const imageBuffer = Buffer.from(imageData.replace(/^data:image\/[a-z]+;base64,/, ''), 'base64');
      newImageUrl = await uploadImageBuffer(imageBuffer, userId, 'profile');
    } else {
      // Case 2: No image data, generate AI profile image (with initials fallback)
      console.log(`[API/PROFILE-IMAGE] Generating AI profile image for user ${userId}`);
      console.log('[API/PROFILE-IMAGE] Profile image generation starts', { userId, hasImageData: false });

      // Get the profile to extract the user's name
      const profile = await AdminProfileService.getProfile(userId);
      if (!profile) {
        return NextResponse.json({ error: 'Profile not found, cannot generate image' }, { status: 404 });
      }

      // Delete old profile images (both .svg and .jpg) to force cache refresh
      if (profile.profileImage) {
        try {
          const { storage } = await import('@/lib/config/firebase/admin').then(m => m.getFirebaseAdmin());
          const rawBucketName = process.env.FIREBASE_STORAGE_BUCKET ||
                               process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
                               `${process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.appspot.com`;
          const bucketName = rawBucketName.replace(/[\n\r\t]/g, '').trim();

          // Delete both .svg and .jpg versions to be safe
          const svgPath = `users/${userId}/profile.svg`;
          const jpgPath = `users/${userId}/profile.jpg`;

          console.log('[API/PROFILE-IMAGE] Deleting old images...');
          await Promise.all([
            storage.bucket(bucketName).file(svgPath).delete().catch(() => console.log('[API/PROFILE-IMAGE] No SVG to delete')),
            storage.bucket(bucketName).file(jpgPath).delete().catch(() => console.log('[API/PROFILE-IMAGE] No JPG to delete'))
          ]);
        } catch (error) {
          console.log('[API/PROFILE-IMAGE] Failed to delete old images:', error);
        }
      }

      // Generate AI profile image (or fallback to initials SVG)
      const imageBuffer = await generateProfileImageForProfile(profile);

      // Upload to our storage
      console.log('[API/PROFILE-IMAGE] Uploading profile image to Firebase Storage');
      newImageUrl = await uploadImageBuffer(imageBuffer, userId, 'profile');
    }

    // Get current profile to update AI generation flags correctly
    const currentProfile = await AdminProfileService.getProfile(userId);

    // Add cache-busting timestamp to the URL without changing the filename
    const cacheBustedUrl = `${newImageUrl}?t=${Date.now()}`;

    // Save the cache-busted URL to the profile
    await AdminProfileService.updateProfile(userId, {
      profileImage: cacheBustedUrl,
      aiGeneration: {
        bioGenerated: currentProfile?.aiGeneration?.bioGenerated || false,
        avatarGenerated: true,
        backgroundImageGenerated: currentProfile?.aiGeneration?.backgroundImageGenerated || false
      }
    });
    // Log profile image generation complete and saved to Firestore with response
    console.log('[API/PROFILE-IMAGE] Profile image complete & saved to Firestore', { userId, imageUrl: cacheBustedUrl });

    return NextResponse.json({ imageUrl: cacheBustedUrl });

  } catch (error) {
    console.error(`[API/PROFILE-IMAGE] Error processing profile image for user ${userId}:`, error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return NextResponse.json({ error: 'Failed to process profile image.', details: message }, { status: 500 });
  }
}
