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
  '/about',
  '/privacy',
  '/terms',
  '/connect',  // Allow unauthenticated access for QR code scanning
  '/api/exchange/preview'  // Preview endpoint for unauthenticated users
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for public paths and static files
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path)) ||
      pathname.includes('.') ||
      pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon')) {
    return NextResponse.next();
  }

  // Get the JWT token to check authentication and profile
  // Use secure cookies in production OR if running HTTPS in development
  const isSecure = process.env.NODE_ENV === 'production' || request.url.startsWith('https://');
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: isSecure
  });

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
  // Only enforce setup redirect on the root path to allow access to other routes
  if (token && token.redirectTo) {
    const redirectTo = token.redirectTo as string;

    // Only redirect to setup if user needs setup and is trying to access the root path
    if (redirectTo === '/setup' && pathname === '/') {
      return NextResponse.redirect(new URL('/setup', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - favicon.svg (favicon file)
     * - favicon.png (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon).*)',
  ],
};
