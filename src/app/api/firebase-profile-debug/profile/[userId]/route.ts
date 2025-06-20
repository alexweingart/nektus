/**
 * Debug endpoint to check if a profile exists in Firebase
 * GET /api/debug/profile/[userId]
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProfile } from '@/lib/firebase/adminConfig';
import { getFirebaseAdmin } from '@/lib/firebase/adminConfig';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
): Promise<NextResponse> {
  try {
    const { userId } = await context.params;
    
    console.log(`🔍 DEBUG: Checking profile for: ${userId}`);
    
    const profile = await getProfile(userId);
    
    // Also check contacts count
    let contactsCount = 0;
    let contactsError = null;
    
    try {
      const { db } = await getFirebaseAdmin();
      const contactsRef = db.collection('profiles').doc(userId).collection('contacts');
      const contactsSnapshot = await contactsRef.get();
      contactsCount = contactsSnapshot.size;
      console.log(`📊 DEBUG: User ${userId} has ${contactsCount} contacts`);
    } catch (error) {
      contactsError = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`⚠️ DEBUG: Could not check contacts for ${userId}:`, error);
    }
    
    if (profile) {
      console.log(`✅ DEBUG: Profile found for ${userId}:`, profile);
      return NextResponse.json({
        exists: true,
        profile: profile,
        contactsCount: contactsCount,
        contactsError: contactsError,
        message: `Profile found for ${userId}`,
        debug: {
          profileId: userId,
          hasProfile: true,
          contactsCount: contactsCount,
          contactsDebugUrl: `/api/firebase-profile-debug/contacts/${userId}`
        }
      });
    } else {
      console.log(`❌ DEBUG: No profile found for ${userId}`);
      return NextResponse.json({
        exists: false,
        profile: null,
        contactsCount: contactsCount,
        contactsError: contactsError,
        message: `No profile found for ${userId}`,
        debug: {
          profileId: userId,
          hasProfile: false,
          contactsCount: contactsCount,
          contactsDebugUrl: `/api/firebase-profile-debug/contacts/${userId}`
        }
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
