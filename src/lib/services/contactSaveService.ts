/**
 * Consolidated contact save service with all platform logic
 * Handles Firebase, Google Contacts, incremental auth, and platform-specific flows
 */

import { UserProfile } from '@/types/profile';
import { ContactSaveResult } from '@/types/contactExchange';
import { displayVCardInlineForIOS } from './vCardService';

export interface ContactSaveFlowResult {
  success: boolean;
  firebase: { success: boolean; error?: string };
  google: { success: boolean; error?: string; contactId?: string };
  showUpsellModal?: boolean;
  showSuccessModal?: boolean;
  platform: 'android' | 'ios' | 'web';
}

/**
 * Simple platform detection
 */
function detectPlatform(): 'android' | 'ios' | 'web' {
  if (typeof window === 'undefined') return 'web';
  
  const userAgent = navigator.userAgent.toLowerCase();
  if (/android/.test(userAgent)) return 'android';
  if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
  return 'web';
}

/**
 * Check if this is the first time showing upsell modal on iOS
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
 * Mark that the iOS upsell modal has been shown
 */
function markIOSUpsellShown(): void {
  try {
    localStorage.setItem('ios_upsell_shown', 'true');
  } catch {
    // Silently fail if localStorage is not available
  }
}

/**
 * Check if the error is related to missing Google Contacts permissions
 */
function isPermissionError(error?: string): boolean {
  if (!error) return false;
  
  // Common permission error messages and HTTP status codes from Google API
  const permissionKeywords = [
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
    'Google Contacts API error: 403', // Specific format from our googleContactsService
    'Google Contacts API error: 401', // Unauthorized
    'Insufficient Permission',
    'Request had insufficient authentication scopes',
    'No Google Contacts access token available', // When no token is available
    'no google contacts access token', // Case variations
    'access token available',
    'access token',
    'token',
    'authentication'
  ];
  
  const lowerError = error.toLowerCase();
  const isPermError = permissionKeywords.some(keyword => lowerError.includes(keyword.toLowerCase()));
  
  // Additional specific checks for common token-related issues
  if (!isPermError) {
    // Check for specific patterns that indicate permission issues
    const tokenPatterns = [
      /no.*token.*available/i,
      /token.*not.*available/i,
      /missing.*token/i,
      /invalid.*token/i,
      /expired.*token/i,
      /token.*required/i
    ];
    
    return tokenPatterns.some(pattern => pattern.test(error));
  }
  
  return isPermError;
}

/**
 * Store contact save state for resuming after authorization
 */
function storeContactSaveState(token: string, profileId: string): void {
  try {
    sessionStorage.setItem('contact_save_token', token);
    sessionStorage.setItem('contact_save_profile_id', profileId);
    sessionStorage.setItem('contact_save_timestamp', Date.now().toString());
  } catch {
    // Silently fail if sessionStorage is not available
  }
}

/**
 * Get stored contact save state
 */
function getContactSaveState(): { token?: string; profileId?: string; timestamp?: number } {
  try {
    const token = sessionStorage.getItem('contact_save_token') || undefined;
    const profileId = sessionStorage.getItem('contact_save_profile_id') || undefined;
    const timestampStr = sessionStorage.getItem('contact_save_timestamp');
    const timestamp = timestampStr ? parseInt(timestampStr, 10) : undefined;
    
    return { token, profileId, timestamp };
  } catch {
    return {};
  }
}

/**
 * Clear stored contact save state
 */
function clearContactSaveState(): void {
  try {
    sessionStorage.removeItem('contact_save_token');
    sessionStorage.removeItem('contact_save_profile_id');
    sessionStorage.removeItem('contact_save_timestamp');
  } catch {
    // Silently fail if sessionStorage is not available
  }
}

/**
 * Redirect to Google for incremental authorization with contacts scope
 */
function redirectToGoogleContactsAuth(contactSaveToken: string, profileId: string): void {
  // Use current URL as return URL
  const returnUrl = window.location.href;
  
  // Build incremental auth URL with required parameters (start with silent attempt)
  const authUrl = `/api/auth/google-incremental?returnUrl=${encodeURIComponent(returnUrl)}&contactSaveToken=${encodeURIComponent(contactSaveToken)}&profileId=${encodeURIComponent(profileId)}&attempt=silent`;
  
  console.log('🔄 Redirecting to Google for incremental contacts permission (silent attempt first):', authUrl);
  window.location.href = authUrl;
}

/**
 * Save contact to Firebase only
 */
async function saveContactToFirebase(token: string): Promise<ContactSaveResult> {
  const response = await fetch('/api/save-contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      token,
      skipGoogleContacts: true // Only save to Firebase
    })
  });

  if (!response.ok) {
    throw new Error(`Firebase save API request failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Save contact to Google Contacts only (assumes Firebase already done)
 */
async function saveContactToGoogleOnly(token: string): Promise<ContactSaveResult> {
  const response = await fetch('/api/save-contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      token,
      googleOnly: true // Only save to Google Contacts
    })
  });

  // Read the response body regardless of status code
  const result = await response.json();
  
  if (!response.ok) {
    // Check if we have a specific error message in the response
    if (result.google?.error) {
      console.warn('⚠️ Google Contacts save failed with specific error:', result.google.error);
      // Return the result with the specific error instead of throwing
      return result;
    }
    // Fallback to generic error if no specific error in response
    throw new Error(`Google Contacts save API request failed: ${response.status}`);
  }

  return result;
}

/**
 * Save contact to Firebase and Google Contacts via API (legacy function for compatibility)
 */
async function saveContactToAPI(token: string, skipGoogleContacts = false): Promise<ContactSaveResult> {
  const response = await fetch('/api/save-contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      token,
      skipGoogleContacts
    })
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Check if we're returning from incremental Google authorization
 */
function isReturningFromIncrementalAuth(): boolean {
  if (typeof window === 'undefined') return false;
  
  const urlParams = new URLSearchParams(window.location.search);
  const hasIncrementalAuth = urlParams.has('incremental_auth');
  
  console.log('🔍 Checking for incremental auth return...');
  console.log('🔍 Current URL:', window.location.href);
  console.log('🔍 URL params:', urlParams.toString());
  console.log('🔍 Has incremental_auth param:', hasIncrementalAuth);
  
  return hasIncrementalAuth;
}

/**
 * Handle return from incremental auth
 */
function handleIncrementalAuthReturn(): { success: boolean; contactSaveToken?: string; profileId?: string; denied?: boolean } {
  const urlParams = new URLSearchParams(window.location.search);
  const authResult = urlParams.get('incremental_auth');
  
  console.log('🔍 Handling incremental auth return...');
  console.log('🔍 Auth result:', authResult);
  
  if (authResult === 'success') {
    const contactSaveToken = urlParams.get('contact_save_token') || undefined;
    const profileId = urlParams.get('profile_id') || undefined;
    
    console.log('🔍 Success return parameters:', { contactSaveToken, profileId });
    
    // Clean up URL parameters
    const url = new URL(window.location.href);
    url.searchParams.delete('incremental_auth');
    url.searchParams.delete('contact_save_token');
    url.searchParams.delete('profile_id');
    window.history.replaceState({}, document.title, url.toString());
    
    console.log('🔍 Cleaned URL:', url.toString());
    
    return { success: true, contactSaveToken, profileId };
  }
  
  if (authResult === 'denied') {
    console.log('🚫 User denied Google Contacts permission');
    
    // Clean up URL
    const url = new URL(window.location.href);
    url.searchParams.delete('incremental_auth');
    window.history.replaceState({}, document.title, url.toString());
    
    return { success: false, denied: true };
  }
  
  console.log('🔍 No valid auth result found');
  return { success: false };
}

/**
 * Main contact save flow with all platform logic
 */
export async function saveContactFlow(
  profile: UserProfile, 
  token: string
): Promise<ContactSaveFlowResult> {
  const platform = detectPlatform();
  console.log(`💾 Starting contact save flow for ${platform}:`, profile.name);
  
  // Check if we're returning from incremental auth
  if (isReturningFromIncrementalAuth()) {
    console.log('🔄 Detected return from incremental auth, processing...');
    const authReturn = handleIncrementalAuthReturn();
    
    console.log('🔍 Auth return result:', authReturn);
    console.log('🔍 Expected profile ID:', profile.userId);
    
    if (authReturn.success && authReturn.contactSaveToken && authReturn.profileId === profile.userId) {
      console.log('🔄 Detected successful return from incremental auth');
      console.log('ℹ️ Firebase was already saved, now trying Google Contacts with new permission');
      
      // Clear saved state since we're handling the return
      clearContactSaveState();
      
      // Try Google Contacts save only (Firebase was already saved before we went to auth)
      try {
        console.log('🔄 Attempting Google Contacts save with new token...');
        const googleSaveResult = await saveContactToGoogleOnly(authReturn.contactSaveToken);
        console.log('🔍 Google save result after auth:', JSON.stringify(googleSaveResult, null, 2));
        
        if (googleSaveResult.google.success) {
          console.log('✅ Google Contacts save successful after auth!');
          return {
            success: true,
            firebase: { success: true }, // Firebase was saved before auth
            google: googleSaveResult.google,
            showSuccessModal: true,
            platform
          };
        } else {
          console.warn('⚠️ Google Contacts save still failed after auth, showing upsell modal');
          return {
            success: true,
            firebase: { success: true }, // Firebase was saved before auth
            google: googleSaveResult.google,
            showUpsellModal: true,
            platform
          };
        }
      } catch (error) {
        console.error('❌ Google Contacts save failed after auth:', error);
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
      }
    } else if (authReturn.denied) {
      console.log('🚫 User denied Google Contacts permission, showing upsell modal');
      // Clear saved state
      clearContactSaveState();
      
      // User denied permission - show upsell modal
      return {
        success: true,
        firebase: { success: true }, // Firebase was saved before auth
        google: { success: false, error: 'User denied permission' },
        showUpsellModal: true,
        platform
      };
    } else {
      console.log('⚠️ Auth return detected but conditions not met');
      console.log('🔍 Conditions check:', {
        hasSuccess: authReturn.success,
        hasContactSaveToken: !!authReturn.contactSaveToken,
        profileIdMatch: authReturn.profileId === profile.userId,
        authProfileId: authReturn.profileId,
        expectedProfileId: profile.userId
      });
    }
  } else {
    console.log('🔍 Not returning from incremental auth, proceeding with normal flow');
  }

  try {
    // Step 1: Always save to Firebase first (immediate success feedback)
    console.log('🔄 Saving to Firebase first...');
    const firebaseResult = await saveContactToFirebase(token);
    
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
      const googleSaveResult = await saveContactToGoogleOnly(token);
      googleResult = googleSaveResult.google;
      console.log('📊 Google Contacts save result:', JSON.stringify(googleResult, null, 2));
    } catch (error) {
      console.warn('⚠️ Google Contacts save failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Google Contacts save failed';
      console.log('📊 Google Contacts error details:', errorMessage);
      googleResult = { 
        success: false, 
        error: errorMessage 
      };
    }

    // Step 3: Platform-specific logic for Google Contacts
    if (platform === 'android') {
      // Android Flow
      if (googleResult.success) {
        // Both Firebase and Google Contacts saved successfully
        console.log('✅ Both Firebase and Google Contacts saved on Android');
        return {
          success: true,
          firebase: firebaseResult.firebase,
          google: googleResult,
          showSuccessModal: true,
          platform
        };
      } else {
        // Check if this is a permission error with comprehensive logging
        console.log('🔍 Checking if error is permission-related...');
        console.log('🔍 Error string:', googleResult.error);
        const isPermError = isPermissionError(googleResult.error);
        console.log('🔍 isPermissionError result:', isPermError);
        
        if (isPermError) {
          console.log('⚠️ Google Contacts permission error detected, redirecting to auth');
          console.log('🔍 Error details:', googleResult.error);
          console.log('ℹ️ Firebase is already saved, just need Google permission');
          
          // Store state for when we return
          storeContactSaveState(token, profile.userId || '');
          
          // Redirect to Google auth for contacts permission
          redirectToGoogleContactsAuth(token, profile.userId || '');
          
          // Return immediately without modal flags - we're redirecting now
          // The redirect will happen before any modal can show
          return {
            success: true,
            firebase: firebaseResult.firebase,
            google: { success: false, error: 'Redirecting for permissions...' },
            platform
          };
        } else {
          // Other error - show upsell modal (Firebase is still saved!)
          console.log('❌ Google Contacts save failed on Android with non-permission error, showing upsell modal');
          console.log('🔍 Error details:', googleResult.error);
          console.log('ℹ️ Contact is saved to Firebase, just not Google Contacts');
          return {
            success: true,
            firebase: firebaseResult.firebase,
            google: googleResult,
            showUpsellModal: true,
            platform
          };
        }
      }
    } else if (platform === 'ios') {
      // iOS Flow - different behavior for embedded browsers vs Safari
      const userAgent = navigator.userAgent.toLowerCase();
      const isEmbedded = ['gsa/', 'googleapp', 'fb', 'fban', 'fbav', 'instagram', 'twitter', 'line/', 'wechat', 'weibo', 'webview', 'chrome-mobile'].some(indicator => userAgent.includes(indicator));
      
      if (isEmbedded) {
        // iOS Embedded Browser Flow (like Android)
        console.log('🍎 iOS embedded browser flow: using Google Contacts approach');
        
        if (googleResult.success) {
          // Both Firebase and Google Contacts saved successfully
          console.log('✅ Both Firebase and Google Contacts saved on iOS embedded browser');
          return {
            success: true,
            firebase: firebaseResult.firebase,
            google: googleResult,
            showSuccessModal: true,
            platform
          };
        } else {
          // Check if this is a permission error
          if (isPermissionError(googleResult.error)) {
            console.log('⚠️ Google Contacts permission error detected on iOS, redirecting to auth');
            console.log('ℹ️ Firebase is already saved, just need Google permission');
            
            // Store state for when we return
            storeContactSaveState(token, profile.userId || '');
            
            // Redirect to Google auth for contacts permission
            redirectToGoogleContactsAuth(token, profile.userId || '');
            
            // Return a pending result (this won't actually be used due to redirect)
            return {
              success: true,
              firebase: firebaseResult.firebase,
              google: { success: false, error: 'Redirecting for permissions...' },
              platform
            };
          } else {
            // Other error - show upsell modal (Firebase is still saved!)
            console.log('❌ Google Contacts save failed on iOS embedded browser with non-permission error, showing upsell modal');
            console.log('ℹ️ Contact is saved to Firebase, just not Google Contacts');
            return {
              success: true,
              firebase: firebaseResult.firebase,
              google: googleResult,
              showUpsellModal: true,
              platform
            };
          }
        }
      } else {
        // iOS Safari Flow (traditional vCard)
        console.log('🍎 iOS Safari flow: displaying vCard inline');
        
        // Try to show vCard inline for Safari
        try {
          await displayVCardInlineForIOS(profile);
        } catch (error) {
          console.warn('Failed to display vCard inline for iOS Safari:', error);
        }
        
        // Show success modal
        const result: ContactSaveFlowResult = {
          success: true,
          firebase: firebaseResult.firebase,
          google: googleResult,
          showSuccessModal: true,
          platform
        };
        
        // For iOS Safari, don't show upsell modal immediately on first save
        // Users can retry from the success modal if they want Google Contacts integration
        
        return result;
      }
    } else {
      // Web/Desktop - just show success
      console.log('🖥️ Desktop flow: showing success modal');
      return {
        success: true,
        firebase: firebaseResult.firebase,
        google: googleResult,
        showSuccessModal: true,
        platform
      };
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
    const userAgent = navigator.userAgent.toLowerCase();
    const isEmbedded = ['gsa/', 'googleapp', 'fb', 'fban', 'fbav', 'instagram', 'twitter', 'line/', 'wechat', 'weibo', 'webview', 'chrome-mobile'].some(indicator => userAgent.includes(indicator));
    
    if (platform === 'android' || (platform === 'ios' && isEmbedded)) {
      // Store state for when we return
      storeContactSaveState(token, profile.userId || '');
      
      // Redirect to Google auth for contacts permission
      redirectToGoogleContactsAuth(token, profile.userId || '');
      
      // This won't execute due to redirect
      return { success: true };
    } else {
      // For other platforms (iOS Safari, web), just try Google Contacts save only
      try {
        const googleSaveResult = await saveContactToGoogleOnly(token);
        
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
