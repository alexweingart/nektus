import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { getFirebaseAdmin } from '@/lib/firebase/adminConfig';

/**
 * Generate Firebase custom token for authenticated NextAuth users
 * POST /api/auth/firebase-token
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get the current NextAuth session
    const session = await getAuthSession();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated with NextAuth' },
        { status: 401 }
      );
    }

    console.log('🔥 Generating Firebase custom token for user:', session.user.id);

    // Get Firebase Admin
    const { auth } = await getFirebaseAdmin();
    
    // Create or get Firebase Auth user
    let firebaseUser;
    try {
      firebaseUser = await auth.getUser(session.user.id);
      console.log('🔥 Firebase Auth user already exists');
    } catch (userError: any) {
      if (userError.code === 'auth/user-not-found') {
        console.log('🔥 Creating new Firebase Auth user');
        firebaseUser = await auth.createUser({
          uid: session.user.id,
          email: session.user.email || undefined,
          displayName: session.user.name || undefined,
          photoURL: session.user.image || undefined,
        });
        console.log('🔥 Firebase Auth user created successfully');
      } else {
        throw userError;
      }
    }
    
    // Generate custom token
    const customToken = await auth.createCustomToken(session.user.id);
    console.log('🔥 Firebase custom token generated successfully');
    
    return NextResponse.json({ customToken });
    
  } catch (error) {
    console.error('❌ Error generating Firebase custom token:', error);
    return NextResponse.json(
      { error: 'Failed to generate Firebase token' },
      { status: 500 }
    );
  }
}
