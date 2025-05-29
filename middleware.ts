import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/',
  '/setup',
  '/api/auth/signin',
  '/api/auth/signin/google',
  '/api/auth/error',
  '/api/auth/csrf',
  '/api/auth/session',
  '/api/auth/callback/google',
  '/api/auth/_log',
  '/_next',
  '/favicon.ico'
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Check for both development and production session tokens
  const sessionToken = 
    request.cookies.get('__Secure-next-auth.session-token')?.value ||
    request.cookies.get('next-auth.session-token')?.value;

  // Skip middleware for public paths and static files
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path)) || 
      pathname.includes('.') || 
      pathname === '/favicon.ico' ||
      pathname.startsWith('/_next')) {
    return NextResponse.next();
  }

  // If no session token, allow access to public paths only
  if (!sessionToken) {
    const isPublicPath = PUBLIC_PATHS.some(path => 
      pathname === path || pathname.startsWith(path + '/') || 
      pathname === '/api/auth/signin/google' ||
      pathname.startsWith('/_next')
    );
    
    if (!isPublicPath) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // For authenticated users
  if (sessionToken) {
    // If on root path, check if profile is complete
    if (pathname === '/') {
      const profileStr = request.cookies.get('nektus_profile_cache');
      
      try {
        if (profileStr) {
          const profile = JSON.parse(profileStr.value);
          // If profile has phone number, allow access to root
          if (profile?.contactChannels?.phoneInfo?.internationalPhone) {
            return NextResponse.next();
          }
        }
        // If no phone number, redirect to setup
        return NextResponse.redirect(new URL('/setup', request.url));
      } catch (e) {
        console.error('Error checking profile:', e);
        return NextResponse.redirect(new URL('/setup', request.url));
      }
    }
    
    // If on setup page but already has profile, redirect to home
    if (pathname === '/setup') {
      const profileStr = request.cookies.get('nektus_profile_cache');
      try {
        if (profileStr) {
          const profile = JSON.parse(profileStr.value);
          if (profile?.contactChannels?.phoneInfo?.internationalPhone) {
            return NextResponse.redirect(new URL('/', request.url));
          }
        }
      } catch (e) {
        console.error('Error checking profile:', e);
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\..*).*)',
  ],
  // Required for handling OAuth callbacks
  unstable_allowDynamic: [
    '/node_modules/next-auth/core/lib/security/csrf-token-handler.js',
    '/node_modules/next-auth/core/lib/security/nonce.js',
    '/node_modules/next-auth/core/lib/security/pkce.js',
    '/node_modules/next-auth/core/lib/security/csrf.js',
  ],
};
