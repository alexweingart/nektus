import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/options';
import { cookies } from 'next/headers';

/**
 * API route to handle account deletion
 */
export async function POST(req: NextRequest) {
  console.log('DELETE ACCOUNT API CALLED - Environment:', process.env.NODE_ENV);
  
  try {
    // Explicitly log the request headers to check for auth tokens
    const requestHeaders = Object.fromEntries(req.headers);
    console.log('Request headers:', {
      ...requestHeaders,
      cookie: requestHeaders.cookie ? '[REDACTED]' : undefined,
      authorization: requestHeaders.authorization ? '[REDACTED]' : undefined
    });
    
    const session = await getServerSession(authOptions);
    console.log('Session found:', !!session, 'User found:', !!(session?.user));
    
    if (!session || !session.user) {
      console.error('Unauthorized: No valid session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.email;
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID not found' }, { status: 400 });
    }
    
    console.log('Processing account deletion for user:', userId);
    
    // Get auth cookies for logging purposes
    const cookieStore = cookies();
    const allCookies = cookieStore.getAll();
    
    // Find any auth-related cookies and log them
    const authCookies = allCookies.filter(cookie => 
      cookie.name.includes('next-auth') || 
      cookie.name.includes('session') || 
      cookie.name.includes('token')
    );
    
    console.log('Found auth cookies to be cleared client-side:', authCookies.map(c => c.name));
    
    // Set headers to prevent caching
    return NextResponse.json({ 
      success: true,
      message: 'Account deletion processed. Please clear client-side auth state.',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Error processing account deletion:', error);
    // More detailed error logging
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    return NextResponse.json({ 
      error: 'Failed to process account deletion', 
      errorDetails: error instanceof Error ? error.message : String(error),
      environment: process.env.NODE_ENV
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  }
}
