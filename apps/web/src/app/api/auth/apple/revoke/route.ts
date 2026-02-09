import { NextRequest, NextResponse } from "next/server";
import { SignJWT, importPKCS8 } from "jose";
import { getFirebaseAdmin } from "@/server/config/firebase";

/**
 * Generate Apple client secret JWT
 * Required for Apple's token and revoke endpoints
 *
 * Requires environment variables:
 * - APPLE_TEAM_ID: Your Apple Developer Team ID
 * - APPLE_KEY_ID: The Key ID for your Sign in with Apple key
 * - APPLE_PRIVATE_KEY: The private key contents (p8 file)
 * - NEXT_PUBLIC_APPLE_CLIENT_ID: The Services ID (e.g., com.nektus.web.signin)
 */
async function generateAppleClientSecret(): Promise<string | null> {
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const privateKey = process.env.APPLE_PRIVATE_KEY;
  const clientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID || "com.nektus.web.signin";

  if (!teamId || !keyId || !privateKey) {
    console.warn("[apple-revoke] Missing Apple credentials for client secret generation");
    console.warn("[apple-revoke] Required: APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY");
    return null;
  }

  try {
    // Import the private key
    const key = await importPKCS8(privateKey, "ES256");

    // Create the JWT
    const now = Math.floor(Date.now() / 1000);
    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: keyId })
      .setIssuer(teamId)
      .setSubject(clientId)
      .setAudience("https://appleid.apple.com")
      .setIssuedAt(now)
      .setExpirationTime(now + 60 * 60 * 24 * 180) // 180 days (max allowed)
      .sign(key);

    return jwt;
  } catch (error) {
    console.error("[apple-revoke] Failed to generate client secret:", error);
    return null;
  }
}

/**
 * Revoke Apple Sign-in tokens
 *
 * This endpoint revokes the user's Apple refresh token, which:
 * 1. Invalidates the token so it can't be used again
 * 2. Signals to Apple that the user has disconnected from the app
 * 3. Causes Apple to show "Create Account" instead of "Sign in" on next auth
 *
 * POST /api/auth/apple/revoke
 * Body: { refreshToken: string }
 * Headers: Authorization: Bearer <firebase-id-token>
 */
export async function POST(req: NextRequest) {
  console.log("[apple-revoke] Revoke request received");

  try {
    // Verify the user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.replace("Bearer ", "");
    const { auth } = await getFirebaseAdmin();

    try {
      await auth.verifyIdToken(idToken);
    } catch (verifyError) {
      console.error("[apple-revoke] Token verification failed:", verifyError);
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Get the refresh token from the request
    const body = await req.json();
    const { refreshToken } = body;

    if (!refreshToken) {
      return NextResponse.json(
        { error: "Missing refresh token" },
        { status: 400 }
      );
    }

    // Generate the client secret
    const clientSecret = await generateAppleClientSecret();
    if (!clientSecret) {
      // If we can't generate a client secret, we can't revoke
      // This is expected if Apple credentials aren't configured
      console.log("[apple-revoke] Cannot revoke - Apple credentials not configured");
      return NextResponse.json(
        {
          success: false,
          message: "Apple credentials not configured for revocation",
          manualRevocationRequired: true,
        },
        { status: 200 }
      );
    }

    const clientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID || "com.nektus.web.signin";

    // Call Apple's revoke endpoint
    const revokeResponse = await fetch("https://appleid.apple.com/auth/revoke", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        token: refreshToken,
        token_type_hint: "refresh_token",
      }),
    });

    if (revokeResponse.ok) {
      console.log("[apple-revoke] Token revoked successfully");
      return NextResponse.json({
        success: true,
        message: "Apple token revoked successfully",
      });
    } else {
      const errorText = await revokeResponse.text();
      console.error("[apple-revoke] Revocation failed:", revokeResponse.status, errorText);

      // Apple returns 200 even for invalid tokens, so a non-200 is unusual
      return NextResponse.json(
        {
          success: false,
          message: "Failed to revoke Apple token",
          error: errorText,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[apple-revoke] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
