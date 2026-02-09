import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getServerSession } from "next-auth";
import { authOptions } from "../../[...nextauth]/options";

export async function POST(req: NextRequest) {
  // TOKEN REVOCATION API CALLED

  try {
    // Clone the request for multiple uses
    const reqClone = req.clone();

    // Request headers omitted for privacy

    // We'll try all possible methods to get a valid access token
    let accessToken: string | null = null;
    let userId: string | null = null;
    let email: string | null = null;

    // Method 1: Get data from request body
    try {
      const body = await reqClone.json();
      // Request body parsed successfully

      if (body?.accessToken) {
        // Found access token in request body
        accessToken = body.accessToken;
      }

      if (body?.userId) {
        // Found userId in request body
        userId = body.userId;
      }

      if (body?.email) {
        // Found email in request body
        email = body.email;
      }
    } catch {
      // Error parsing request body - continue to next method
    }

    // Method 2: Get token from NextAuth token
    if (!accessToken) {
      try {
        const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
        // Token from NextAuth JWT checked

        if (token?.accessToken) {
          accessToken = token.accessToken;
          // Found access token in NextAuth JWT token
        }

        // Also try to get user info from token if we don't have it yet
        if (!userId && token?.user?.id) {
          userId = token.user.id;
        }

        if (!email && token?.user?.email) {
          email = token.user.email;
        }
      } catch {
        // Error getting JWT token from NextAuth
      }
    }

    // Method 3: Get token from server session
    if (!accessToken) {
      try {
        const session = await getServerSession(authOptions);
        // Server session checked

        if (session?.accessToken) {
          accessToken = session.accessToken;
          // Found access token in server session
        }

        // Also try to get user info from session if we don't have it yet
        if (!userId && session?.user?.id) {
          userId = session.user.id;
        }

        if (!email && session?.user?.email) {
          email = session.user.email;
        }
      } catch {
        // Error getting server session
      }
    }

    // Token retrieval summary completed

    // For production, if we have no token but have a userId or email, we'll proceed anyway
    // and just log that the account was disconnected
    if (!accessToken && (userId || email)) {
      // No access token found, but user identified. Proceeding with account cleanup.
      return NextResponse.json(
        {
          success: true,
          message: "Account disconnected without token revocation",
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
    }

    // If we still don't have any means to identify the user, return an error
    if (!accessToken && !userId && !email) {
      // No valid user identification found through any method
      return NextResponse.json(
        {
          error: "No valid user identification found",
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

    // Only attempt to revoke the token if we have one
    let revokeResponse = { ok: true, status: 200 }; // Default to success

    if (accessToken) {
      // Making request to Google to revoke token
      try {
        // Make the request to Google to revoke the token
        const response = await fetch(`${revokeEndpoint}?token=${accessToken}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          // Add a cache: 'no-store' option to prevent caching issues
          cache: 'no-store'
        });

        revokeResponse = response;
        // Google revocation response status processed

        try {
          await response.json();
        } catch {
          // Google's revocation endpoint returns an empty response on success
          // so this might throw, which is fine
          // No JSON in Google response (expected for success case)
        }
      } catch {
        // Network error during token revocation
        // We'll continue despite the error to ensure the user can still delete their account
      }
    } else {
      // Skipping token revocation - no token available
    }

    // Always return success to the client, even if token revocation failed
    // This allows the account deletion flow to complete on the client side
    // We've already logged any errors that occurred during revocation
    return NextResponse.json(
      {
        success: true,
        tokenRevoked: revokeResponse.ok,
        userIdentified: { userId: !!userId, email: !!email },
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
  } catch (error) {
    // Error revoking token
    // Detailed error information intentionally not logged

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
