import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/options';
import { deleteUserProfile, getFirebaseAdmin } from '@/server/config/firebase';
import { cleanupUserStorage } from '@/client/profile/firebase-storage';

/**
 * Get user ID from either NextAuth session or Firebase ID token
 * This allows both web (NextAuth) and mobile (Firebase) clients to delete accounts
 */
async function getUserId(req: NextRequest): Promise<string | null> {
  // First try NextAuth session (web clients)
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    console.log('[DELETE-ACCOUNT] Authenticated via NextAuth session');
    return session.user.id;
  }

  // Fall back to Firebase ID token (mobile clients)
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const idToken = authHeader.replace('Bearer ', '');
      const { auth } = await getFirebaseAdmin();
      const decodedToken = await auth.verifyIdToken(idToken);
      if (decodedToken.uid) {
        console.log('[DELETE-ACCOUNT] Authenticated via Firebase ID token');
        return decodedToken.uid;
      }
    } catch (error) {
      console.error('[DELETE-ACCOUNT] Failed to verify Firebase ID token:', error);
    }
  }

  return null;
}

/**
 * API route to handle account deletion
 * Supports both NextAuth session (web) and Firebase ID token (mobile)
 */
export async function POST(req: NextRequest) {
  console.log('[DELETE-ACCOUNT] API called');

  try {
    // Get user ID from session or Firebase token
    const userId = await getUserId(req);
    if (!userId) {
      console.error('[DELETE-ACCOUNT] No authenticated session found');
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    console.log(`[DELETE-ACCOUNT] Starting deletion for user: ${userId}`);

    try {
      // First, revoke all OAuth tokens before deleting the profile
      // This ensures Google/Microsoft know the app no longer has permission
      try {
        const { AdminProfileService } = await import('@/server/profile/firebase-admin');
        const profile = await AdminProfileService.getProfile(userId);

        if (profile?.calendars && profile.calendars.length > 0) {
          console.log(`[DELETE-ACCOUNT] Revoking ${profile.calendars.length} calendar OAuth tokens`);

          // Revoke all Google calendar tokens
          const revokePromises = profile.calendars.map(async (calendar) => {
            if (calendar.accessToken && calendar.provider === 'google') {
              try {
                await fetch(`https://oauth2.googleapis.com/revoke?token=${calendar.accessToken}`, {
                  method: 'POST',
                });
                console.log(`[DELETE-ACCOUNT] Revoked Google OAuth token for ${calendar.id}`);
              } catch (revokeError) {
                console.warn(`[DELETE-ACCOUNT] Failed to revoke Google token for ${calendar.id}:`, revokeError);
              }
            }
            // Note: Microsoft doesn't provide a simple revoke endpoint
            // Users need to revoke via account.live.com/consent/Manage
          });

          await Promise.allSettled(revokePromises);
          console.log(`[DELETE-ACCOUNT] Completed OAuth token revocation`);
        }
      } catch (revokeError) {
        console.warn('[DELETE-ACCOUNT] Token revocation failed, but continuing with deletion:', revokeError);
        // Don't fail deletion if token revocation fails
      }

      // Revoke Google Sign-In access token from NextAuth session (if present)
      // This covers web-created Google accounts being deleted from any client
      try {
        const session = await getServerSession(authOptions);
        if (session?.accessToken) {
          console.log('[DELETE-ACCOUNT] Revoking Google Sign-In access token from session');
          await fetch(`https://oauth2.googleapis.com/revoke?token=${session.accessToken}`, {
            method: 'POST',
          });
          console.log('[DELETE-ACCOUNT] Revoked Google Sign-In access token');
        }
      } catch (revokeError) {
        console.warn('[DELETE-ACCOUNT] Google Sign-In token revocation failed (non-fatal):', revokeError);
      }

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
