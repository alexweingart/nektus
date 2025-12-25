import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { AdminProfileService } from '@/lib/server/profile/firebase-admin';
import { getColorPalette, pickAccentColors, filterChromaticColors } from '@/lib/server/profile/colors';
import { uploadImageBuffer } from '@/lib/config/firebase/admin';
import { NextRequest } from 'next/server';

/**
 * Extracts colors from the user's profile image for ParticleNetwork backgrounds
 * Returns [dominantColor, accent1, accent2] array
 */
async function extractBackgroundColors(profileImage: string, palette: string[]): Promise<string[]> {
  console.log(`[API/BACKGROUND] Starting color extraction from profile image`);

  try {
    /**
     * Filter out achromatic colors (black, grey, white) to ensure vibrant backgrounds.
     * Treat the first chromatic palette entry as the dominant "hero" colour and allow up to two accents.
     */
    const chromaticPalette = filterChromaticColors(palette);
    console.log(`[API/BACKGROUND] Filtered palette from ${palette.length} to ${chromaticPalette.length} chromatic colors`);

    const dominantColor = chromaticPalette[0];
    const accentColors = pickAccentColors(chromaticPalette.slice(1)); // choose 2 colourful accents

    // Return array: [dominant, accent1, accent2]
    // Will use for ParticleNetwork: gradientStart=accent1, gradientEnd=dominant, particle=accent2
    const backgroundColors = [dominantColor, ...accentColors];

    console.log(`[API/BACKGROUND] Extracted colors:`, {
      dominant: dominantColor,
      accents: accentColors,
      backgroundColors
    });

    return backgroundColors;
  } catch (error) {
    console.error('[API/BACKGROUND] Color extraction failed:', error);
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
    const { imageData } = await req.json();

    // Case 1: User uploaded a custom background image
    if (imageData) {
      console.log(`[API/BACKGROUND] Uploading custom background image for user ${userId}`);

      // Convert base64 to buffer
      const imageBuffer = Buffer.from(imageData.replace(/^data:image\/[a-z]+;base64,/, ''), 'base64');

      // Upload to Firebase Storage
      const uploadTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Firebase upload timeout after 20 seconds')), 20000)
      );

      const uploadPromise = uploadImageBuffer(imageBuffer, userId, 'background');
      console.log('[API/BACKGROUND] Waiting for Firebase upload...');
      const permanentImageUrl = await Promise.race([uploadPromise, uploadTimeoutPromise]) as string;

      // Update profile with custom background
      console.log('[API/BACKGROUND] Updating profile in Firestore...');
      const firestoreTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Firestore update timeout after 10 seconds')), 10000)
      );

      const profile = await AdminProfileService.getProfile(userId);
      const updatePromise = AdminProfileService.updateProfile(userId, {
        backgroundImage: permanentImageUrl,
        aiGeneration: {
          bioGenerated: profile?.aiGeneration?.bioGenerated || false,
          avatarGenerated: profile?.aiGeneration?.avatarGenerated || false,
          backgroundImageGenerated: false // Mark as user-uploaded, not AI-generated
        }
      });

      await Promise.race([updatePromise, firestoreTimeoutPromise]);

      console.log('[API/BACKGROUND] Custom background uploaded & saved to Firestore', { userId, imageUrl: permanentImageUrl });

      return NextResponse.json({ imageUrl: permanentImageUrl });
    }

    // Case 2: Extract colors from profile image for ParticleNetwork backgrounds
    const profile = await AdminProfileService.getProfile(userId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    if (!profile.profileImage) {
      return NextResponse.json({ error: 'Profile image is required to extract background colors' }, { status: 400 });
    }

    console.log('[API/BACKGROUND] Color extraction starts', {
      userId,
      profileImage: profile.profileImage
    });

    // Get color palette from profile image
    const imageResponse = await fetch(profile.profileImage);
    if (!imageResponse.ok) {
      throw new Error('Failed to download profile image for color analysis');
    }
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const palette = await getColorPalette(imageBuffer, 5);
    console.log('[API/BACKGROUND] Generated color palette:', palette);

    // Extract background colors (dominant + accents)
    const backgroundColors = await extractBackgroundColors(profile.profileImage, palette);

    // Save colors to profile
    console.log('[API/BACKGROUND] Updating profile with background colors...');
    const firestoreTimeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Firestore update timeout after 10 seconds')), 10000)
    );

    const updatePromise = AdminProfileService.updateProfile(userId, {
      backgroundColors,
      aiGeneration: {
        bioGenerated: profile.aiGeneration?.bioGenerated || false,
        avatarGenerated: profile.aiGeneration?.avatarGenerated || false,
        backgroundImageGenerated: false // No image generated, just colors extracted
      }
    });

    await Promise.race([updatePromise, firestoreTimeoutPromise]);

    console.log('[API/BACKGROUND] Color extraction complete & saved to Firestore', { userId, backgroundColors });

    // Return the extracted colors
    return NextResponse.json({ backgroundColors });

  } catch (error) {
    console.error(`[API/BACKGROUND] Error processing background for user ${userId}:`, error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return NextResponse.json({ error: 'Failed to process background.', details: message }, { status: 500 });
  }
}