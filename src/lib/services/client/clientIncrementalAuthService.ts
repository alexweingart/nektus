/**
 * Client-side incremental authorization service for Google OAuth
 * Handles popup/redirect flows, state management, and upsell tracking
 */

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

const EMBEDDED_BROWSER_INDICATORS = [
  'gsa/', 'googleapp', 'fb', 'fban', 'fbav', 'instagram', 'twitter', 'line/', 'wechat', 'weibo', 'webview', 'chrome-mobile'
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
    
    // iOS Safari entries never expire (less noisy)
    if (storedPlatform === 'ios_safari') {
      return true;
    }
    
    // Other platforms expire after 15 minutes
    const age = Date.now() - timestamp;
    const maxAge = 15 * 60 * 1000; // 15 minutes
    
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
 * Store contact save state (for auth flow continuity)
 */
export function storeContactSaveState(token: string, profileId: string): void {
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
export function getContactSaveState(): { token?: string; profileId?: string; timestamp?: number } {
  try {
    const stored = localStorage.getItem('contact_save_state');
    if (!stored) {
      return {};
    }
    
    const state = JSON.parse(stored);
    
    // Check if state is expired (5 minutes)
    const maxAge = 5 * 60 * 1000; // 5 minutes
    const age = Date.now() - (state.timestamp || 0);
    
    if (age > maxAge) {
      clearContactSaveState();
      return {};
    }
    
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
export function clearContactSaveState(): void {
  try {
    localStorage.removeItem('contact_save_state');
  } catch (error) {
    console.warn('Failed to clear contact save state:', error);
  }
}

/**
 * Check if we're in an embedded browser (like in-app browsers)
 */
export function isEmbeddedBrowser(): boolean {
  const userAgent = navigator.userAgent.toLowerCase();
  return EMBEDDED_BROWSER_INDICATORS.some(indicator => userAgent.includes(indicator));
}

/**
 * Check if the browser supports reliable popups
 */
export function supportsReliablePopups(): boolean {
  // Don't use popups for embedded browsers (they often block them)
  return !isEmbeddedBrowser();
}

/**
 * Check if user is returning from incremental auth
 */
export function isReturningFromIncrementalAuth(): boolean {
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
export function handleIncrementalAuthReturn(): { success: boolean; contactSaveToken?: string; profileId?: string; denied?: boolean } {
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
 * Open Google auth in a popup (for standalone browsers)
 */
function popupIncrementalAuth(contactSaveToken: string, profileId: string): Promise<{ success: boolean; showUpsellModal?: boolean }> {
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
      redirectIncrementalAuth(contactSaveToken, profileId);
      resolve({ success: false, showUpsellModal: false });
      return;
    }

    // Listen for popup completion via postMessage
    const messageHandler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data?.type === 'GOOGLE_AUTH_COMPLETE') {
        clearInterval(checkClosed);
        window.removeEventListener('message', messageHandler);
        popup.close();
        
        if (event.data.success) {
          resolve({ success: true });
        } else {
          resolve({ success: false, showUpsellModal: true });
        }
      }
    };
    
    window.addEventListener('message', messageHandler);
    
    // Check if popup is closed manually
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener('message', messageHandler);
        resolve({ success: false, showUpsellModal: true });
      }
    }, 1000);
  });
}

/**
 * Redirect to Google auth in same tab (for embedded browsers)
 */
function redirectIncrementalAuth(contactSaveToken: string, profileId: string): void {
  console.log('🔄 Redirecting to Google for incremental contacts permission...');
  
  // Build auth URL using existing endpoint  
  const authUrl = `/api/auth/google-incremental?returnUrl=${encodeURIComponent(window.location.href)}&contactSaveToken=${encodeURIComponent(contactSaveToken)}&profileId=${encodeURIComponent(profileId)}&attempt=silent`;
  
  window.location.href = authUrl;
}

/**
 * Redirect to Google for incremental authorization with contacts scope
 */
export async function startIncrementalAuth(contactSaveToken: string, profileId: string): Promise<{ success: boolean; showUpsellModal?: boolean }> {
  console.log('🔄 Starting Google auth for contacts permission...');
  
  // Determine whether to use popup or redirect based on browser capabilities
  const usePopup = supportsReliablePopups();
  
  if (usePopup) {
    // Use popup for standalone browsers (better cookie handling)
    const result = await popupIncrementalAuth(contactSaveToken, profileId);
    return result;
  } else {
    // Use redirect for embedded browsers (more reliable)
    redirectIncrementalAuth(contactSaveToken, profileId);
    // For redirects, we can't wait for completion, so return immediately
    return { success: false, showUpsellModal: false };
  }
}