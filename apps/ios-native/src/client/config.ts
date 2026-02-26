/**
 * Client configuration helpers
 *
 * This module contains configuration helpers that don't require
 * Firebase SDK or other heavy dependencies. Safe to use in App Clip.
 */

// Dev server URL (Tailscale)
const DEV_API_URL = "https://nekt.tail768878.ts.net";
// Production URL (must match Vercel primary domain for OAuth redirect_uri matching)
const PROD_API_URL = "https://nekt.us";

/**
 * Get the API base URL for backend calls
 *
 * Automatically uses:
 * - Tailscale dev URL when running in dev mode (__DEV__ is true)
 * - Production URL in release builds
 *
 * Can be overridden via EXPO_PUBLIC_API_URL env var if needed
 */
export function getApiBaseUrl(): string {
  // Allow explicit override via env var
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (apiUrl) {
    return apiUrl;
  }

  // Auto-detect based on build mode
  // __DEV__ is true when running via Metro bundler, false in production builds
  if (__DEV__) {
    return DEV_API_URL;
  }

  return PROD_API_URL;
}
