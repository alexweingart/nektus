/**
 * Debug endpoint to list all profiles in Firebase
 * GET /api/debug/profiles
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase/adminConfig';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    console.log(`🔍 DEBUG: Listing all profiles in Firebase`);
    
    const { db } = await getFirebaseAdmin();
    const profilesRef = db.collection('profiles');
    const snapshot = await profilesRef.get();
    
    const profiles: any[] = [];
    
    snapshot.forEach(doc => {
      profiles.push({
        id: doc.id,
        data: doc.data()
      });
    });
    
    console.log(`📋 DEBUG: Found ${profiles.length} profiles:`, profiles.map(p => p.id));
    
    return NextResponse.json({
      count: profiles.length,
      profileIds: profiles.map(p => p.id),
      profiles: profiles
    });
    
  } catch (error) {
    console.error(`❌ DEBUG: Error listing profiles:`, error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Error listing profiles'
    }, { status: 500 });
  }
}
