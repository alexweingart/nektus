import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { createCustomTokenWithCorrectSub } from '@/lib/firebase/adminConfig';

export async function POST(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Create a new Firebase custom token
    const newFirebaseToken = await createCustomTokenWithCorrectSub(session.user.id);
    
    return NextResponse.json({ 
      success: true, 
      firebaseToken: newFirebaseToken,
      message: 'Firebase token refreshed successfully'
    });
  } catch (error) {
    console.error('[REFRESH] Error refreshing Firebase token:', error);
    return NextResponse.json({ 
      error: 'Failed to refresh Firebase token',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 