/**
 * Unified authentication helper for API routes
 * Supports both NextAuth sessions (web) and Firebase Bearer tokens (mobile)
 */

import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { getFirebaseAdmin } from '@/server/config/firebase';

export interface AuthenticatedUser {
  id: string;
  source: 'nextauth' | 'firebase';
}

/**
 * Get the authenticated user from either NextAuth session or Firebase Bearer token
 *
 * @param request - The NextRequest object (optional, only needed for Firebase auth)
 * @returns The authenticated user or null if not authenticated
 */
export async function getAuthenticatedUser(request?: NextRequest): Promise<AuthenticatedUser | null> {
  // First, try NextAuth session (works for web clients with cookies)
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      return {
        id: session.user.id,
        source: 'nextauth'
      };
    }
  } catch (error) {
    console.warn('[Auth] NextAuth session check failed:', error);
  }

  // If no NextAuth session and we have a request, try Firebase Bearer token
  if (request) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      try {
        const { auth } = await getFirebaseAdmin();
        const decodedToken = await auth.verifyIdToken(token);

        if (decodedToken.uid) {
          console.log('[Auth] Firebase token verified for user:', decodedToken.uid);
          return {
            id: decodedToken.uid,
            source: 'firebase'
          };
        }
      } catch (error) {
        console.warn('[Auth] Firebase token verification failed:', error);
      }
    }
  }

  return null;
}
