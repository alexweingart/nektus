/**
 * Firebase authentication for iOS
 *
 * This module provides a thin wrapper around React Native Firebase SDK:
 * - Sign in with custom tokens (from backend OAuth exchange)
 * - Session restoration (handled automatically by Firebase SDK)
 * - Auth state management
 *
 * Note: Firebase SDK handles all token management, persistence, and refresh automatically
 */

import auth from '@react-native-firebase/auth';
import type { User, AuthStateCallback } from "../../../types/firebase";

/**
 * Get the API base URL for backend calls
 */
export function getApiBaseUrl(): string {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (apiUrl) {
    return apiUrl;
  }
  // Default to production (with www subdomain)
  return "https://www.nekt.us";
}


/**
 * Sign in to Firebase using a custom token
 * Uses React Native Firebase SDK which handles all token management and persistence
 */
export async function signInWithToken(
  firebaseToken: string,
  _userId: string // Not needed, kept for API compatibility
): Promise<User> {
  try {
    // Sign in to Firebase SDK - it handles token management and persistence automatically
    const userCredential = await auth().signInWithCustomToken(firebaseToken);
    const firebaseUser = userCredential.user;

    console.log("[firebase] Firebase Auth SDK sign-in successful, UID:", firebaseUser.uid);

    // Firebase SDK automatically persists the session
    // No need for manual token storage or refresh

    // Notify auth state listeners
    notifyAuthStateChange(firebaseUser);

    return firebaseUser;
  } catch (error) {
    console.error("[firebase] Sign in failed:", error);
    throw error;
  }
}

/**
 * Attempt to restore a previous session from Firebase SDK
 * Firebase SDK automatically persists and restores sessions
 */
export async function restoreSession(): Promise<{
  restored: boolean;
  user: User | null;
  needsRefresh: boolean;
}> {
  try {
    // Check if Firebase SDK has a persisted session
    const sdkUser = auth().currentUser;

    if (sdkUser) {
      console.log("[firebase] Firebase SDK session restored for user:", sdkUser.uid);

      // Notify auth state listeners
      notifyAuthStateChange(sdkUser);

      return { restored: true, user: sdkUser, needsRefresh: false };
    }

    console.log("[firebase] No persisted session found");
    return { restored: false, user: null, needsRefresh: false };
  } catch (error) {
    console.error("[firebase] Failed to restore session:", error);
    return { restored: false, user: null, needsRefresh: false };
  }
}

/**
 * Sign out from Firebase SDK
 * Firebase SDK automatically clears all persisted session data
 */
export async function signOut(): Promise<void> {
  try {
    await auth().signOut();
    console.log("[firebase] Signed out from Firebase SDK");

    // Notify auth state listeners
    notifyAuthStateChange(null);
  } catch (error) {
    console.error("[firebase] Sign out failed:", error);
    throw error;
  }
}

/**
 * Get the current Firebase user (synchronous)
 */
export function getCurrentUser(): User | null {
  return auth().currentUser;
}

/**
 * Get the current user's ID token for API calls
 */
export async function getIdToken(): Promise<string | null> {
  const user = auth().currentUser;
  if (!user) return null;

  try {
    return await user.getIdToken();
  } catch (error) {
    console.error("[firebase] Failed to get ID token:", error);
    return null;
  }
}

// Auth state listeners (for app-level state management)
const authStateListeners = new Set<AuthStateCallback>();
let currentAuthUser: User | null = null;

/**
 * Subscribe to auth state changes
 * Note: Firebase SDK has its own onAuthStateChanged listener
 * This is for additional app-level listeners
 */
export function subscribeToAuthState(
  callback: AuthStateCallback
): () => void {
  authStateListeners.add(callback);

  // Immediately call with current state
  callback(currentAuthUser);

  // Return unsubscribe function
  return () => {
    authStateListeners.delete(callback);
  };
}

/**
 * Notify all auth state listeners of a change
 */
function notifyAuthStateChange(user: User | null) {
  currentAuthUser = user;

  authStateListeners.forEach((callback) => {
    callback(user);
  });
}
