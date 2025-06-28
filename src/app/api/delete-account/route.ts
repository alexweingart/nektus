import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/options';
import { deleteUserProfile } from '@/lib/firebase/adminConfig';
import { cleanupUserStorage } from '@/lib/firebase/storage';

/**
 * API route to handle account deletion
 */
export async function POST(_req: NextRequest) {
  console.log('[DELETE-ACCOUNT] API called');
  
  try {
    // Get the session to verify the user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.error('[DELETE-ACCOUNT] No authenticated session found');
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    console.log(`[DELETE-ACCOUNT] Starting deletion for user: ${userId}`);

    try {
      // Delete the user's profile using the admin SDK
      console.log(`[DELETE-ACCOUNT] Deleting profile for user: ${userId}`);
      await deleteUserProfile(userId);
      console.log(`[DELETE-ACCOUNT] Successfully deleted profile for user: ${userId}`)
      
      // Clean up storage files (don't block deletion if this fails)
      console.log(`[DELETE-ACCOUNT] Cleaning up storage files for user: ${userId}`);
      try {
        await cleanupUserStorage(userId);
        console.log(`[DELETE-ACCOUNT] Successfully cleaned up storage for user: ${userId}`);
      } catch (storageError) {
        console.error('[DELETE-ACCOUNT] Storage cleanup failed, but continuing:', storageError);
        // Don't fail the deletion if storage cleanup fails
      }
      
    } catch (firebaseError) {
      console.error('[DELETE-ACCOUNT] Error deleting profile:', firebaseError);
      // Return error if profile deletion fails
      return NextResponse.json(
        { 
          error: 'Failed to delete profile from Firebase',
          details: firebaseError instanceof Error ? firebaseError.message : 'Unknown Firebase error'
        },
        { status: 500 }
      );
    }

    // Clear session data by setting invalidation flag
    // This tells the client that the session should be cleared immediately
    const response = NextResponse.json(
      { 
        success: true, 
        message: 'Account deleted successfully',
        sessionInvalidated: true // Flag to indicate session should be cleared
      },
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );

    // Clear NextAuth session cookies to invalidate the session
    response.cookies.set('next-auth.session-token', '', {
      expires: new Date(0),
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    response.cookies.set('__Secure-next-auth.session-token', '', {
      expires: new Date(0),
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax'
    });

    return response;

  } catch (error) {
    console.error('[DELETE-ACCOUNT] Error in delete account handler:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete account',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
