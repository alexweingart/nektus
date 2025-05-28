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

    // Get the user's session token to extract their access token
    console.log('Attempting to get token from session');
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    
    console.log('Token found:', !!token, 'Access token present:', !!(token?.accessToken));
    
    if (!token || !token.accessToken) {
      console.error('No valid session or access token found');
      return NextResponse.json(
        { 
          error: "No valid session found", 
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
    const response = await fetch(`${revokeEndpoint}?token=${token.accessToken}`, {
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
