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

/**
 * API base URL for backend calls
 * Used by mobile app to call Next.js API routes
 */
export function getApiBaseUrl(): string {
  // Web: relative URLs work
  if (typeof window !== 'undefined' && window.location) {
    return '';
  }

  // Mobile: need full URL
  const apiUrl = getEnvVar('API_URL');
  if (apiUrl) {
    return apiUrl;
  }

  // Default to production
  return 'https://nekt.us';
}
