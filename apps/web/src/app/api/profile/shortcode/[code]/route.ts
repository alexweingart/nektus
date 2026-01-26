import { NextRequest, NextResponse } from 'next/server';
import { AdminProfileService } from '@/server/profile/firebase-admin';

/**
 * GET /api/profile/shortcode/[code]
 * Fetch a profile by shortCode (8 chars) or userId (longer)
 * Supports both formats for backwards compatibility during migration
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Missing code parameter' },
        { status: 400 }
      );
    }

    let userId: string | null = null;

    // If code is 8 chars, treat as shortCode; otherwise treat as userId
    if (code.length === 8) {
      // Look up userId from shortCode
      userId = await AdminProfileService.getUserIdByShortCode(code);
    } else {
      // Treat as userId directly
      userId = code;
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Fetch the profile
    const profile = await AdminProfileService.getProfile(userId);

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Ensure profile has a shortCode (lazy migration for older accounts)
    if (!profile.shortCode) {
      try {
        const newShortCode = await AdminProfileService.ensureShortCode(userId);
        profile.shortCode = newShortCode;
        console.log(`📌 Generated shortCode ${newShortCode} for user ${userId} on profile fetch`);
      } catch (shortCodeError) {
        console.warn(`⚠️ Failed to generate shortCode for user ${userId}:`, shortCodeError);
        // Continue without shortCode - profile is still valid
      }
    }

    // Return the profile
    return NextResponse.json({
      success: true,
      profile
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
