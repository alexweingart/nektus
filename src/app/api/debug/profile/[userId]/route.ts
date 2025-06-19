/**
 * Debug endpoint to check if a profile exists in Firebase
 * GET /api/debug/profile/[userId]
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProfile } from '@/lib/firebase/adminConfig';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
): Promise<NextResponse> {
  try {
    const { userId } = await context.params;
    
    console.log(`🔍 DEBUG: Checking profile for: ${userId}`);
    
    const profile = await getProfile(userId);
    
    if (profile) {
      console.log(`✅ DEBUG: Profile found for ${userId}:`, profile);
      return NextResponse.json({
        exists: true,
        profile: profile,
        message: `Profile found for ${userId}`
      });
    } else {
      console.log(`❌ DEBUG: No profile found for ${userId}`);
      return NextResponse.json({
        exists: false,
        profile: null,
        message: `No profile found for ${userId}`
      });
    }
    
  } catch (error) {
    console.error(`❌ DEBUG: Error checking profile:`, error);
    return NextResponse.json({
      exists: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Error checking profile'
    }, { status: 500 });
  }
}
