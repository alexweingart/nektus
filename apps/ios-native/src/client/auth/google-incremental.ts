/**
 * iOS Incremental OAuth for Google Calendar Scopes
 * Adapted from: apps/web/src/client/auth/google-incremental.ts
 *
 * Changes from web:
 * - Uses expo-auth-session instead of redirect flow
 * - Uses AsyncStorage instead of localStorage
 * - Uses Linking for OAuth callback handling
 */

import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrl } from './firebase';

// Complete auth session for proper cleanup
WebBrowser.maybeCompleteAuthSession();

// Constants for permission error detection
export const PERMISSION_KEYWORDS = [
  'permission',
  'scope',
  'authorization',
  'not authorized',
  'insufficient',
  'access denied',
  'forbidden',
  '403',
  '401',
  'unauthorized',
  'Insufficient Permission',
  'Request had insufficient authentication scopes',
  'No Google Calendar access token available',
  'no google calendar access token',
  'access token available',
  'access token',
  'token',
  'authentication',
];

export const TOKEN_ERROR_PATTERNS = [
  /no.*token.*available/i,
  /token.*not.*available/i,
  /missing.*token/i,
  /invalid.*token/i,
  /expired.*token/i,
  /token.*required/i,
  /no.*access.*token/i,
];

/**
 * Check if the error is related to missing Google Calendar permissions
 */
export function isPermissionError(error?: string): boolean {
  if (!error) {
    return false;
  }

  const lowerError = error.toLowerCase();

  // Check against common permission error keywords
  const matchingKeywords = PERMISSION_KEYWORDS.filter((keyword) =>
    lowerError.includes(keyword.toLowerCase())
  );

  const isPermError = matchingKeywords.length > 0;

  // Additional specific checks for common token-related issues
  if (!isPermError) {
    const matchingPatterns = TOKEN_ERROR_PATTERNS.filter((pattern) =>
      pattern.test(error)
    );
    if (matchingPatterns.length > 0) {
      console.log('[google-incremental] Permission error detected via pattern match:', error);
      return true;
    }
  }

  if (isPermError) {
    console.log('[google-incremental] Permission error detected via keywords:', matchingKeywords);
  }

  return isPermError;
}

// Storage keys
const UPSELL_SHOWN_PREFIX = 'upsell_shown_';
const INCREMENTAL_AUTH_STATE = 'incremental_auth_state';

interface IncrementalAuthState {
  token: string;
  profileId: string;
  timestamp: number;
}

/**
 * Check if upsell modal has been shown for this token
 */
export async function hasShownUpsell(token: string): Promise<boolean> {
  try {
    const key = `${UPSELL_SHOWN_PREFIX}${token}`;
    const stored = await AsyncStorage.getItem(key);

    if (!stored) return false;

    const { timestamp } = JSON.parse(stored);

    // Expire after 15 minutes
    const age = Date.now() - timestamp;
    const maxAge = 15 * 60 * 1000; // 15 minutes

    if (age > maxAge) {
      await AsyncStorage.removeItem(key);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Mark that upsell modal has been shown for this token
 */
export async function markUpsellShown(token: string): Promise<void> {
  try {
    const key = `${UPSELL_SHOWN_PREFIX}${token}`;
    const data = {
      timestamp: Date.now(),
      token,
    };
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.warn('[google-incremental] Failed to mark upsell as shown:', error);
  }
}

/**
 * Store incremental auth state before redirecting
 */
export async function storeAuthState(
  token: string,
  profileId: string
): Promise<void> {
  try {
    const state: IncrementalAuthState = {
      token,
      profileId,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(INCREMENTAL_AUTH_STATE, JSON.stringify(state));
  } catch (error) {
    console.error('[google-incremental] Failed to store auth state:', error);
  }
}

/**
 * Get stored incremental auth state
 */
export async function getStoredAuthState(): Promise<IncrementalAuthState | null> {
  try {
    const stored = await AsyncStorage.getItem(INCREMENTAL_AUTH_STATE);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Clear stored incremental auth state
 */
export async function clearAuthState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(INCREMENTAL_AUTH_STATE);
  } catch (error) {
    console.warn('[google-incremental] Failed to clear auth state:', error);
  }
}

/**
 * Check if returning from incremental auth
 */
export async function isReturningFromIncrementalAuth(): Promise<boolean> {
  const state = await getStoredAuthState();
  if (!state) return false;

  // Only consider it a "return from auth" if the stored state is recent (within last 2 minutes)
  const authReturnWindow = 2 * 60 * 1000; // 2 minutes
  const age = Date.now() - state.timestamp;

  return age <= authReturnWindow;
}

/**
 * Handle return from incremental auth
 */
export async function handleIncrementalAuthReturn(): Promise<{
  success: boolean;
  contactSaveToken?: string;
  profileId?: string;
  denied?: boolean;
}> {
  const state = await getStoredAuthState();

  if (!state) {
    return { success: false };
  }

  // Check if state is recent enough
  const authReturnWindow = 2 * 60 * 1000; // 2 minutes
  const age = Date.now() - state.timestamp;

  if (age > authReturnWindow) {
    await clearAuthState();
    return { success: false };
  }

  // State exists and is recent - user completed or cancelled auth
  await clearAuthState();

  return {
    success: false,
    denied: true,
    contactSaveToken: state.token,
    profileId: state.profileId,
  };
}

// Google Calendar scopes
const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
];

/**
 * Start incremental authorization with Google for calendar scope
 * Uses expo-auth-session for OAuth flow on iOS
 */
export async function startIncrementalAuth(
  contactSaveToken: string,
  profileId: string
): Promise<{ success: boolean; accessToken?: string; error?: string }> {
  console.log('[google-incremental] Starting Google calendar auth...');

  try {
    // Store state before auth
    await storeAuthState(contactSaveToken, profileId);

    const apiBaseUrl = getApiBaseUrl();

    // Use the backend to exchange for calendar tokens
    // The backend handles the OAuth flow and returns tokens
    const authUrl = `${apiBaseUrl}/api/auth/google-calendar-mobile`;

    // Create auth request
    const redirectUri = AuthSession.makeRedirectUri({
      scheme: 'nektus',
      path: 'calendar-callback',
    });

    console.log('[google-incremental] Redirect URI:', redirectUri);

    // Open browser for OAuth
    const result = await WebBrowser.openAuthSessionAsync(
      `${authUrl}?redirect_uri=${encodeURIComponent(redirectUri)}&contact_save_token=${encodeURIComponent(contactSaveToken)}&profile_id=${encodeURIComponent(profileId)}`,
      redirectUri
    );

    if (result.type === 'success' && result.url) {
      // Parse the callback URL for tokens
      const url = new URL(result.url);
      const accessToken = url.searchParams.get('access_token');
      const error = url.searchParams.get('error');

      if (error) {
        console.log('[google-incremental] Auth error:', error);
        await clearAuthState();
        return { success: false, error };
      }

      if (accessToken) {
        console.log('[google-incremental] Auth successful');
        await clearAuthState();
        return { success: true, accessToken };
      }
    }

    if (result.type === 'cancel' || result.type === 'dismiss') {
      console.log('[google-incremental] Auth cancelled by user');
      await clearAuthState();
      return { success: false, error: 'cancelled' };
    }

    await clearAuthState();
    return { success: false, error: 'unknown' };
  } catch (error) {
    console.error('[google-incremental] Auth error:', error);
    await clearAuthState();
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Request calendar scope authorization
 * Convenience wrapper for calendar-specific auth
 */
export async function requestCalendarScope(): Promise<{
  success: boolean;
  accessToken?: string;
  error?: string;
}> {
  // For calendar auth, we don't need contactSaveToken/profileId
  return startIncrementalAuth('', '');
}

export default {
  isPermissionError,
  hasShownUpsell,
  markUpsellShown,
  startIncrementalAuth,
  requestCalendarScope,
  isReturningFromIncrementalAuth,
  handleIncrementalAuthReturn,
};
