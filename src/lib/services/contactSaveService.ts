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
  
  // Common permission error messages from Google API
  const permissionKeywords = [
    'permission',
    'scope',
    'authorization',
    'not authorized',
    'insufficient',
    'access denied',
    'forbidden',
    '403',
    'unauthorized'
  ];
  
  const lowerError = error.toLowerCase();
  return permissionKeywords.some(keyword => lowerError.includes(keyword));
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
function redirectToGoogleContactsAuth(): void {
  // Create a return URL with a special parameter to indicate we're returning from auth
  const returnUrl = `${window.location.href}${window.location.href.includes('?') ? '&' : '?'}returning_from_auth=true`;
  
  // Redirect to Google auth with contacts scope only
  const authUrl = `/api/auth/signin/google?scope=https://www.googleapis.com/auth/contacts&callbackUrl=${encodeURIComponent(returnUrl)}`;
  
  console.log('🔄 Redirecting to Google for contacts permission:', authUrl);
  window.location.href = authUrl;
}

/**
 * Save contact to Firebase and Google Contacts via API
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
 * Check if we're returning from Google authorization
 */
function isReturningFromAuth(): boolean {
  if (typeof window === 'undefined') return false;
  
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.has('returning_from_auth');
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
  
  // Check if we're returning from auth and have saved state
  if (isReturningFromAuth()) {
    const savedState = getContactSaveState();
    if (savedState.token && savedState.profileId === profile.userId) {
      console.log('🔄 Detected return from Google auth, using saved token:', savedState.token);
      token = savedState.token;
      clearContactSaveState();
      
      // Remove the returning_from_auth parameter from URL to prevent loops
      const url = new URL(window.location.href);
      url.searchParams.delete('returning_from_auth');
      window.history.replaceState({}, document.title, url.toString());
    }
  }

  try {
    // Step 1: Always try to save to Firebase and Google Contacts
    let saveResult = await saveContactToAPI(token, false);
    
    if (!saveResult.firebase.success) {
      console.error('❌ Firebase save failed');
      return {
        success: false,
        firebase: saveResult.firebase,
        google: { success: false, error: 'Firebase save failed' },
        platform
      };
    }

    console.log('✅ Firebase save successful');

    // Step 2: Platform-specific logic
    if (platform === 'android') {
      // Android Flow
      if (saveResult.google.success) {
        // Both Firebase and Google Contacts saved successfully
        console.log('✅ Both Firebase and Google Contacts saved on Android');
        return {
          success: true,
          firebase: saveResult.firebase,
          google: saveResult.google,
          showSuccessModal: true,
          platform
        };
      } else {
        // Check if this is a permission error
        if (isPermissionError(saveResult.google.error)) {
          console.log('⚠️ Google Contacts permission error detected, redirecting to auth');
          
          // Store state for when we return
          storeContactSaveState(token, profile.userId || '');
          
          // Redirect to Google auth for contacts permission
          redirectToGoogleContactsAuth();
          
          // Return a pending result (this won't actually be used due to redirect)
          return {
            success: true,
            firebase: saveResult.firebase,
            google: { success: false, error: 'Redirecting for permissions...' },
            platform
          };
        } else {
          // Other error - show upsell modal
          console.log('❌ Google Contacts save failed on Android with non-permission error, showing upsell modal');
          return {
            success: true,
            firebase: saveResult.firebase,
            google: { success: false, error: saveResult.google.error },
            showUpsellModal: true,
            platform
          };
        }
      }
    } else if (platform === 'ios') {
      // iOS Flow
      console.log('🍎 iOS flow: displaying vCard inline');
      
      // Always show vCard inline for iOS
      displayVCardInlineForIOS(profile);
      
      // Show success modal
      const result: ContactSaveFlowResult = {
        success: true,
        firebase: saveResult.firebase,
        google: saveResult.google,
        showSuccessModal: true,
        platform
      };
      
      // For iOS, don't show upsell modal immediately on first save
      // Users can retry from the success modal if they want Google Contacts integration
      // No automatic upsell modal for iOS to avoid interrupting the flow
      
      return result;
    } else {
      // Web/Desktop - just show success
      console.log('🖥️ Desktop flow: showing success modal');
      return {
        success: true,
        firebase: saveResult.firebase,
        google: saveResult.google,
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
  
  try {
    const platform = detectPlatform();
    
    if (platform === 'android') {
      // Store state for when we return
      storeContactSaveState(token, profile.userId || '');
      
      // Redirect to Google auth for contacts permission
      redirectToGoogleContactsAuth();
      
      // This won't execute due to redirect
      return { success: true };
    } else {
      // For non-Android platforms, just try the API call again
      const saveResult = await saveContactToAPI(token, false);
      
      return {
        success: saveResult.google.success,
        showSuccessModal: true
      };
    }
  } catch (error) {
    console.error('❌ Retry Google Contacts save failed:', error);
    return { success: false };
  }
}
