import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { AdminProfileService } from '@/server/profile/firebase-admin';
import { uploadImageBuffer, getFirebaseAdmin } from '@/server/config/firebase';
import { UserProfile } from '@/types/profile';
import { getFieldValue } from '@/client/profile/transforms';
import { generateInitialsAvatar, dataUrlToBuffer } from '@/client/profile/avatar';
import { getOpenAIClient } from '@/server/config/openai';
import { getColorPalette, pickAccentColors, filterChromaticColors } from '@/server/profile/colors';
// Note: Sharp is used for image compositing (creating radial gradient + overlaying robot)
import { generateProfileColors } from '@/shared/colors';
import sharp from 'sharp';

/**
 * Get user ID from either NextAuth session or Firebase ID token
 * This allows both web (NextAuth) and mobile (Firebase) clients to use this API
 */
async function getUserId(req: NextRequest): Promise<string | null> {
  // First try NextAuth session (web clients)
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    console.log('[API/PROFILE-IMAGE] Authenticated via NextAuth session');
    return session.user.id;
  }

  // Fall back to Firebase ID token (mobile clients)
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const idToken = authHeader.replace('Bearer ', '');
      const { auth } = await getFirebaseAdmin();
      const decodedToken = await auth.verifyIdToken(idToken);
      if (decodedToken.uid) {
        console.log('[API/PROFILE-IMAGE] Authenticated via Firebase ID token');
        return decodedToken.uid;
      }
    } catch (error) {
      console.error('[API/PROFILE-IMAGE] Failed to verify Firebase ID token:', error);
    }
  }

  return null;
}

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
 * Creates a robot glyph avatar on transparent background.
 * We'll composite it onto our own radial gradient background.
 */
function generateProfileImagePrompt(name: string, _accent2Color: string): string {
  const initials = getInitials(name);
  const firstLetter = initials.charAt(0);

  return `Create a minimalist robot face/head icon as a LINE ART / OUTLINE drawing on a TRANSPARENT background. ` +
    `CRITICAL STYLE: The robot must be drawn with STROKES/OUTLINES ONLY — NO solid fills, NO filled shapes. ` +
    `Think of it like a white wireframe or line drawing. Every shape (head, eyes, antenna, mouth) should be an outlined stroke, not a filled solid. ` +
    `Use thick, consistent white strokes (like a 6-8px pen) with rounded corners throughout. ` +
    `IMPORTANT: Show only the robot's face/head — no body, no torso, no shoulders. Just the head. ` +
    `The robot face should be composed of simple geometric outlines (circles, rounded rectangles, rounded triangles). ` +
    `CRITICAL: Place the letter "${firstLetter}" prominently in the center of the robot's face/screen area. The letter should be large, clearly readable, and drawn in the same white outline stroke style — NOT as solid filled text. ` +
    `CRITICAL: The background MUST be completely transparent (alpha = 0). No background color, no gradient, just the robot floating on transparency. ` +
    `Style: modern, friendly, tech-forward. Think single-weight line icon or wireframe logo mark. ` +
    `The person's name is "${name}" — use subtle design cues to suggest personality (e.g., angular shapes for masculine names, rounder shapes for feminine names, balanced for neutral), but keep the core robot face structure. ` +
    `CRITICAL: Only show the robot's head/face — no body parts below the head. ` +
    `Color palette: ALL strokes and outlines must be pure white (#FFFFFF). No other colors. No fills — only outlines and strokes. ` +
    `Keep it simple, iconic, and instantly recognizable as a robot face outline on a transparent background.`;
}

/**
 * Converts a base64 string to a buffer
 */
function base64ToBuffer(base64: string): Buffer {
  return Buffer.from(base64, 'base64');
}

/**
 * Parse hex color to RGB values
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

/**
 * Create a radial gradient image using Sharp
 * Center is accent1 (lighter), edge is dominant (darker)
 */
async function createRadialGradientBackground(
  size: number,
  centerColor: string,
  edgeColor: string
): Promise<Buffer> {
  const center = hexToRgb(centerColor);
  const edge = hexToRgb(edgeColor);

  // Create raw RGBA pixel data
  const channels = 4; // RGBA
  const data = Buffer.alloc(size * size * channels);

  const centerX = size / 2;
  const centerY = size / 2;
  const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const t = Math.min(distance / maxRadius, 1); // 0 at center, 1 at corners

      const idx = (y * size + x) * channels;
      data[idx] = Math.round(center.r + (edge.r - center.r) * t);     // R
      data[idx + 1] = Math.round(center.g + (edge.g - center.g) * t); // G
      data[idx + 2] = Math.round(center.b + (edge.b - center.b) * t); // B
      data[idx + 3] = 255; // A (fully opaque)
    }
  }

  return sharp(data, {
    raw: {
      width: size,
      height: size,
      channels: channels,
    },
  })
    .png()
    .toBuffer();
}

/**
 * Force all non-transparent pixels to pure white.
 * GPT-image-1.5 doesn't always comply with "only white" instruction,
 * so we post-process the robot PNG to guarantee white-on-transparent.
 */
async function forceWhitePixels(robotBuffer: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(robotBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0) { // alpha > 0
      data[i] = 255;     // R
      data[i + 1] = 255; // G
      data[i + 2] = 255; // B
    }
  }

  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
}

/**
 * Composite robot image onto radial gradient background
 */
async function compositeRobotOnGradient(
  robotBuffer: Buffer,
  colors: [string, string, string]
): Promise<Buffer> {
  const [dominant, accent1] = colors;
  const size = 1024;

  // Create the radial gradient background (dominant dark center → accent1 light edge)
  const gradientBuffer = await createRadialGradientBackground(size, dominant, accent1);

  // Force robot pixels to pure white (GPT-image-1.5 sometimes adds color)
  const whiteRobotBuffer = await forceWhitePixels(robotBuffer);

  // Composite the robot (with transparency) on top of the gradient
  const composited = await sharp(gradientBuffer)
    .composite([
      {
        input: whiteRobotBuffer,
        blend: 'over',
      },
    ])
    .jpeg({ quality: 90 })
    .toBuffer();

  return composited;
}

/**
 * Generates an AI profile image for a user using OpenAI.
 * Creates robot on transparent background, then composites onto our radial gradient.
 * Throws on failure — caller handles fallback (initials are already saved upfront).
 */
async function generateAIProfileImage(profile: UserProfile): Promise<Buffer> {
  const profileName = getFieldValue(profile.contactEntries, 'name') || 'User';
  console.log(`[API/PROFILE-IMAGE] Starting AI image generation for: ${profileName}`);

  // Generate profile colors
  const colors = generateProfileColors(profileName);
  const [, , accent2] = colors;

  // Generate AI prompt asking for transparent background with robot in accent2
  const prompt = generateProfileImagePrompt(profileName, accent2);
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
  const imageDataResult = response.data[0];

  // We should always get base64 data with our request format
  if (imageDataResult?.b64_json) {
    console.log('[API/PROFILE-IMAGE] Converting base64 image data to buffer');
    const robotBuffer = base64ToBuffer(imageDataResult.b64_json);

    // Composite the robot onto our radial gradient background
    console.log('[API/PROFILE-IMAGE] Compositing robot onto radial gradient background');
    const compositedBuffer = await compositeRobotOnGradient(robotBuffer, colors);

    return compositedBuffer;
  }

  throw new Error('No base64 image data found in the response');
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Parse request body, handling empty or malformed JSON
    let imageData: string | undefined;
    try {
      const body = await req.json();
      imageData = body.imageData;
    } catch {
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
          const { storage } = await import('@/server/config/firebase').then(m => m.getFirebaseAdmin());
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

      // --- Frontload initials: save immediately so profile is never stuck with Google image ---
      const profileName = getFieldValue(profile.contactEntries, 'name') || 'User';
      const profileColors = generateProfileColors(profileName);
      // Radial gradient: dominant (dark center) → accent1 (light edge)
      // Text color: white for consistency with Avatar component fallback
      const initialsDataUrl = generateInitialsAvatar(profileName, 1024, [profileColors[0], profileColors[1]], '#FFFFFF');
      const initialsBuffer = dataUrlToBuffer(initialsDataUrl);
      console.log('[API/PROFILE-IMAGE] Uploading initials avatar immediately');
      const initialsUrl = await uploadImageBuffer(initialsBuffer, userId, 'profile');
      const initialsCacheBustedUrl = `${initialsUrl}?t=${Date.now()}`;

      // Save initials to Firestore right away
      await AdminProfileService.updateProfile(userId, {
        profileImage: initialsCacheBustedUrl,
        backgroundColors: profileColors,
        aiGeneration: {
          bioGenerated: profile.aiGeneration?.bioGenerated || false,
          avatarGenerated: true,
          backgroundImageGenerated: profile.aiGeneration?.backgroundImageGenerated || false
        }
      });
      console.log('[API/PROFILE-IMAGE] Initials avatar saved to Firestore immediately', { userId, imageUrl: initialsCacheBustedUrl });

      // Now attempt AI generation to upgrade the initials
      try {
        const aiBuffer = await generateAIProfileImage(profile);
        console.log('[API/PROFILE-IMAGE] AI generation succeeded, uploading to overwrite initials');
        newImageUrl = await uploadImageBuffer(aiBuffer, userId, 'profile');
      } catch (aiError) {
        console.log('[API/PROFILE-IMAGE] AI generation failed, keeping initials avatar:', aiError);
        // Already saved initials above, use that URL
        newImageUrl = initialsUrl;
      }
    }

    // Get current profile to update AI generation flags correctly
    const currentProfile = await AdminProfileService.getProfile(userId);

    // Add cache-busting timestamp to the URL without changing the filename
    const cacheBustedUrl = `${newImageUrl}?t=${Date.now()}`;

    // Extract background colors for user-uploaded images, or set default green for AI-generated
    let backgroundColors: string[] | undefined;
    if (imageData) {
      console.log('[API/PROFILE-IMAGE] Extracting background colors from user-uploaded image');
      try {
        // Fetch the image to extract colors
        const imageResponse = await fetch(cacheBustedUrl);
        if (imageResponse.ok) {
          const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
          const palette = await getColorPalette(imageBuffer, 5);
          console.log('[API/PROFILE-IMAGE] Generated color palette:', palette);

          // Filter chromatic colors and pick dominant + accents
          const chromaticPalette = filterChromaticColors(palette);
          console.log('[API/PROFILE-IMAGE] Filtered to chromatic colors:', chromaticPalette);

          const dominantColor = chromaticPalette[0];
          const accentColors = pickAccentColors(chromaticPalette.slice(1));
          backgroundColors = [dominantColor, ...accentColors];

          console.log('[API/PROFILE-IMAGE] Extracted background colors:', backgroundColors);
        }
      } catch (error) {
        console.error('[API/PROFILE-IMAGE] Error extracting background colors:', error);
        // Don't fail the whole request if color extraction fails
      }
    } else {
      // AI-generated image - use name-seeded colors (already saved during initials frontloading)
      const profileName = getFieldValue(currentProfile?.contactEntries || [], 'name') || 'User';
      backgroundColors = generateProfileColors(profileName);
      console.log('[API/PROFILE-IMAGE] Using generated profile colors for AI image:', backgroundColors);
    }

    // Save the cache-busted URL and colors to the profile
    const updateData: Partial<UserProfile> = {
      profileImage: cacheBustedUrl,
      aiGeneration: {
        bioGenerated: currentProfile?.aiGeneration?.bioGenerated || false,
        avatarGenerated: !imageData, // Only mark as AI-generated if no user upload
        backgroundImageGenerated: currentProfile?.aiGeneration?.backgroundImageGenerated || false
      }
    };

    // Include background colors if extracted
    if (backgroundColors) {
      updateData.backgroundColors = backgroundColors;
    }

    await AdminProfileService.updateProfile(userId, updateData);
    // Log profile image generation complete and saved to Firestore with response
    console.log('[API/PROFILE-IMAGE] Profile image complete & saved to Firestore', { userId, imageUrl: cacheBustedUrl, backgroundColors });

    return NextResponse.json({ imageUrl: cacheBustedUrl, backgroundColors });

  } catch (error) {
    console.error(`[API/PROFILE-IMAGE] Error processing profile image for user ${userId}:`, error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return NextResponse.json({ error: 'Failed to process profile image.', details: message }, { status: 500 });
  }
}
