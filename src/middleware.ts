import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

console.log('✅ MIDDLEWARE FILE LOADED - Full Version');

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
  console.log('✅ MIDDLEWARE EXECUTING:', request.nextUrl.pathname);
  
  const { pathname } = request.nextUrl;

  // Debug: Always log for setup path
  if (pathname === '/setup') {
    console.log('🔍 MIDDLEWARE: Processing /setup path specifically');
  }

  // Skip middleware for public paths and static files
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path)) || 
      pathname.includes('.') || 
      pathname === '/favicon.ico' ||
      pathname.startsWith('/_next')) {
    console.log('Skipping middleware for public path:', pathname);
    return NextResponse.next();
  }

  // Get the JWT token to check authentication and profile
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  
  console.log('Token exists:', !!token);
  console.log('Token profile:', token?.profile);

  // If no token (unauthenticated user)
  if (!token) {
    // Allow access to home page for authentication
    if (pathname === '/') {
      console.log('Allowing unauthenticated user to access home page for auth');
      return NextResponse.next();
    }
    // For other protected routes, redirect to home for authentication
    console.log('Redirecting unauthenticated user to home for auth:', pathname);
    return NextResponse.redirect(new URL('/', request.url));
  }

  // For authenticated users
  if (token) {
    // If on root path, check if profile is complete
    if (pathname === '/') {
      try {
        const hasPhone = token.profile?.contactChannels?.phoneInfo?.internationalPhone &&
                        token.profile.contactChannels.phoneInfo.internationalPhone.trim() !== '';
        
        if (hasPhone) {
          console.log('User has complete profile, allowing access to root');
          return NextResponse.next();
        } else {
          console.log('User missing phone number, redirecting to setup');
          return NextResponse.redirect(new URL('/setup', request.url));
        }
      } catch (e) {
        console.error('Error checking profile:', e);
        return NextResponse.redirect(new URL('/setup', request.url));
      }
    }
    
    // If on setup page but already has profile, redirect to home
    if (pathname === '/setup') {
      try {
        const hasPhone = token.profile?.contactChannels?.phoneInfo?.internationalPhone &&
                        token.profile.contactChannels.phoneInfo.internationalPhone.trim() !== '';
        
        if (hasPhone) {
          console.log('User has complete profile, redirecting from setup to home');
          return NextResponse.redirect(new URL('/', request.url));
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
    '/',
    '/setup',
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
