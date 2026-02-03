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

    // If code is 8 chars, treat as shortCode; otherwise treat as userId.
    // The userId fallback path is deprecated — all profiles now have shortCodes
    // after migration. This branch can be removed once migration is verified.
    if (code.length === 8) {
      userId = await AdminProfileService.getUserIdByShortCode(code);
    } else {
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
