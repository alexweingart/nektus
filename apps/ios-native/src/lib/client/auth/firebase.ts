/**
 * Firebase authentication for iOS
 *
 * This module handles:
 * - Firebase initialization with shared config
 * - Custom token sign-in (after Google OAuth)
 * - Token persistence using SecureStore (iOS Keychain)
 * - Auth state management
 */

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithCustomToken,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  Auth,
} from "firebase/auth";
import * as SecureStore from "expo-secure-store";

// Firebase configuration - using environment variables with Expo prefix
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Storage keys for SecureStore
const STORAGE_KEYS = {
  FIREBASE_TOKEN: "nekt_firebase_token",
  REFRESH_TOKEN: "nekt_refresh_token",
  ID_TOKEN: "nekt_id_token",
  USER_ID: "nekt_user_id",
  TOKEN_CREATED_AT: "nekt_token_created_at",
} as const;

// Token refresh threshold (50 minutes)
const TOKEN_REFRESH_THRESHOLD = 50 * 60 * 1000;

// Singleton Firebase app instance
let app: FirebaseApp | null = null;
let auth: Auth | null = null;

/**
 * Get or initialize the Firebase app
 */
export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }
  }
  return app;
}

/**
 * Get the Firebase Auth instance
 */
export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}

/**
 * Get the API base URL for backend calls
 */
export function getApiBaseUrl(): string {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (apiUrl) {
    return apiUrl;
  }
  // Default to production
  return "https://nekt.us";
}

/**
 * Store authentication tokens securely
 */
async function storeAuthTokens(
  firebaseToken: string,
  userId: string,
  refreshToken?: string,
  idToken?: string
): Promise<void> {
  try {
    const promises = [
      SecureStore.setItemAsync(STORAGE_KEYS.FIREBASE_TOKEN, firebaseToken),
      SecureStore.setItemAsync(STORAGE_KEYS.USER_ID, userId),
      SecureStore.setItemAsync(
        STORAGE_KEYS.TOKEN_CREATED_AT,
        Date.now().toString()
      ),
    ];
    if (refreshToken) {
      promises.push(SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken));
    }
    if (idToken) {
      promises.push(SecureStore.setItemAsync(STORAGE_KEYS.ID_TOKEN, idToken));
    }
    await Promise.all(promises);
  } catch (error) {
    console.error("[firebase] Failed to store auth tokens:", error);
    throw error;
  }
}

/**
 * Get stored authentication tokens
 */
async function getStoredAuthTokens(): Promise<{
  firebaseToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  tokenCreatedAt: number | null;
}> {
  try {
    const [firebaseToken, refreshToken, userId, tokenCreatedAtStr] = await Promise.all([
      SecureStore.getItemAsync(STORAGE_KEYS.FIREBASE_TOKEN),
      SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
      SecureStore.getItemAsync(STORAGE_KEYS.USER_ID),
      SecureStore.getItemAsync(STORAGE_KEYS.TOKEN_CREATED_AT),
    ]);

    return {
      firebaseToken,
      refreshToken,
      userId,
      tokenCreatedAt: tokenCreatedAtStr ? parseInt(tokenCreatedAtStr, 10) : null,
    };
  } catch (error) {
    console.error("[firebase] Failed to get stored auth tokens:", error);
    return { firebaseToken: null, refreshToken: null, userId: null, tokenCreatedAt: null };
  }
}

/**
 * Refresh ID token using refresh token
 */
async function refreshIdToken(refreshToken: string): Promise<{
  idToken: string;
  refreshToken: string;
}> {
  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error("Firebase API key not configured");
  }

  const response = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Ios-Bundle-Identifier": "com.nektus.app",
      },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
    }
  );

  if (!response.ok) {
    const error = await response.json();
    console.error("[firebase] Token refresh failed:", error);
    throw new Error(error.error?.message || "Token refresh failed");
  }

  const data = await response.json();
  return {
    idToken: data.id_token,
    refreshToken: data.refresh_token,
  };
}

/**
 * Clear stored authentication tokens
 */
async function clearAuthTokens(): Promise<void> {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(STORAGE_KEYS.FIREBASE_TOKEN),
      SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
      SecureStore.deleteItemAsync(STORAGE_KEYS.ID_TOKEN),
      SecureStore.deleteItemAsync(STORAGE_KEYS.USER_ID),
      SecureStore.deleteItemAsync(STORAGE_KEYS.TOKEN_CREATED_AT),
    ]);
  } catch (error) {
    console.error("[firebase] Failed to clear auth tokens:", error);
  }
}

/**
 * Check if the stored token needs refresh
 */
function tokenNeedsRefresh(tokenCreatedAt: number | null): boolean {
  if (!tokenCreatedAt) return true;
  const tokenAge = Date.now() - tokenCreatedAt;
  return tokenAge > TOKEN_REFRESH_THRESHOLD;
}

/**
 * Sign in to Firebase using a custom token via REST API
 * This bypasses the JS SDK's referer issues on React Native
 */
async function signInWithCustomTokenREST(customToken: string): Promise<{
  idToken: string;
  refreshToken: string;
  expiresIn: string;
}> {
  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error("Firebase API key not configured");
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Include bundle ID header for iOS API key restriction
        "X-Ios-Bundle-Identifier": "com.nektus.app",
      },
      body: JSON.stringify({
        token: customToken,
        returnSecureToken: true,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    console.error("[firebase] REST sign-in failed:", error);
    throw new Error(error.error?.message || "Sign in failed");
  }

  return response.json();
}

// Store REST auth result for API calls
let restAuthResult: {
  idToken: string;
  refreshToken: string;
  localId?: string;
} | null = null;

/**
 * Get the current REST auth tokens (for direct API calls)
 */
export function getRestAuthTokens() {
  return restAuthResult;
}

/**
 * Sign in to Firebase using a custom token
 * Uses REST API to properly support iOS bundle ID restrictions
 */
export async function signInWithToken(
  firebaseToken: string,
  userId: string
): Promise<User> {
  try {
    // Use REST API which properly handles iOS bundle ID header
    const result = await signInWithCustomTokenREST(firebaseToken);
    console.log("[firebase] REST sign-in successful");

    // Store the REST auth result for direct API calls
    restAuthResult = {
      idToken: result.idToken,
      refreshToken: result.refreshToken,
      localId: userId,
    };

    // Store tokens for persistence (including refresh token for session restore)
    await storeAuthTokens(firebaseToken, userId, result.refreshToken, result.idToken);

    // Create a mock user object since we're not using the SDK for auth
    // This matches the User interface shape that the rest of the app expects
    const mockUser = {
      uid: userId,
      email: null,
      displayName: null,
      photoURL: null,
      emailVerified: false,
      isAnonymous: false,
      metadata: {},
      providerData: [],
      refreshToken: result.refreshToken,
      tenantId: null,
      delete: async () => {},
      getIdToken: async () => result.idToken,
      getIdTokenResult: async () => ({ token: result.idToken } as any),
      reload: async () => {},
      toJSON: () => ({ uid: userId }),
      providerId: "firebase",
    } as unknown as User;

    console.log("[firebase] Successfully signed in user:", userId);
    return mockUser;
  } catch (error) {
    console.error("[firebase] Sign in failed:", error);
    throw error;
  }
}

/**
 * Attempt to restore a previous session from stored tokens
 * Uses refresh token to get a new ID token
 */
export async function restoreSession(): Promise<{
  restored: boolean;
  user: User | null;
  needsRefresh: boolean;
}> {
  try {
    const { refreshToken, userId } = await getStoredAuthTokens();

    if (!refreshToken || !userId) {
      console.log("[firebase] No stored session to restore");
      return { restored: false, user: null, needsRefresh: false };
    }

    // Use refresh token to get a new ID token
    console.log("[firebase] Restoring session with refresh token...");
    const result = await refreshIdToken(refreshToken);
    console.log("[firebase] Session refresh successful");

    // Store the REST auth result for direct API calls
    restAuthResult = {
      idToken: result.idToken,
      refreshToken: result.refreshToken,
      localId: userId,
    };

    // Update stored refresh token if it changed
    await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, result.refreshToken);
    await SecureStore.setItemAsync(STORAGE_KEYS.TOKEN_CREATED_AT, Date.now().toString());

    // Create a mock user object
    const mockUser = {
      uid: userId,
      email: null,
      displayName: null,
      photoURL: null,
      emailVerified: false,
      isAnonymous: false,
      metadata: {},
      providerData: [],
      refreshToken: result.refreshToken,
      tenantId: null,
      delete: async () => {},
      getIdToken: async () => result.idToken,
      getIdTokenResult: async () => ({ token: result.idToken } as any),
      reload: async () => {},
      toJSON: () => ({ uid: userId }),
      providerId: "firebase",
    } as unknown as User;

    console.log("[firebase] Session restored for user:", userId);
    return { restored: true, user: mockUser, needsRefresh: false };
  } catch (error) {
    console.error("[firebase] Failed to restore session:", error);
    // Clear invalid tokens
    await clearAuthTokens();
    return { restored: false, user: null, needsRefresh: false };
  }
}

/**
 * Sign out and clear all stored tokens
 */
export async function signOut(): Promise<void> {
  try {
    // Clear REST auth state
    restAuthResult = null;
    // Clear stored tokens
    await clearAuthTokens();
    console.log("[firebase] User signed out");
  } catch (error) {
    console.error("[firebase] Sign out failed:", error);
    throw error;
  }
}

/**
 * Get the current Firebase user (synchronous)
 */
export function getCurrentUser(): User | null {
  const authInstance = getFirebaseAuth();
  return authInstance.currentUser;
}

/**
 * Get the current user's ID token for API calls
 */
export async function getIdToken(): Promise<string | null> {
  const user = getCurrentUser();
  if (!user) return null;

  try {
    return await user.getIdToken();
  } catch (error) {
    console.error("[firebase] Failed to get ID token:", error);
    return null;
  }
}

/**
 * Subscribe to auth state changes
 */
export function subscribeToAuthState(
  callback: (user: User | null) => void
): () => void {
  const authInstance = getFirebaseAuth();
  return onAuthStateChanged(authInstance, callback);
}
