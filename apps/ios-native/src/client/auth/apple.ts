/**
 * Sign in with Apple authentication for iOS
 *
 * This module handles Apple authentication for the App Clip and full app:
 * 1. Triggers Sign in with Apple modal
 * 2. Receives identity token from Apple
 * 3. Exchanges token with backend for Firebase custom token
 *
 * Used by App Clip for immediate SIWA on launch
 */

import * as AppleAuthentication from "expo-apple-authentication";
import { getApiBaseUrl } from "./firebase";

export interface AppleAuthResult {
  success: boolean;
  identityToken?: string;
  authorizationCode?: string;
  user?: string;
  fullName?: {
    givenName: string | null;
    familyName: string | null;
  };
  email?: string | null;
  error?: string;
}

export interface AppleMobileTokenResponse {
  firebaseToken: string;
  userId: string;
  needsSetup: boolean;
  user: {
    name: string | null;
    email: string | null;
    image: string | null;
  };
  profile?: unknown;
}

/**
 * Check if Sign in with Apple is available on this device
 */
export async function isAppleAuthAvailable(): Promise<boolean> {
  return AppleAuthentication.isAvailableAsync();
}

/**
 * Perform Sign in with Apple
 * Returns identity token for backend exchange
 */
export async function signInWithApple(): Promise<AppleAuthResult> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    console.log("[apple] SIWA success, user:", credential.user);

    return {
      success: true,
      identityToken: credential.identityToken ?? undefined,
      authorizationCode: credential.authorizationCode ?? undefined,
      user: credential.user,
      fullName: credential.fullName
        ? {
            givenName: credential.fullName.givenName,
            familyName: credential.fullName.familyName,
          }
        : undefined,
      email: credential.email,
    };
  } catch (error: unknown) {
    const errorWithCode = error as { code?: string; message?: string };

    if (errorWithCode.code === "ERR_REQUEST_CANCELED") {
      console.log("[apple] SIWA cancelled by user");
      return { success: false, error: "Sign-in was cancelled" };
    }

    console.error("[apple] SIWA failed:", error);
    return {
      success: false,
      error: errorWithCode.message || "Apple Sign-in failed",
    };
  }
}

/**
 * Exchange Apple identity token for Firebase custom token
 * This creates/finds the user account on the backend
 */
export async function exchangeAppleTokenForFirebase(
  identityToken: string,
  fullName?: { givenName: string | null; familyName: string | null },
  email?: string | null
): Promise<AppleMobileTokenResponse> {
  const apiBaseUrl = getApiBaseUrl();

  console.log("[apple] Exchanging token with backend...");

  const response = await fetch(`${apiBaseUrl}/api/auth/mobile-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      appleIdentityToken: identityToken,
      appleFullName: fullName,
      appleEmail: email,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error("[apple] Token exchange failed:", error);
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  console.log("[apple] Token exchange successful, userId:", data.userId);

  return data;
}
