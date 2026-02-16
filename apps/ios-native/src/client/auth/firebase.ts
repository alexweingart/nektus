/**
 * Firebase authentication for iOS
 *
 * This module provides a thin wrapper around Firebase JS SDK:
 * - Sign in with custom tokens (from backend OAuth exchange)
 * - Session restoration (persisted to AsyncStorage via firebase-sdk.ts)
 * - Auth state management
 *
 * Note: Firebase SDK handles token refresh automatically. Persistence is configured
 * in firebase-sdk.ts using AsyncStorage for React Native.
 */

import { signInWithCustomToken, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/firebase-sdk';
import type { User, AuthStateCallback } from "../../types/firebase";

// Re-export for backwards compatibility
export { getApiBaseUrl } from "../config";


/**
 * Sign in to Firebase using a custom token
 * The session is automatically persisted to AsyncStorage (configured in firebase-sdk.ts)
 */
export async function signInWithToken(
  firebaseToken: string,
  _userId: string // Not needed, kept for API compatibility
): Promise<User> {
  try {
    const userCredential = await signInWithCustomToken(auth, firebaseToken);
    const firebaseUser = userCredential.user;

    console.log("[firebase] Firebase Auth SDK sign-in successful, UID:", firebaseUser.uid);

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
 * With AsyncStorage persistence, we need to wait for Firebase to load the persisted state
 */
export async function restoreSession(): Promise<{
  restored: boolean;
  user: User | null;
  needsRefresh: boolean;
}> {
  try {
    // Wait for Firebase to load persisted auth state from AsyncStorage
    // This is necessary because auth.currentUser is null until Firebase finishes loading
    const user = await new Promise<User | null>((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        resolve(user);
      });
    });

    if (user) {
      console.log("[firebase] Firebase SDK session restored for user:", user.uid);
      notifyAuthStateChange(user);
      return { restored: true, user, needsRefresh: false };
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
    await firebaseSignOut(auth);
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
  return auth.currentUser;
}

/**
 * Get the current user's ID token for API calls
 */
export async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser;
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

// Set up Firebase auth state listener
onAuthStateChanged(auth, (user) => {
  notifyAuthStateChange(user);
});

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
