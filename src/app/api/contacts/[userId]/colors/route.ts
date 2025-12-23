/**
 * API endpoint to extract and save background colors for a saved contact
 * POST: Extract colors from contact's profile image and update saved contact
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { getFirebaseAdmin } from '@/lib/firebase/adminConfig';
import { getColorPalette, pickAccentColors, filterChromaticColors } from '@/lib/services/server/colorService';

/**
 * Extract background colors from image buffer
 */
async function extractBackgroundColors(imageBuffer: Buffer): Promise<string[]> {
  const palette = await getColorPalette(imageBuffer, 5);
  const chromaticPalette = filterChromaticColors(palette);

  if (chromaticPalette.length === 0) {
    throw new Error('No chromatic colors extracted from image');
  }

  const dominantColor = chromaticPalette[0];
  const accentColors = pickAccentColors(chromaticPalette.slice(1));

  return [dominantColor, ...accentColors];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { userId: contactId } = await params;

    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'Contact ID required' },
        { status: 400 }
      );
    }

    const { db } = await getFirebaseAdmin();

    // Get the saved contact
    const contactRef = db.collection('profiles').doc(session.user.id).collection('contacts').doc(contactId);
    const contactDoc = await contactRef.get();

    if (!contactDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 }
      );
    }

    const contact = contactDoc.data();
    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact data not found' },
        { status: 404 }
      );
    }

    // Check if already has colors
    if (contact.backgroundColors?.length >= 3) {
      return NextResponse.json({
        success: true,
        backgroundColors: contact.backgroundColors,
        cached: true
      });
    }

    // Skip AI-generated avatars - they should keep default green theme
    if (contact?.aiGeneration?.avatarGenerated) {
      return NextResponse.json({
        success: false,
        error: 'AI-generated avatars use default theme',
        skipReason: 'ai-generated'
      });
    }

    // Get profile image URL
    const profileImage = contact?.profileImage;
    if (!profileImage) {
      return NextResponse.json(
        { success: false, error: 'Contact has no profile image' },
        { status: 400 }
      );
    }

    // Fetch image and extract colors
    const imageResponse = await fetch(profileImage);
    if (!imageResponse.ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch profile image' },
        { status: 400 }
      );
    }
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const backgroundColors = await extractBackgroundColors(imageBuffer);

    // Update the saved contact with colors
    await contactRef.update({ backgroundColors });

    return NextResponse.json({
      success: true,
      backgroundColors,
      cached: false
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to extract colors' },
      { status: 500 }
    );
  }
}
