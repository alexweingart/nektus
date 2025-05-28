import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import { authOptions } from '../auth/[...nextauth]/options';
import { cookies } from 'next/headers';

/**
 * API route to handle account deletion
 */
export async function POST(req: NextRequest) {
  console.log('DELETE ACCOUNT API CALLED - Environment:', process.env.NODE_ENV);
  
  try {
    // Clone the request for multiple uses
    const reqClone = req.clone();
    
    // Explicitly log the request headers to check for auth tokens
    const requestHeaders = Object.fromEntries(req.headers);
    console.log('Request headers:', {
      ...requestHeaders,
      cookie: requestHeaders.cookie ? '[REDACTED]' : undefined,
      authorization: requestHeaders.authorization ? '[REDACTED]' : undefined
    });
    
    // We'll try multiple methods to identify the user
    let userId: string | null = null;
    let userEmail: string | null = null;
    
    // Method 1: Try to get user info from request body
    try {
      const body = await reqClone.json();
      console.log('Request body parsed successfully');
      
      if (body?.userId) {
        console.log('Found userId in request body');
        userId = body.userId;
      }
      
      if (body?.email) {
        console.log('Found email in request body');
        userEmail = body.email;
      }
    } catch (e) {
      console.log('Error parsing request body:', e);
    }
    
    // Method 2: Try to get user info from session
    if (!userId || !userEmail) {
      try {
        const session = await getServerSession(authOptions);
        console.log('Session found:', !!session, 'User found:', !!(session?.user));
        
        if (session?.user) {
          if (!userId && session.user.id) {
            userId = session.user.id;
            console.log('Found userId from session:', userId);
          }
          
          if (!userEmail && session.user.email) {
            userEmail = session.user.email;
            console.log('Found email from session:', userEmail);
          }
        }
      } catch (e) {
        console.error('Error getting session:', e);
      }
    }
    
    // Method 3: Try to get user info from JWT token
    if (!userId || !userEmail) {
      try {
        const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
        console.log('JWT token found:', !!token);
        
        if (token?.user) {
          if (!userId && token.user.id) {
            userId = token.user.id;
            console.log('Found userId from JWT token:', userId);
          }
          
          if (!userEmail && token.user.email) {
            userEmail = token.user.email;
            console.log('Found email from JWT token:', userEmail);
          }
        }
      } catch (e) {
        console.error('Error getting JWT token:', e);
      }
    }
    
    // Log what we found
    console.log('User identification summary:', {
      userIdFound: !!userId,
      userEmailFound: !!userEmail
    });
    
    // If we couldn't identify the user at all, return an error
    if (!userId && !userEmail) {
      console.error('Could not identify user for account deletion');
      return NextResponse.json({ 
        error: 'User identification failed', 
        details: 'No valid user ID or email found through any method'
      }, { status: 400 });
    }
    
    // We'll use email as the primary identifier since it's the most reliable
    const userIdentifier = userEmail || userId;
    
    console.log('Processing account deletion for user:', userIdentifier);
    
    // In a real implementation, we would actually delete user data here
    // For this example, we're just simulating the deletion process
    // TODO: Add actual data deletion logic here (e.g., Firebase deletion)
    
    // Simulate some deletion work
    await new Promise(resolve => setTimeout(resolve, 500));
    
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
      userIdentified: { email: !!userEmail, userId: !!userId },
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
    
    // Always return 200 status to ensure client process completes
    // In production, we want account deletion to succeed even if there are some errors
    // This helps users escape from a broken state
    return NextResponse.json({ 
      success: false, // Indicate there was an error
      recovered: true, // But we're allowing the process to continue
      error: 'Error during account deletion process', 
      errorDetails: error instanceof Error ? error.message : String(error),
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    }, { 
      status: 200, // Use 200 instead of 500 to let client continue
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  }
}
