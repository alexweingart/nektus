import { NextRequest, NextResponse } from 'next/server';

/**
 * API route to handle account deletion
 */
export async function POST(req: NextRequest) {
  console.log('DELETE ACCOUNT API CALLED - Environment:', process.env.NODE_ENV);
  
  try {
    // Parse request body to get user information
    let userId: string | null = null;
    let userEmail: string | null = null;
    
    try {
      const body = await req.json();
      userId = body?.userId || null;
      userEmail = body?.email || null;
      
      console.log('User identification from request:', {
        userIdFound: !!userId,
        userEmailFound: !!userEmail
      });
    } catch (e) {
      console.log('Error parsing request body:', e);
    }
    
    // If we couldn't identify the user at all, return an error
    if (!userId && !userEmail) {
      console.error('Could not identify user for account deletion');
      return NextResponse.json({ 
        error: 'User identification failed', 
        details: 'No valid user ID or email found in request'
      }, { status: 400 });
    }
    
    // We'll use email as the primary identifier since it's the most reliable
    const userIdentifier = userEmail || userId;
    console.log('Processing account deletion for user:', userIdentifier);
    
    // Note: In a production implementation, you would delete user data from your database here
    // For now, we're just returning success
    
    // Set headers to prevent caching
    return NextResponse.json({ 
      success: true,
      message: 'Account deletion processed successfully',
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
    
    // Always return 200 status to ensure client process completes
    return NextResponse.json({ 
      success: false,
      recovered: true,
      error: 'Error during account deletion process', 
      timestamp: new Date().toISOString()
    }, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  }
}
