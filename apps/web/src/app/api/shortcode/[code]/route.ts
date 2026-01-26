import { NextRequest, NextResponse } from 'next/server';
import { AdminProfileService } from '@/server/profile/firebase-admin';

/**
 * GET /api/shortcode/[code]
 * Look up a userId by shortCode
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    if (!code || code.length !== 8) {
      return NextResponse.json(
        { error: 'Invalid shortCode format' },
        { status: 400 }
      );
    }

    const userId = await AdminProfileService.getUserIdByShortCode(code);

    if (!userId) {
      return NextResponse.json(
        { error: 'ShortCode not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ userId });
  } catch (error) {
    console.error('Error looking up shortCode:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
