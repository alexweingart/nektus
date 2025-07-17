/**
 * Consolidated contact save service with all platform logic
 * Handles Firebase, Google Contacts, incremental auth, and platform-specific flows
 */

import { UserProfile } from '@/types/profile';
import { ContactSaveResult } from '@/types/contactExchange';
import { displayVCardInlineForIOS } from './vCardService';
import { detectPlatform as detectPlatformUtil } from '@/lib/utils/platformDetection';

// Constants for permission error detection
const PERMISSION_KEYWORDS = [
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

const TOKEN_ERROR_PATTERNS = [
  /no.*token.*available/i,
  /token.*not.*available/i,
  /missing.*token/i,
  /invalid.*token/i,
  /expired.*token/i,
  /token.*required/i,
  /no.*access.*token/i
];

const EMBEDDED_BROWSER_INDICATORS = [
  'gsa/', 'googleapp', 'fb', 'fban', 'fbav', 'instagram', 'twitter', 'line/', 'wechat', 'weibo', 'webview', 'chrome-mobile'
];

export interface ContactSaveFlowResult {
  success: boolean;
  firebase: { success: boolean; error?: string };
  google: { success: boolean; error?: string; contactId?: string };
  showUpsellModal?: boolean;
  showSuccessModal?: boolean;
  platform: 'android' | 'ios' | 'web';
}

/**
 * Platform detection using shared utility
 */
function detectPlatform(): 'android' | 'ios' | 'web' {
  return (detectPlatformUtil().platform || 'web') as 'android' | 'ios' | 'web';
}

/**
 * Check if this is the first time showing upsell modal on iOS (legacy - keep for existing iOS Safari users)
 */
function isFirstTimeIOSUpsell(): boolean {
  try {
    const hasShownBefore = localStorage.getItem('ios_upsell_shown');
    return !hasShownBefore;
  } catch {
    return true;
  }
}

/**
 * Mark that the iOS upsell modal has been shown (legacy - keep for existing iOS Safari users)
 */
function markIOSUpsellShown(): void {
  try {
    localStorage.setItem('ios_upsell_shown', 'true');
  } catch {
    // Silently fail if localStorage is not available
  }
}

/**
 * Check if upsell modal has been shown for this exchange token
 */
function hasShownUpsellForToken(token: string): boolean {
  try {
    const key = `upsell_shown_${token}`;
    const shownData = localStorage.getItem(key);
    if (!shownData) {
      return false;
    }
    
    const { timestamp } = JSON.parse(shownData);
    // Expire after 15 minutes (longer than exchange token TTL)
    const maxAge = 15 * 60 * 1000; // 15 minutes
    const age = Date.now() - timestamp;
    
    if (age > maxAge) {
      // Clean up expired entry
      localStorage.removeItem(key);
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Mark that upsell modal has been shown for this exchange token
 */
function markUpsellShownForToken(token: string): void {
  try {
    const key = `upsell_shown_${token}`;
    const data = {
      timestamp: Date.now(),
      token
    };
    localStorage.setItem(key, JSON.stringify(data));
    console.log('📝 Marked upsell as shown for token:', token);
  } catch (error) {
    console.warn('Failed to mark upsell as shown:', error);
  }
}

/**
 * Clear upsell tracking for a specific token (cleanup)
 */
function clearUpsellTrackingForToken(token: string): void {
  try {
    const key = `upsell_shown_${token}`;
    localStorage.removeItem(key);
    console.log('🗑️ Cleared upsell tracking for token:', token);
  } catch (error) {
    console.warn('Failed to clear upsell tracking:', error);
  }
}

/**
 * Clean up all expired upsell tracking entries (housekeeping)
 */
function cleanupExpiredUpsellTracking(): void {
  try {
    const keysToRemove: string[] = [];
    const maxAge = 15 * 60 * 1000; // 15 minutes
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('upsell_shown_')) {
        try {
          const data = localStorage.getItem(key);
          if (data) {
            const { timestamp } = JSON.parse(data);
            const age = Date.now() - timestamp;
            if (age > maxAge) {
              keysToRemove.push(key);
            }
          }
        } catch {
          // Invalid data, mark for removal
          keysToRemove.push(key);
        }
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    if (keysToRemove.length > 0) {
      console.log('🧹 Cleaned up', keysToRemove.length, 'expired upsell tracking entries');
    }
  } catch (error) {
    console.warn('Failed to cleanup expired upsell tracking:', error);
  }
}

/**
 * Check if the error is related to missing Google Contacts permissions
 */
function isPermissionError(error?: string): boolean {
  if (!error) {
    console.log('🔍 Permission check: No error provided');
    return false;
  }
  
  console.log('🔍 Permission check: Raw error:', JSON.stringify(error));
  console.log('🔍 Permission check: Error type:', typeof error);
  console.log('🔍 Permission check: Error length:', error.length);
  
  // Check against common permission error keywords
  
  const lowerError = error.toLowerCase();
  console.log('🔍 Permission check: Lowercase error:', JSON.stringify(lowerError));
  
  // Check each keyword individually for debugging
  const matchingKeywords = PERMISSION_KEYWORDS.filter(keyword => 
    lowerError.includes(keyword.toLowerCase())
  );
  console.log('🔍 Permission check: Matching keywords:', matchingKeywords);
  
  const isPermError = matchingKeywords.length > 0;
  
  // Additional specific checks for common token-related issues
  if (!isPermError) {
    console.log('🔍 Permission check: No keyword matches, checking regex patterns...');
    
    // Check for specific patterns that indicate permission issues
    const matchingPatterns = TOKEN_ERROR_PATTERNS.filter(pattern => pattern.test(error));
    console.log('🔍 Permission check: Matching patterns:', matchingPatterns.length);
    
    if (matchingPatterns.length > 0) {
      console.log('🔍 Permission check: Found token-related pattern match');
      return true;
    }
  }
  
  console.log('🔍 Permission check: Final result:', isPermError);
  return isPermError;
}

/**
 * Store contact save state (for auth flow continuity)
 */
function storeContactSaveState(token: string, profileId: string): void {
  try {
    const state = {
      token,
      profileId,
      timestamp: Date.now()
    };
    localStorage.setItem('contact_save_state', JSON.stringify(state));
    console.log('💾 Stored contact save state:', state);
  } catch (error) {
    console.warn('Failed to store contact save state:', error);
  }
}

/**
 * Get contact save state (with expiration check)
 */
function getContactSaveState(): { token?: string; profileId?: string; timestamp?: number } {
  try {
    const stored = localStorage.getItem('contact_save_state');
    if (!stored) {
      console.log('🔍 State check: No stored state found');
      return {};
    }
    
    const state = JSON.parse(stored);
    console.log('🔍 State check: Raw stored state:', state);
    
    // Check if state is expired (5 minutes)
    const maxAge = 5 * 60 * 1000; // 5 minutes
    const age = Date.now() - (state.timestamp || 0);
    console.log('🔍 State check: State age:', age, 'ms (max:', maxAge, 'ms)');
    
    if (age > maxAge) {
      console.log('🗑️ State check: Stored state is expired, clearing...');
      clearContactSaveState();
      return {};
    }
    
    console.log('🔍 State check: Valid stored state found:', state);
    return state;
  } catch (error) {
    console.warn('Failed to get contact save state:', error);
    clearContactSaveState();
    return {};
  }
}

/**
 * Clear contact save state
 */
function clearContactSaveState(): void {
  try {
    localStorage.removeItem('contact_save_state');
    console.log('🗑️ Cleared contact save state');
  } catch (error) {
    console.warn('Failed to clear contact save state:', error);
  }
}

/**
 * Check if we're in an embedded browser (like in-app browsers)
 */
function isEmbeddedBrowser(): boolean {
  const userAgent = navigator.userAgent.toLowerCase();
  console.log('🔍 Browser detection: User agent:', userAgent);
  
  const isEmbedded = EMBEDDED_BROWSER_INDICATORS.some(indicator => userAgent.includes(indicator));
  console.log('🔍 Browser detection: Is embedded browser:', isEmbedded);
  console.log('🔍 Browser detection: Matching indicators:', EMBEDDED_BROWSER_INDICATORS.filter(indicator => userAgent.includes(indicator)));
  
  return isEmbedded;
}

/**
 * Check if the browser supports reliable popups
 */
function supportsReliablePopups(): boolean {
  const userAgent = navigator.userAgent.toLowerCase();
  console.log('🔍 Popup support: User agent:', userAgent);
  
  // Don't use popups for embedded browsers (they often block them)
  if (isEmbeddedBrowser()) {
    console.log('🔍 Popup support: Embedded browser detected, using redirect');
    return false;
  }
  
  // Use popups for standalone browsers
  console.log('🔍 Popup support: Standalone browser detected, using popup');
  return true;
}

/**
 * Redirect to Google for incremental authorization with contacts scope
 */
async function redirectToGoogleContactsAuth(contactSaveToken: string, profileId: string): Promise<{ success: boolean; showUpsellModal?: boolean }> {
  console.log('🔄 Starting Google auth for contacts permission...');
  
  // Determine whether to use popup or redirect based on browser capabilities
  const usePopup = supportsReliablePopups();
  
  if (usePopup) {
    // Use popup for standalone browsers (better cookie handling)
    const result = await openGoogleAuthPopup(contactSaveToken, profileId);
    return result;
  } else {
    // Use redirect for embedded browsers (more reliable)
    redirectToGoogleAuth(contactSaveToken, profileId);
    // For redirects, we can't wait for completion, so return immediately
    return { success: false, showUpsellModal: false };
  }
}

/**
 * Open Google auth in a popup (for standalone browsers)
 */
function openGoogleAuthPopup(contactSaveToken: string, profileId: string): Promise<{ success: boolean; showUpsellModal?: boolean }> {
  return new Promise((resolve) => {
    // Build auth URL using existing endpoint
    const authUrl = `/api/auth/google-incremental?returnUrl=${encodeURIComponent(`${window.location.origin}/api/auth/google-incremental/popup-callback`)}&contactSaveToken=${encodeURIComponent(contactSaveToken)}&profileId=${encodeURIComponent(profileId)}&attempt=silent`;
    
    // Open popup for auth
    const popup = window.open(
      authUrl,
      'google-auth-popup',
      'width=500,height=600,scrollbars=yes,resizable=yes,status=yes'
    );

    if (!popup) {
      console.error('❌ Popup blocked! Falling back to redirect...');
      // Fallback to redirect if popup is blocked
      redirectToGoogleAuth(contactSaveToken, profileId);
      resolve({ success: false, showUpsellModal: false });
      return;
    }

    // Listen for popup completion
    listenForPopupCompletion(popup, contactSaveToken, profileId, resolve);
  });
}

/**
 * Redirect to Google auth in same tab (for embedded browsers)
 */
function redirectToGoogleAuth(contactSaveToken: string, profileId: string): void {
  console.log('🔄 Redirecting to Google for incremental contacts permission...');
  
  // Build auth URL using existing endpoint  
  const authUrl = `/api/auth/google-incremental?returnUrl=${encodeURIComponent(window.location.href)}&contactSaveToken=${encodeURIComponent(contactSaveToken)}&profileId=${encodeURIComponent(profileId)}&attempt=silent`;
  
  window.location.href = authUrl;
}

/**
 * Listen for popup completion and handle the auth result
 */
function listenForPopupCompletion(
  popup: Window, 
  contactSaveToken: string, 
  profileId: string, 
  resolve: (value: { success: boolean; showUpsellModal?: boolean }) => void
): void {
  const messageHandler = (event: MessageEvent) => {
    // Verify origin for security
    if (event.origin !== window.location.origin) {
      return;
    }

    // Check if this is our auth completion message
    if (event.data?.type === 'GOOGLE_AUTH_COMPLETE') {
      console.log('🎉 Received popup auth completion:', event.data);
      
      // Clean up
      clearInterval(checkClosed);
      window.removeEventListener('message', messageHandler);
      popup.close();

      // Handle the auth result
      if (event.data.success) {
        // Auth was successful - the OAuth flow completed and token is stored
        // Use the contactSaveToken and profileId from the message (they should match the parameters)
        const tokenToUse = event.data.contactSaveToken || contactSaveToken;
        const profileIdToUse = event.data.profileId || profileId;
        handlePopupAuthSuccess(tokenToUse, profileIdToUse);
        resolve({ success: true });
      } else {
        console.error('❌ Popup auth failed:', event.data.error, event.data.message);
        console.log('🚫 Popup auth failed, showing upsell modal');
        resolve({ success: false, showUpsellModal: true });
      }
    }
  };

  // Listen for postMessage from popup
  window.addEventListener('message', messageHandler);

  // Check if popup is closed manually (user cancellation)
  const checkClosed = setInterval(() => {
    if (popup.closed) {
      clearInterval(checkClosed);
      window.removeEventListener('message', messageHandler);
      console.log('ℹ️ Popup was closed by user, showing upsell modal');
      resolve({ success: false, showUpsellModal: true });
    }
  }, 1000);
}

/**
 * Handle successful popup auth completion
 */
async function handlePopupAuthSuccess(contactSaveToken: string, profileId: string): Promise<void> {
  try {
    console.log('🔄 Retrying Google Contacts save after popup auth...');
    
    // Retry the Google Contacts save
    const result = await callSaveContactAPI(contactSaveToken, { googleOnly: true });
    
    if (result.success) {
      console.log('✅ Contact saved to Google after popup auth!');
      // Could trigger a success notification here
      
      // Trigger page refresh or update UI to show success
      window.location.reload();
         } else {
       console.error('❌ Contact save still failed after popup auth:', result.google.error || 'Unknown error');
     }
  } catch (error) {
    console.error('❌ Error during post-popup contact save:', error);
  }
}


/**
 * Helper function to call save-contact API with different options
 */
async function callSaveContactAPI(token: string, options: { skipGoogleContacts?: boolean; skipFirebase?: boolean; googleOnly?: boolean } = {}): Promise<ContactSaveResult> {
  const response = await fetch('/api/save-contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, ...options })
  });

  const result = await response.json();
  
  if (!response.ok) {
    // For Google-only calls, check if we have a specific error message
    if (options.googleOnly && result.google?.error) {
      console.warn('⚠️ Google Contacts save failed with specific error:', result.google.error);
      return result; // Return the result with the specific error instead of throwing
    }
    throw new Error(`API request failed: ${response.status}`);
  }

  return result;
}

/**
 * Check if user is returning from incremental auth
 */
function isReturningFromIncrementalAuth(): boolean {
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
  const storedState = getContactSaveState();
  console.log('🔍 Auth check: Stored state:', storedState);
  
  if (storedState && storedState.token && storedState.profileId && storedState.timestamp) {
    // Only consider it a "return from auth" if the stored state is very recent (within last 2 minutes)
    const authReturnWindow = 2 * 60 * 1000; // 2 minutes
    const age = Date.now() - storedState.timestamp;
    console.log('🔍 Auth check: State age:', age, 'ms (auth return window:', authReturnWindow, 'ms)');
    
    if (age <= authReturnWindow) {
      console.log('🔍 Auth check: Recent stored state detected - likely returning from auth');
      return true;
    } else {
      console.log('🔍 Auth check: Stored state too old to be considered auth return');
      // Clear old stored state since it's not relevant anymore
      clearContactSaveState();
      return false;
    }
  }
  
  console.log('🔍 Auth check: No evidence of auth return - proceeding with fresh flow');
  return false;
}

/**
 * Handle return from incremental auth
 */
function handleIncrementalAuthReturn(): { success: boolean; contactSaveToken?: string; profileId?: string; denied?: boolean } {
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
  const existingState = getContactSaveState();
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
      console.log('🔍 Auth return: Stored state too old to be considered back button - clearing and treating as no auth');
      clearContactSaveState();
    }
  }
  
  console.log('🔍 Auth return: No auth return detected, returning empty result');
  return { success: false };
}

/**
 * Export browser detection for testing (accessible in browser console)
 */
export function debugBrowserDetection() {
  if (typeof window === 'undefined') {
    console.log('❌ Not in browser environment');
    return;
  }
  
  const embedded = isEmbeddedBrowser();
  const popupSupport = supportsReliablePopups();
  
  console.log('🔍 Browser Detection Debug:', {
    userAgent: navigator.userAgent,
    isEmbedded: embedded,
    supportsPopups: popupSupport,
    recommendedMethod: popupSupport ? 'popup' : 'redirect'
  });
  
  return {
    userAgent: navigator.userAgent,
    isEmbedded: embedded,
    supportsPopups: popupSupport,
    recommendedMethod: popupSupport ? 'popup' : 'redirect'
  };
}

// Make debug function available in browser console for testing
if (typeof window !== 'undefined') {
  (window as any).debugBrowserDetection = debugBrowserDetection;
}

/**
 * Main contact save flow with all platform logic
 */
export async function saveContactFlow(
  profile: UserProfile, 
  token: string
): Promise<ContactSaveFlowResult> {
  console.log('🔍 Flow: Starting saveContactFlow...');
  console.log('🔍 Flow: Profile:', profile.name);
  console.log('🔍 Flow: Token:', token);
  console.log('🔍 Flow: Current URL:', window.location.href);
  
  // Clean up any expired upsell tracking entries
  cleanupExpiredUpsellTracking();
  
  const platform = detectPlatform();
  console.log('🔍 Flow: Platform detected:', platform);
  
  // Clear any stale stored state before checking for auth returns
  console.log('🔍 Flow: Checking for stale stored state...');
  const currentState = getContactSaveState(); // This will auto-clear if expired
  if (currentState && currentState.token && currentState.profileId) {
    console.log('🔍 Flow: Found stored state, will check if it\'s a recent auth return');
  } else {
    console.log('🔍 Flow: No stored state found, proceeding with fresh flow');
  }
  
  // Check if we're returning from incremental auth
  console.log('🔍 Flow: Checking if returning from incremental auth...');
  const isReturning = isReturningFromIncrementalAuth();
  console.log('🔍 Flow: Is returning from auth:', isReturning);
  
  if (isReturning) {
    console.log('🔍 Flow: Processing auth return...');
    const authReturn = handleIncrementalAuthReturn();
    console.log('🔍 Flow: Auth return result:', authReturn);
    
    if (authReturn.success && authReturn.contactSaveToken && authReturn.profileId === profile.userId) {
      console.log('🔄 Detected successful return from incremental auth');
      console.log('ℹ️ Firebase was already saved, now trying Google Contacts with new permission');
      
      // Clear saved state since we're handling the return
      clearContactSaveState();
      
      // Try Google Contacts save only (Firebase was already saved before we went to auth)
      try {
        console.log('🔄 Attempting Google Contacts save with new token...');
        const googleSaveResult = await callSaveContactAPI(authReturn.contactSaveToken, { googleOnly: true });
        console.log('🔍 Google save result after auth:', JSON.stringify(googleSaveResult, null, 2));
        
        if (googleSaveResult.google.success) {
          console.log('✅ Google Contacts save successful after auth!');
          // Clear upsell tracking since the exchange was successful
          clearUpsellTrackingForToken(token);
          return {
            success: true,
            firebase: { success: true }, // Firebase was saved before auth
            google: googleSaveResult.google,
            showSuccessModal: true,
            platform
          };
        } else {
          console.warn('⚠️ Google Contacts save still failed after auth');
          
          // Only show upsell modal if we haven't shown it for this token yet
          if (!hasShownUpsellForToken(token)) {
            console.log('🆕 Auth return: First time showing upsell for this exchange, showing modal');
            markUpsellShownForToken(token);
            return {
              success: true,
              firebase: { success: true }, // Firebase was saved before auth
              google: googleSaveResult.google,
              showUpsellModal: true,
              platform
            };
          } else {
            console.log('🔁 Auth return: Upsell already shown for this exchange, showing success instead');
            return {
              success: true,
              firebase: { success: true }, // Firebase was saved before auth
              google: googleSaveResult.google,
              showSuccessModal: true,
              platform
            };
          }
        }
      } catch (error) {
        console.error('❌ Google Contacts save failed after auth:', error);
        
        // Only show upsell modal if we haven't shown it for this token yet
        if (!hasShownUpsellForToken(token)) {
          console.log('🆕 Auth error: First time showing upsell for this exchange, showing modal');
          markUpsellShownForToken(token);
          return {
            success: true,
            firebase: { success: true }, // Firebase was saved before auth
            google: { 
              success: false, 
              error: error instanceof Error ? error.message : 'Google save failed after auth' 
            },
            showUpsellModal: true,
            platform
          };
        } else {
          console.log('🔁 Auth error: Upsell already shown for this exchange, showing success instead');
          return {
            success: true,
            firebase: { success: true }, // Firebase was saved before auth
            google: { 
              success: false, 
              error: error instanceof Error ? error.message : 'Google save failed after auth' 
            },
            showSuccessModal: true,
            platform
          };
        }
      }
    } else if (authReturn.denied) {
      console.log('🔍 Flow: User denied or cancelled auth');
      console.log('🚫 User denied Google Contacts permission');
      // Clear saved state
      clearContactSaveState();
      
      // Only show upsell modal if we haven't shown it for this token yet
      if (!hasShownUpsellForToken(token)) {
        console.log('🆕 Auth denied: First time showing upsell for this exchange, showing modal');
        markUpsellShownForToken(token);
        return {
          success: true,
          firebase: { success: true }, // Firebase was saved before auth
          google: { success: false, error: 'User denied permission' },
          showUpsellModal: true,
          platform
        };
      } else {
        console.log('🔁 Auth denied: Upsell already shown for this exchange, showing success instead');
        return {
          success: true,
          firebase: { success: true }, // Firebase was saved before auth
          google: { success: false, error: 'User denied permission' },
          showSuccessModal: true,
          platform
        };
      }
    } else {
      console.log('🔍 Flow: Auth return but conditions not met');
      // User returned from auth but didn't complete it (e.g., tapped back button)
      console.log('🔙 User returned from auth without completing (likely tapped back)');
      console.log('🔍 Conditions check:', {
        hasSuccess: authReturn.success,
        hasContactSaveToken: !!authReturn.contactSaveToken,
        profileIdMatch: authReturn.profileId === profile.userId,
        authProfileId: authReturn.profileId,
        expectedProfileId: profile.userId
      });
      
      // Clear saved state
      clearContactSaveState();
      
      // Only show upsell modal if we haven't shown it for this token yet
      if (!hasShownUpsellForToken(token)) {
        console.log('🆕 Auth incomplete: First time showing upsell for this exchange, showing modal');
        markUpsellShownForToken(token);
        return {
          success: true,
          firebase: { success: true }, // Firebase was saved before auth
          google: { success: false, error: 'User cancelled Google auth' },
          showUpsellModal: true,
          platform
        };
      } else {
        console.log('🔁 Auth incomplete: Upsell already shown for this exchange, showing success instead');
        return {
          success: true,
          firebase: { success: true }, // Firebase was saved before auth
          google: { success: false, error: 'User cancelled Google auth' },
          showSuccessModal: true,
          platform
        };
      }
    }
  } else {
    console.log('🔍 Flow: Not returning from incremental auth, proceeding with normal flow');
  }

  try {
    // Step 1: Always save to Firebase first (immediate success feedback)
    console.log('🔄 Saving to Firebase first...');
    const firebaseResult = await callSaveContactAPI(token, { skipGoogleContacts: true });
    
    if (!firebaseResult.firebase.success) {
      console.error('❌ Firebase save failed');
      return {
        success: false,
        firebase: firebaseResult.firebase,
        google: { success: false, error: 'Firebase save failed' },
        platform
      };
    }

    console.log('✅ Firebase save successful - contact is saved!');

    // Step 2: Try Google Contacts separately (this can fail without affecting Firebase success)
    console.log('🔄 Now attempting Google Contacts save...');
    let googleResult;
    
    try {
      const googleSaveResult = await callSaveContactAPI(token, { googleOnly: true });
      googleResult = googleSaveResult.google;
      console.log('📊 Google Contacts save result:', JSON.stringify(googleResult, null, 2));
      console.log('🔍 Client: Google result success:', googleResult.success);
      console.log('🔍 Client: Google result error:', googleResult.error);
    } catch (error) {
      console.warn('⚠️ Google Contacts save failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Google Contacts save failed';
      console.log('📊 Google Contacts error details:', errorMessage);
      googleResult = { 
        success: false, 
        error: errorMessage 
      };
    }

    console.log('🔍 Client: Platform detected as:', platform);
    console.log('🔍 Client: About to enter platform-specific logic...');

    // Step 3: Platform-specific logic for Google Contacts
    
    // iOS Safari/Chrome Flow (traditional vCard) - the only truly different platform
    if (platform === 'ios' && !isEmbeddedBrowser()) {
      console.log('🍎 iOS Safari flow: displaying vCard inline');
      
      // Try to show vCard inline for Safari
      try {
        await displayVCardInlineForIOS(profile);
      } catch (error) {
        console.warn('Failed to display vCard inline for iOS Safari:', error);
      }
      
      // Determine modal to show based on global first-time status (iOS Safari = once EVER)
      let shouldShowUpsellModal = false;
      
      if (isFirstTimeIOSUpsell()) {
        // First time EVER saving on iOS Safari - show upsell to encourage Google account connection
        console.log('🆕 iOS Safari: First time EVER showing upsell, showing modal');
        markIOSUpsellShown();
        shouldShowUpsellModal = true;
      } else {
        // Already shown upsell before - always show success modal
        console.log('🔁 iOS Safari: Upsell already shown before, showing success instead');
        shouldShowUpsellModal = false;
      }
      
      // Clear upsell tracking if showing success modal (Firebase saved successfully)
      if (!shouldShowUpsellModal) {
        clearUpsellTrackingForToken(token);
      }
      
      return {
        success: true,
        firebase: firebaseResult.firebase,
        google: googleResult,
        showUpsellModal: shouldShowUpsellModal,
        showSuccessModal: !shouldShowUpsellModal,
        platform
      };
    }

    // All other platforms (Android, iOS Embedded, Web/Desktop) - unified logic
    console.log(`🔍 ${platform} flow: using unified Google Contacts approach`);
    
    if (googleResult.success) {
      // Both Firebase and Google Contacts saved successfully
      console.log(`✅ Both Firebase and Google Contacts saved on ${platform}`);
      // Clear upsell tracking since the exchange was successful
      clearUpsellTrackingForToken(token);
      return {
        success: true,
        firebase: firebaseResult.firebase,
        google: googleResult,
        showSuccessModal: true,
        platform
      };
    } else {
      // Check if this is a permission error
      console.log(`🔍 ${platform}: Google Contacts save failed, checking if permission-related...`);
      console.log(`🔍 ${platform}: Error string:`, googleResult.error);
      
      const isPermError = isPermissionError(googleResult.error);
      console.log(`🔍 ${platform}: isPermissionError result:`, isPermError);
      
      if (isPermError && (platform === 'android' || platform === 'ios')) {
        // Only Android and iOS embedded can do incremental auth
        console.log(`⚠️ ${platform}: Google Contacts permission error detected, redirecting to auth`);
        console.log(`ℹ️ ${platform}: Firebase is already saved, just need Google permission`);
        
        // Store state for when we return
        storeContactSaveState(token, profile.userId || '');
        
        // Redirect to Google auth for contacts permission
        const authResult = await redirectToGoogleContactsAuth(token, profile.userId || '');
        
        console.log(`🔍 ${platform}: Auth result:`, authResult);
        
        if (authResult.showUpsellModal) {
          console.log(`🚫 ${platform}: User closed popup or auth failed`);
          
          // Only show upsell modal if we haven't shown it for this token yet
          if (!hasShownUpsellForToken(token)) {
            console.log(`🆕 ${platform}: First time showing upsell for this exchange, showing modal`);
            markUpsellShownForToken(token);
            return {
              success: true,
              firebase: firebaseResult.firebase,
              google: { success: false, error: 'User closed auth popup' },
              showUpsellModal: true,
              platform
            };
          } else {
            console.log(`🔁 ${platform}: Upsell already shown for this exchange, showing success instead`);
            return {
              success: true,
              firebase: firebaseResult.firebase,
              google: { success: false, error: 'User closed auth popup' },
              showSuccessModal: true,
              platform
            };
          }
        } else {
          console.log(`🔍 ${platform}: Auth redirect completed, returning redirect result...`);
          // For redirects, the user will be taken to auth page
          return {
            success: true,
            firebase: firebaseResult.firebase,
            google: { success: false, error: 'Redirecting for permissions...' },
            platform
          };
        }
      } else {
        // Other error (non-permission error, or web platform) - show upsell modal (Firebase is still saved!)
        console.log(`❌ ${platform}: Google Contacts save failed with non-permission error or platform doesn't support auth`);
        console.log(`ℹ️ ${platform}: Contact is saved to Firebase, just not Google Contacts`);
        
        // Only show upsell modal if we haven't shown it for this token yet
        if (!hasShownUpsellForToken(token)) {
          console.log(`🆕 ${platform}: First time showing upsell for this exchange, showing modal`);
          markUpsellShownForToken(token);
          return {
            success: true,
            firebase: firebaseResult.firebase,
            google: googleResult,
            showUpsellModal: true,
            platform
          };
        } else {
          console.log(`🔁 ${platform}: Upsell already shown for this exchange, showing success instead`);
          return {
            success: true,
            firebase: firebaseResult.firebase,
            google: googleResult,
            showSuccessModal: true,
            platform
          };
        }
      }
    }
  } catch (error) {
    console.error(`❌ Contact save flow failed for ${platform}:`, error);
    return {
      success: false,
      firebase: { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      google: { success: false, error: 'Save process failed' },
      platform
    };
  }
}

/**
 * Handle upsell modal retry (when user clicks "OK! I'll do that")
 */
export async function retryGoogleContactsPermission(
  profile: UserProfile,
  token: string
): Promise<{ success: boolean; showSuccessModal?: boolean }> {
  console.log('🔄 Retrying Google Contacts save...');
  console.log('ℹ️ Contact is already in Firebase, just trying Google Contacts again');
  
  try {
    const platform = detectPlatform();
    const isEmbedded = isEmbeddedBrowser();
    
    if (platform === 'android' || (platform === 'ios' && isEmbedded)) {
      // Store state for when we return
      storeContactSaveState(token, profile.userId || '');
      
      // Redirect to Google auth for contacts permission
      const authResult = await redirectToGoogleContactsAuth(token, profile.userId || '');
      
      if (authResult.showUpsellModal) {
        console.log('🚫 Retry: User closed popup or auth failed');
        return { success: false };
      } else {
        // This won't execute due to redirect
        return { success: true };
      }
    } else {
      // For other platforms (iOS Safari, web), just try Google Contacts save only
      try {
        const googleSaveResult = await callSaveContactAPI(token, { googleOnly: true });
        
        return {
          success: googleSaveResult.google.success,
          showSuccessModal: true
        };
      } catch (error) {
        console.error('❌ Google Contacts retry failed:', error);
        return { success: false };
      }
    }
  } catch (error) {
    console.error('❌ Retry Google Contacts save failed:', error);
    return { success: false };
  }
}