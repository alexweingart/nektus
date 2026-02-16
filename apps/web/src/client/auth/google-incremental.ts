/**
 * Client-side incremental authorization service for Google OAuth
 * Simplified to redirect-only flow to avoid COOP issues
 *
 * Platform-specific behaviors:
 * - Android: Skip silent auth (often fails), go straight to explicit flow
 * - iOS Safari: Try silent auth first (better session handling)
 * - iOS in-app browsers: Skip to explicit (OAuth issues in WKWebView)
 * - iOS Chrome/Firefox: Skip to explicit (different session handling than Safari)
 * - Desktop: Try silent auth first, then explicit if needed
 */

import { CACHE_TTL } from '@nektus/shared-client';

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
  'Google Contacts API error: 403',
  'Google Contacts API error: 401',
  'Insufficient Permission',
  'Request had insufficient authentication scopes',
  'No Google Contacts access token available',
  'no google contacts access token',
  'access token available',
  'access token',
  'token',
  'authentication'
];

export const TOKEN_ERROR_PATTERNS = [
  /no.*token.*available/i,
  /token.*not.*available/i,
  /missing.*token/i,
  /invalid.*token/i,
  /expired.*token/i,
  /token.*required/i,
  /no.*access.*token/i
];

/**
 * Check if the error is related to missing Google Contacts permissions
 */
export function isPermissionError(error?: string): boolean {
  if (!error) {
    return false;
  }
  
  const lowerError = error.toLowerCase();
  
  // Check against common permission error keywords
  const matchingKeywords = PERMISSION_KEYWORDS.filter(keyword => 
    lowerError.includes(keyword.toLowerCase())
  );
  
  const isPermError = matchingKeywords.length > 0;
  
  // Additional specific checks for common token-related issues
  if (!isPermError) {
    const matchingPatterns = TOKEN_ERROR_PATTERNS.filter(pattern => pattern.test(error));
    if (matchingPatterns.length > 0) {
      console.log('🔍 Permission error detected via pattern match:', error);
      return true;
    }
  }
  
  if (isPermError) {
    console.log('🔍 Permission error detected via keywords:', matchingKeywords);
  }
  
  return isPermError;
}

/**
 * Check if upsell modal has been shown for this platform/token combination
 */
export function hasShownUpsell(platform: string, token: string): boolean {
  try {
    const key = `upsell_shown_${token}`;
    const stored = localStorage.getItem(key);
    
    if (!stored) return false;
    
    const { timestamp, platform: storedPlatform } = JSON.parse(stored);
    
    // Expire after 5 minutes
    const age = Date.now() - timestamp;
    const maxAge = CACHE_TTL.SHORT_MS;
    
    if (age > maxAge) {
      localStorage.removeItem(key);
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Mark that upsell modal has been shown for this platform/token combination
 */
export function markUpsellShown(platform: string, token: string): void {
  try {
    const key = `upsell_shown_${token}`;
    const data = {
      timestamp: Date.now(),
      token,
      platform
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to mark upsell as shown:', error);
  }
}


/**
 * Check if user is returning from incremental auth
 */
export function isReturningFromIncrementalAuth(currentState?: { token?: string; profileId?: string; timestamp?: number }): boolean {
  console.log('🔍 Auth check: Checking if returning from incremental auth...');
  
  const urlParams = new URLSearchParams(window.location.search);
  const authResult = urlParams.get('incremental_auth');
  
  console.log('🔍 Auth check: URL params:', Object.fromEntries(urlParams.entries()));
  console.log('🔍 Auth check: Auth result param:', authResult);
  
  // Check if we have URL params indicating return from auth
  const hasAuthParams = authResult === 'success' || authResult === 'denied';
  console.log('🔍 Auth check: Has auth params:', hasAuthParams);
  
  if (hasAuthParams) {
    console.log('🔍 Auth check: Detected auth return via URL params');
    return true;
  }
  
  // Check if we have RECENT stored state (indicating user just went through auth flow)
  console.log('🔍 Auth check: Stored state:', currentState);
  
  if (currentState && currentState.token && currentState.profileId && currentState.timestamp) {
    // Only consider it a "return from auth" if the stored state is very recent (within last 2 minutes)
    const authReturnWindow = 2 * 60 * 1000; // 2 minutes
    const age = Date.now() - currentState.timestamp;
    console.log('🔍 Auth check: State age:', age, 'ms (auth return window:', authReturnWindow, 'ms)');
    
    if (age <= authReturnWindow) {
      console.log('🔍 Auth check: Recent stored state detected - likely returning from auth');
      return true;
    } else {
      console.log('🔍 Auth check: Stored state too old to be considered auth return');
      return false;
    }
  }
  
  console.log('🔍 Auth check: No evidence of auth return - proceeding with fresh flow');
  return false;
}

/**
 * Handle return from incremental auth
 */
export function handleIncrementalAuthReturn(existingState?: { token?: string; profileId?: string; timestamp?: number }): { success: boolean; contactSaveToken?: string; profileId?: string; denied?: boolean } {
  console.log('🔍 Auth return: Starting handleIncrementalAuthReturn...');
  
  const urlParams = new URLSearchParams(window.location.search);
  const authResult = urlParams.get('incremental_auth');
  
  console.log('🔍 Auth return: Handling incremental auth return...');
  console.log('🔍 Auth return: Auth result:', authResult);
  console.log('🔍 Auth return: Current URL:', window.location.href);
  console.log('🔍 Auth return: URL params:', Object.fromEntries(urlParams.entries()));
  
  if (authResult === 'success') {
    console.log('🔍 Auth return: Success result detected');
    const contactSaveToken = urlParams.get('contact_save_token') || undefined;
    const profileId = urlParams.get('profile_id') || undefined;
    
    console.log('🔍 Auth return: Success return parameters:', { contactSaveToken, profileId });
    
    // Clean up URL parameters
    const url = new URL(window.location.href);
    url.searchParams.delete('incremental_auth');
    url.searchParams.delete('contact_save_token');
    url.searchParams.delete('profile_id');
    window.history.replaceState({}, document.title, url.toString());
    
    console.log('🔍 Auth return: Cleaned URL:', url.toString());
    
    return { success: true, contactSaveToken, profileId };
  }
  
  if (authResult === 'denied') {
    console.log('🔍 Auth return: Denied result detected');
    console.log('🚫 User denied Google Contacts permission');
    
    // Clean up URL
    const url = new URL(window.location.href);
    url.searchParams.delete('incremental_auth');
    window.history.replaceState({}, document.title, url.toString());
    
    console.log('🔍 Auth return: Cleaned URL after denial:', url.toString());
    
    return { success: false, denied: true };
  }
  
  // If no URL params but we have stored state, user likely tapped back
  console.log('🔍 Auth return: No URL params, checking stored state...');
  console.log('🔍 Auth return: Existing state:', existingState);
  
  if (existingState && existingState.token && existingState.profileId && existingState.timestamp) {
    // Only treat as "tapped back" if the stored state is very recent (within last 2 minutes)
    const backButtonWindow = 2 * 60 * 1000; // 2 minutes
    const age = Date.now() - existingState.timestamp;
    console.log('🔍 Auth return: State age:', age, 'ms (back button window:', backButtonWindow, 'ms)');
    
    if (age <= backButtonWindow) {
      console.log('🔙 No URL params but have recent stored state - user likely tapped back on auth');
      console.log('🔍 Auth return: Stored state:', existingState);
      
      // Return the stored state as a "cancelled" auth
      return { 
        success: false, 
        denied: true, 
        contactSaveToken: existingState.token, 
        profileId: existingState.profileId 
      };
    } else {
      console.log('🔍 Auth return: Stored state too old to be considered back button - treating as no auth');
    }
  }
  
  console.log('🔍 Auth return: No auth return detected, returning empty result');
  return { success: false };
}


/**
 * Start incremental authorization with Google for contacts scope
 * Simplified to redirect-only flow to avoid COOP issues
 */
export async function startIncrementalAuth(contactSaveToken: string, profileId: string): Promise<{ success: boolean; showUpsellModal?: boolean }> {
  console.log('🔄 Starting Google auth for contacts permission...');

  // Platform-specific optimization
  const userAgent = navigator.userAgent;
  const isAndroid = /android/i.test(userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isSafari = /safari/i.test(userAgent) && !/chrome/i.test(userAgent);
  const isInAppBrowser = /FBAN|FBAV|Instagram|LINE|Twitter/i.test(userAgent);

  let attempt = 'silent'; // Default desktop behavior

  if (isAndroid) {
    // Android: Skip silent attempt as it often fails
    attempt = 'explicit';
    console.log(`🤖 Android detected, using explicit flow`);
  } else if (isIOS) {
    // iOS: Different strategy based on browser context
    if (isInAppBrowser) {
      // In-app browsers on iOS have OAuth issues, go straight to explicit
      attempt = 'explicit';
      console.log(`📱 iOS in-app browser detected, using explicit flow`);
    } else if (isSafari) {
      // Safari on iOS: Try silent first (works better with Safari's session handling)
      attempt = 'silent';
      console.log(`🍎 iOS Safari detected, trying silent flow first`);
    } else {
      // Other iOS browsers (Chrome, Firefox): Go straight to explicit
      attempt = 'explicit';
      console.log(`📱 iOS non-Safari browser, using explicit flow`);
    }
  } else {
    // Desktop: Keep silent attempt
    console.log(`💻 Desktop detected, using silent flow`);
  }

  // Build auth URL using existing endpoint
  const authUrl = `/api/auth/google/incremental?returnUrl=${encodeURIComponent(window.location.href)}&contactSaveToken=${encodeURIComponent(contactSaveToken)}&profileId=${encodeURIComponent(profileId)}&attempt=${attempt}`;

  window.location.href = authUrl;

  // For redirects, we can't wait for completion, so return immediately
  return { success: false, showUpsellModal: false };
}