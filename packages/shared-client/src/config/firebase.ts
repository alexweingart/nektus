/**
 * Shared Firebase configuration values
 *
 * This file exports the Firebase config that works across platforms.
 * The actual Firebase initialization is platform-specific:
 * - Web: apps/web/src/lib/config/firebase/client.ts
 * - iOS: apps/ios-native/src/lib/client/auth/firebase.ts
 *
 * Environment variables:
 * - Web uses NEXT_PUBLIC_ prefix
 * - Expo uses EXPO_PUBLIC_ prefix
 */

// Get env var with platform-specific prefix fallback
function getEnvVar(name: string): string | undefined {
  // Try Next.js prefix first, then Expo prefix
  const nextVar = `NEXT_PUBLIC_${name}`;
  const expoVar = `EXPO_PUBLIC_${name}`;

  // In web (Next.js)
  if (typeof process !== 'undefined' && process.env) {
    return process.env[nextVar] || process.env[expoVar];
  }

  return undefined;
}

/**
 * Firebase configuration object
 * Same values used by both web and mobile platforms
 */
export const firebaseConfig = {
  apiKey: getEnvVar('FIREBASE_API_KEY'),
  authDomain: getEnvVar('FIREBASE_AUTH_DOMAIN'),
  projectId: getEnvVar('FIREBASE_PROJECT_ID'),
  storageBucket: getEnvVar('FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnvVar('FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnvVar('FIREBASE_APP_ID'),
};

/**
 * Check if Firebase config is valid (all required fields present)
 */
export function isFirebaseConfigValid(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId
  );
}

// Dev server URL (Tailscale)
const DEV_API_URL = 'https://nekt.tail768878.ts.net';
// Production URL
const PROD_API_URL = 'https://www.nekt.us';

/**
 * API base URL for backend calls
 * Used by mobile app to call Next.js API routes
 *
 * Automatically uses:
 * - Tailscale dev URL when running in dev mode (__DEV__ is true)
 * - Production URL in release builds
 * - Can be overridden via EXPO_PUBLIC_API_URL env var
 */
export function getApiBaseUrl(): string {
  // Web: relative URLs work
  if (typeof window !== 'undefined' && window.location) {
    return '';
  }

  // Mobile: check for explicit override first
  const apiUrl = getEnvVar('API_URL');
  if (apiUrl) {
    return apiUrl;
  }

  // Auto-detect based on build mode
  // __DEV__ is true when running via Metro bundler, false in production builds
  // Use try-catch in case __DEV__ is not defined (e.g., in web builds)
  try {
    // @ts-ignore - __DEV__ is a React Native global
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      return DEV_API_URL;
    }
  } catch {
    // __DEV__ not available, fall through to production
  }

  // Default to production
  return PROD_API_URL;
}
