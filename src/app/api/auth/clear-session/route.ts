import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    
    // Clear NextAuth session cookies
    const sessionCookies = [
      'next-auth.session-token',
      'next-auth.csrf-token',
      'next-auth.callback-url',
      '__Secure-next-auth.session-token',
      '__Host-next-auth.csrf-token'
    ];
    
    const response = NextResponse.json({ 
      success: true, 
      message: 'Session cookies cleared' 
    });
    
    // Clear all potential session cookies
    sessionCookies.forEach(cookieName => {
      response.cookies.set(cookieName, '', {
        expires: new Date(0),
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax'
      });
    });
    

    
    return response;
  } catch (error) {
    console.error('[ClearSession] Failed to clear session cookies:', error);
    return NextResponse.json({ error: 'Failed to clear session' }, { status: 500 });
  }
} 