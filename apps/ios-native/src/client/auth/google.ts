/**
 * Google OAuth authentication for iOS using expo-auth-session
 *
 * This module handles the Google OAuth flow for the mobile app:
 * 1. Opens Google sign-in in a web browser
 * 2. Receives the authorization code via deep link
 * 3. Exchanges the code for tokens (client-side PKCE)
 * 4. Sends the access token to our backend for Firebase token exchange
 */

import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { exchangeCodeAsync, TokenResponse } from "expo-auth-session";
import { getApiBaseUrl } from "./firebase";

// Complete any pending auth sessions on app start
WebBrowser.maybeCompleteAuthSession();

// Google OAuth client IDs
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export interface GoogleAuthResult {
  success: boolean;
  idToken?: string;
  accessToken?: string;
  authorizationCode?: string;
  codeVerifier?: string;
  redirectUri?: string;
  error?: string;
}

export interface MobileTokenResponse {
  firebaseToken: string;
  profile: unknown;
  needsSetup: boolean;
  userId: string;
  user: {
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

/**
 * Hook to use Google OAuth sign-in
 */
export function useGoogleAuth() {
  // Use useAuthRequest for iOS - it handles the code exchange automatically
  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
    scopes: ["openid", "profile", "email"],
  });

  const signIn = async (): Promise<GoogleAuthResult> => {
    try {
      const result = await promptAsync();

      console.log("[google] Auth result type:", result.type);
      console.log("[google] Auth result:", JSON.stringify(result, null, 2));

      if (result.type === "success") {
        // For iOS, the authentication object contains the tokens
        const { authentication } = result;

        if (authentication?.idToken) {
          return {
            success: true,
            idToken: authentication.idToken,
            accessToken: authentication.accessToken,
          };
        }

        // If no ID token in authentication, check params (fallback)
        if (result.params?.id_token) {
          return {
            success: true,
            idToken: result.params.id_token,
            accessToken: result.params.access_token,
          };
        }

        // If we have an access token but no ID token, we can use the access token
        // to get user info from our backend instead
        if (authentication?.accessToken) {
          console.log("[google] No ID token, but have access token - using access token flow");
          return {
            success: true,
            accessToken: authentication.accessToken,
          };
        }

        // iOS returns authorization code instead of tokens - exchange client-side
        if (result.params?.code && request?.codeVerifier) {
          console.log("[google] Got authorization code - exchanging client-side");
          console.log("[google] Code verifier length:", request.codeVerifier?.length);
          console.log("[google] Redirect URI:", request.redirectUri);

          try {
            // Exchange the code for tokens on the client using PKCE
            const tokenResult = await exchangeCodeAsync(
              {
                clientId: GOOGLE_IOS_CLIENT_ID!,
                code: result.params.code,
                redirectUri: request.redirectUri,
                extraParams: {
                  code_verifier: request.codeVerifier,
                },
              },
              {
                tokenEndpoint: "https://oauth2.googleapis.com/token",
              }
            );

            console.log("[google] Token exchange successful");
            console.log("[google] Got ID token:", !!tokenResult.idToken);
            console.log("[google] Got access token:", !!tokenResult.accessToken);

            if (tokenResult.idToken) {
              return {
                success: true,
                idToken: tokenResult.idToken,
                accessToken: tokenResult.accessToken || undefined,
              };
            } else if (tokenResult.accessToken) {
              return {
                success: true,
                accessToken: tokenResult.accessToken,
              };
            }

            return {
              success: false,
              error: "Token exchange succeeded but no tokens returned",
            };
          } catch (exchangeError) {
            console.error("[google] Client-side token exchange failed:", exchangeError);
            return {
              success: false,
              error: `Token exchange failed: ${exchangeError instanceof Error ? exchangeError.message : String(exchangeError)}`,
            };
          }
        }

        return {
          success: false,
          error: "No tokens or authorization code received from Google",
        };
      } else if (result.type === "cancel") {
        return {
          success: false,
          error: "Sign-in was cancelled",
        };
      } else {
        return {
          success: false,
          error: `Sign-in failed: ${result.type}`,
        };
      }
    } catch (error) {
      console.error("[google] OAuth error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  };

  return {
    request,
    response,
    signIn,
    isReady: !!request,
  };
}

/**
 * Exchange a Google ID token for a Firebase custom token
 */
export async function exchangeGoogleTokenForFirebase(
  googleIdToken: string
): Promise<MobileTokenResponse> {
  const apiBaseUrl = getApiBaseUrl();
  const url = `${apiBaseUrl}/api/auth/mobile-token`;
  console.log('[exchangeGoogleTokenForFirebase] Calling:', url);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ googleIdToken }),
  });
  console.log('[exchangeGoogleTokenForFirebase] Response status:', response.status);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Exchange a Google access token for a Firebase custom token
 * (Alternative flow when ID token is not available)
 */
export async function exchangeGoogleAccessTokenForFirebase(
  accessToken: string
): Promise<MobileTokenResponse> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/auth/mobile-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ googleAccessToken: accessToken }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Exchange a Google authorization code for a Firebase custom token
 * (iOS flow - code must be exchanged server-side with PKCE)
 */
export async function exchangeGoogleCodeForFirebase(
  authorizationCode: string,
  codeVerifier: string,
  redirectUri: string
): Promise<MobileTokenResponse> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/auth/mobile-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      googleAuthorizationCode: authorizationCode,
      codeVerifier,
      redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}
