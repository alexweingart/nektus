import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function POST(req: NextRequest) {
  console.log('TOKEN REVOCATION API CALLED - Environment:', process.env.NODE_ENV);

  try {
    // Log request headers (excluding sensitive data)
    const requestHeaders = Object.fromEntries(req.headers);
    console.log('Request headers:', {
      ...requestHeaders,
      cookie: requestHeaders.cookie ? '[REDACTED]' : undefined,
      authorization: requestHeaders.authorization ? '[REDACTED]' : undefined
    });

    // Production may handle cookies differently, so let's try alternative methods
    console.log('Attempting to get token from session');
    
    // Try to parse the token from the request body first
    let token = null;
    let accessToken = null;
    
    try {
      // First attempt: Get token from request body (client can send it directly)
      const body = await req.json().catch(() => ({}));
      if (body && body.accessToken) {
        console.log('Found access token in request body');
        accessToken = body.accessToken;
      }
    } catch (e) {
      console.log('No token in request body:', e);
    }
    
    // Second attempt: Get token from NextAuth
    if (!accessToken) {
      try {
        token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
        console.log('Token from NextAuth:', !!token);
        if (token?.accessToken) {
          accessToken = token.accessToken;
          console.log('Found access token in NextAuth token');
        }
      } catch (e) {
        console.error('Error getting token from NextAuth:', e);
      }
    }
    
    // If we still don't have an access token, the user is not authenticated
    if (!accessToken) {
      console.error('No valid access token found through any method');
      return NextResponse.json(
        { 
          error: "No valid access token found", 
          environment: process.env.NODE_ENV,
          timestamp: new Date().toISOString()
        },
        { 
          status: 401,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        }
      );
    }

    // Google's token revocation endpoint
    const revokeEndpoint = "https://oauth2.googleapis.com/revoke";
    
    console.log('Making request to Google to revoke token');  
    // Make the request to Google to revoke the token
    const response = await fetch(`${revokeEndpoint}?token=${accessToken}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      // Add a cache: 'no-store' option to prevent caching issues
      cache: 'no-store'
    });

    console.log('Google response status:', response.status);
    
    if (response.ok) {
      console.log('Token revocation successful');
      return NextResponse.json(
        { 
          success: true,
          environment: process.env.NODE_ENV,
          timestamp: new Date().toISOString()
        },
        {
          headers: {
            'Cache-Control': 'no-store, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        }
      );
    } else {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        console.error('Failed to parse error response from Google:', e);
        errorData = { parseError: true, responseStatus: response.status };
      }
      console.error("Token revocation failed:", errorData);
      
      return NextResponse.json(
        { 
          error: "Failed to revoke token with Google", 
          details: errorData,
          environment: process.env.NODE_ENV,
          timestamp: new Date().toISOString()
        },
        { 
          status: 500,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        }
      );
    }
  } catch (error) {
    console.error("Error revoking token:", error);
    
    // More detailed error logging
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        } 
      }
    );
  }
}
