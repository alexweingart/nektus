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

  // For authenticated users - handle server-side redirects based on phone number presence
  if (token) {
    const redirectTo = token.redirectTo as string;

    // Only redirect to setup if user needs setup and isn't already there
    if (redirectTo === '/setup' && pathname !== '/setup') {
      console.log('[Middleware] Redirecting user to setup from:', pathname);
      return NextResponse.redirect(new URL('/setup', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/setup',
    '/edit',
    '/history',
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
