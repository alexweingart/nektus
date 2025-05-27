import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const sessionToken = request.cookies.get('next-auth.session-token') || 
                     request.cookies.get('__Secure-next-auth.session-token');
  
  // If no session token, no need to check anything
  if (!sessionToken) {
    return NextResponse.next();
  }
  
  const path = request.nextUrl.pathname;
  
  // Don't run middleware for these paths
  if (path.startsWith('/_next') || 
      path.includes('.') || 
      path.startsWith('/api') ||
      path === '/setup') {
    return NextResponse.next();
  }
  
  // Check for profile in cookies (we'll set this after successful setup)
  const hasProfile = request.cookies.get('nektus_has_profile');
  
  // If on root path and no profile, redirect to setup
  if (path === '/' && !hasProfile) {
    const profileStr = request.cookies.get('nektus_profile_cache');
    
    try {
      if (profileStr) {
        const profile = JSON.parse(profileStr.value);
        // If profile has phone number, set the has_profile cookie
        if (profile?.contactChannels?.phoneInfo?.internationalPhone) {
          const response = NextResponse.next();
          response.cookies.set('nektus_has_profile', 'true', { path: '/' });
          return response;
        }
      }
      
      // If we get here, redirect to setup
      const setupUrl = new URL('/setup', request.url);
      return NextResponse.redirect(setupUrl);
      
    } catch (e) {
      console.error('Error checking profile in middleware:', e);
      const setupUrl = new URL('/setup', request.url);
      return NextResponse.redirect(setupUrl);
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/:path*',
};
