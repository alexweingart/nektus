import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { jwtVerify, createRemoteJWKSet, SignJWT, importPKCS8 } from "jose";
import { createCustomTokenWithCorrectSub } from "@/server/config/firebase";
import { ServerProfileService } from "@/server/profile/create";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Apple's JWKS endpoint for verifying identity tokens
const appleJWKS = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys")
);

interface AppleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  id_token: string;
}

/**
 * Generate Apple client secret JWT
 * Required for Apple's token endpoint
 */
async function generateAppleClientSecret(): Promise<string | null> {
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const privateKey = process.env.APPLE_PRIVATE_KEY;
  const clientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID || "com.nektus.web.signin";

  if (!teamId || !keyId || !privateKey) {
    console.log("[mobile-token] Apple credentials not configured for token exchange");
    return null;
  }

  try {
    const key = await importPKCS8(privateKey, "ES256");
    const now = Math.floor(Date.now() / 1000);
    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: keyId })
      .setIssuer(teamId)
      .setSubject(clientId)
      .setAudience("https://appleid.apple.com")
      .setIssuedAt(now)
      .setExpirationTime(now + 60 * 60 * 24 * 180)
      .sign(key);
    return jwt;
  } catch (error) {
    console.error("[mobile-token] Failed to generate Apple client secret:", error);
    return null;
  }
}

/**
 * Exchange Apple authorization code for tokens
 * Returns refresh_token which can be used for revocation on account deletion
 */
async function exchangeAppleCodeForTokens(
  authorizationCode: string
): Promise<AppleTokenResponse | null> {
  const clientSecret = await generateAppleClientSecret();
  if (!clientSecret) {
    return null;
  }

  const clientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID || "com.nektus.web.signin";

  try {
    const response = await fetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: authorizationCode,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[mobile-token] Apple token exchange failed:", response.status, errorText);
      return null;
    }

    const tokens = await response.json();
    console.log("[mobile-token] Apple token exchange successful");
    return tokens;
  } catch (error) {
    console.error("[mobile-token] Apple token exchange error:", error);
    return null;
  }
}

interface GoogleUserInfo {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
}

interface GoogleTokenResponse {
  access_token: string;
  id_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

/**
 * Get user info from Google using an access token
 */
async function getUserInfoFromAccessToken(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get user info: ${response.status}`);
  }

  return response.json();
}

/**
 * Exchange an authorization code for tokens using PKCE
 * For iOS native apps, we use the iOS client ID (no secret - public client with PKCE)
 */
async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<GoogleTokenResponse> {
  const tokenEndpoint = "https://oauth2.googleapis.com/token";

  // iOS apps are "public clients" - use iOS client ID without secret
  // The code_verifier from PKCE serves as proof instead of client_secret
  const iosClientId = process.env.GOOGLE_IOS_CLIENT_ID;

  if (!iosClientId) {
    throw new Error("GOOGLE_IOS_CLIENT_ID not configured");
  }

  const params = new URLSearchParams({
    client_id: iosClientId,
    code,
    code_verifier: codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  console.log("[mobile-token] Exchanging code with iOS client ID:", iosClientId.substring(0, 20) + "...");
  console.log("[mobile-token] Redirect URI:", redirectUri);

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[mobile-token] Token exchange failed:", error);
    throw new Error(`Token exchange failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Mobile authentication endpoint
 *
 * This endpoint handles authentication for the iOS app:
 * 1. Receives a Google ID token OR access token from expo-auth-session
 *    OR an Apple identity token from Sign in with Apple
 * 2. Verifies the token with Google or Apple
 * 3. Creates a Firebase custom token for the user
 * 4. Creates/retrieves the user's profile
 * 5. Returns both the Firebase token and profile data
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      googleIdToken,
      googleAccessToken,
      googleAuthorizationCode,
      codeVerifier,
      redirectUri,
      // Apple Sign-in parameters
      appleIdentityToken,
      appleAuthorizationCode, // For token exchange to get refresh_token
      appleFullName,
      appleEmail,
    } = body;

    if (!googleIdToken && !googleAccessToken && !googleAuthorizationCode && !appleIdentityToken) {
      return NextResponse.json(
        { error: "Missing authentication token (Google or Apple)" },
        { status: 400 }
      );
    }

    let userId: string;
    let userInfo: { name: string | null; email: string | null; image: string | null };
    let appleRefreshToken: string | null = null; // For account deletion/revocation

    // Try ID token first (preferred), then access token, then authorization code
    if (googleIdToken) {
      // Verify the Google ID token
      // Accept both web and iOS client IDs as valid audiences
      try {
        const validAudiences = [
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_IOS_CLIENT_ID,
        ].filter(Boolean) as string[];

        const ticket = await client.verifyIdToken({
          idToken: googleIdToken,
          audience: validAudiences,
        });
        const payload = ticket.getPayload();

        if (!payload || !payload.sub) {
          return NextResponse.json(
            { error: "Invalid token payload" },
            { status: 401 }
          );
        }

        userId = payload.sub;
        userInfo = {
          name: payload.name || null,
          email: payload.email || null,
          image: payload.picture || null,
        };
        console.log("[mobile-token] Verified ID token for user:", userId);
      } catch (verifyError) {
        console.error("[mobile-token] Failed to verify Google ID token:", verifyError);
        return NextResponse.json(
          { error: "Invalid Google ID token" },
          { status: 401 }
        );
      }
    } else if (googleAccessToken) {
      // Use access token to get user info
      try {
        const googleUserInfo = await getUserInfoFromAccessToken(googleAccessToken);

        if (!googleUserInfo.sub) {
          return NextResponse.json(
            { error: "Invalid access token - no user ID" },
            { status: 401 }
          );
        }

        userId = googleUserInfo.sub;
        userInfo = {
          name: googleUserInfo.name || null,
          email: googleUserInfo.email || null,
          image: googleUserInfo.picture || null,
        };
        console.log("[mobile-token] Got user info from access token for user:", userId);
      } catch (accessError) {
        console.error("[mobile-token] Failed to get user info from access token:", accessError);
        return NextResponse.json(
          { error: "Invalid Google access token" },
          { status: 401 }
        );
      }
    } else if (googleAuthorizationCode && codeVerifier && redirectUri) {
      // Exchange authorization code for tokens (iOS PKCE flow)
      try {
        console.log("[mobile-token] Exchanging authorization code for tokens");
        const tokens = await exchangeCodeForTokens(googleAuthorizationCode, codeVerifier, redirectUri);

        // If we got an ID token, verify it
        if (tokens.id_token) {
          const ticket = await client.verifyIdToken({
            idToken: tokens.id_token,
            audience: process.env.GOOGLE_CLIENT_ID,
          });
          const payload = ticket.getPayload();

          if (!payload || !payload.sub) {
            return NextResponse.json(
              { error: "Invalid token payload from code exchange" },
              { status: 401 }
            );
          }

          userId = payload.sub;
          userInfo = {
            name: payload.name || null,
            email: payload.email || null,
            image: payload.picture || null,
          };
          console.log("[mobile-token] Verified ID token from code exchange for user:", userId);
        } else {
          // Fall back to access token
          const googleUserInfo = await getUserInfoFromAccessToken(tokens.access_token);

          if (!googleUserInfo.sub) {
            return NextResponse.json(
              { error: "Invalid tokens from code exchange - no user ID" },
              { status: 401 }
            );
          }

          userId = googleUserInfo.sub;
          userInfo = {
            name: googleUserInfo.name || null,
            email: googleUserInfo.email || null,
            image: googleUserInfo.picture || null,
          };
          console.log("[mobile-token] Got user info from code exchange access token for user:", userId);
        }
      } catch (codeError) {
        console.error("[mobile-token] Failed to exchange authorization code:", codeError);
        return NextResponse.json(
          { error: "Failed to exchange authorization code" },
          { status: 401 }
        );
      }
    } else if (appleIdentityToken) {
      // Verify Apple identity token
      try {
        console.log("[mobile-token] Verifying Apple identity token");

        // Verify the JWT signature against Apple's JWKS
        // Accept both native app bundle ID and web Services ID
        const validAppleAudiences = [
          "com.nektus.app", // iOS native app bundle ID
          process.env.NEXT_PUBLIC_APPLE_CLIENT_ID || "com.nektus.web.signin", // Web Services ID
        ];

        const { payload } = await jwtVerify(appleIdentityToken, appleJWKS, {
          issuer: "https://appleid.apple.com",
          audience: validAppleAudiences,
        });

        if (!payload.sub) {
          return NextResponse.json(
            { error: "Invalid Apple token - no user ID" },
            { status: 401 }
          );
        }

        // Build user name from provided fullName (Apple only provides on first sign-in)
        let userName: string | null = null;
        if (appleFullName) {
          const parts = [appleFullName.givenName, appleFullName.familyName].filter(Boolean);
          userName = parts.length > 0 ? parts.join(" ") : null;
        }

        const appleUserEmail = appleEmail || (payload.email as string) || null;

        // Email-based user matching: Check if user already exists with this email (from Google sign-in)
        // This allows users who previously signed in with Google to sign in with Apple using same email
        if (appleUserEmail) {
          const existingProfile = await ServerProfileService.findProfileByEmail(appleUserEmail);
          if (existingProfile) {
            console.log("[mobile-token] Found existing profile by email, using existing userId:", existingProfile.userId);
            userId = existingProfile.userId;
          } else {
            // No existing profile with this email - create new Apple user ID
            userId = `apple_${payload.sub}`;
          }
        } else {
          // No email provided - use Apple user ID
          userId = `apple_${payload.sub}`;
        }

        userInfo = {
          name: userName,
          email: appleUserEmail,
          image: null, // Apple doesn't provide profile images
        };

        console.log("[mobile-token] Verified Apple token for user:", userId);

        // Try to exchange authorization code for refresh token (for account deletion)
        // This is optional - only works if Apple credentials are configured
        if (appleAuthorizationCode) {
          try {
            const appleTokens = await exchangeAppleCodeForTokens(appleAuthorizationCode);
            if (appleTokens?.refresh_token) {
              appleRefreshToken = appleTokens.refresh_token;
              console.log("[mobile-token] Obtained Apple refresh token for revocation support");
            }
          } catch (tokenExchangeError) {
            console.warn("[mobile-token] Apple token exchange failed (non-critical):", tokenExchangeError);
            // Continue without refresh token - revocation will require manual steps
          }
        }
      } catch (appleError) {
        console.error("[mobile-token] Failed to verify Apple identity token:", appleError);
        return NextResponse.json(
          { error: "Invalid Apple identity token" },
          { status: 401 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Invalid request - missing required parameters" },
        { status: 400 }
      );
    }

    // Create Firebase custom token
    let firebaseToken: string;
    try {
      firebaseToken = await createCustomTokenWithCorrectSub(userId);
    } catch (tokenError) {
      console.error("[mobile-token] Failed to create Firebase token:", tokenError);
      return NextResponse.json(
        { error: "Failed to create authentication token" },
        { status: 500 }
      );
    }

    // Get or create user profile
    let profile, needsSetup;
    try {
      const result = await ServerProfileService.getOrCreateProfile(userId, userInfo);
      profile = result.profile;
      needsSetup = result.needsSetup;
    } catch (profileError) {
      console.error("[mobile-token] Failed to get/create profile:", profileError);
      // Still return the token even if profile fails - client can retry profile later
      return NextResponse.json({
        firebaseToken,
        profile: null,
        needsSetup: true,
        userId,
        user: userInfo,
        appleRefreshToken, // For account deletion - client should store securely
      });
    }

    console.log("[mobile-token] Successfully authenticated user:", userId);

    return NextResponse.json({
      firebaseToken,
      profile,
      needsSetup,
      userId,
      user: userInfo,
      appleRefreshToken, // For account deletion - client should store securely
    });
  } catch (error) {
    console.error("[mobile-token] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
