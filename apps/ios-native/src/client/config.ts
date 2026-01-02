/**
 * Client configuration helpers
 *
 * This module contains configuration helpers that don't require
 * Firebase SDK or other heavy dependencies. Safe to use in App Clip.
 */

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
