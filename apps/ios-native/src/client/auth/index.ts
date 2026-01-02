/**
 * Auth module exports
 *
 * Provides authentication utilities for the iOS app.
 */

// Google OAuth
export {
  useGoogleAuth,
  exchangeGoogleTokenForFirebase,
  type GoogleAuthResult,
  type MobileTokenResponse,
} from "./google";

// Firebase Auth
export {
  getApiBaseUrl,
  signInWithToken,
  restoreSession,
  signOut,
  getCurrentUser,
  getIdToken,
  subscribeToAuthState,
} from "./firebase";
