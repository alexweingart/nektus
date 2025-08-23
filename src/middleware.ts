import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const PUBLIC_PATHS = [
  '/api/auth/signin',
  '/api/auth/signin/google',
  '/api/auth/error',
  '/api/auth/csrf',
  '/api/auth/session',
  '/api/auth/callback/google',
  '/api/auth/_log',
  '/_next',
  '/favicon.ico',
  '/privacy',
  '/terms'
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for public paths and static files
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path)) || 
      pathname.includes('.') || 
      pathname === '/favicon.ico' ||
      pathname.startsWith('/_next')) {
    return NextResponse.next();
  }

  // Get the JWT token to check authentication and profile
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  // If no token (unauthenticated user)
  if (!token) {
    // Allow access to home page for authentication
    if (pathname === '/') {
      return NextResponse.next();
    }
    // For other protected routes, redirect to home for authentication
    return NextResponse.redirect(new URL('/', request.url));
  }

  // For authenticated users
  if (token) {
    // Removed automatic redirect from '/' to '/setup' when phone is missing.
    // The client-side application will now handle prompting the user to add their phone number if needed.

    // If on setup page but already has profile, redirect to home
    if (pathname === '/setup') {
      try {
        const phoneEntry = token.profile?.contactChannels?.entries?.find((e: { platform?: string; internationalPhone?: string }) => e.platform === 'phone');
        const hasPhone = phoneEntry?.internationalPhone && phoneEntry.internationalPhone.trim() !== '';
        
        if (hasPhone) {
          return NextResponse.redirect(new URL('/', request.url));
        } 
      } catch {
        // Continue to setup page on error
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/setup',
    '/history',
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
