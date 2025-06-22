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
 * Request Google Contacts permission (simplified incremental auth)
 */
function requestGoogleContactsPermission(): Promise<boolean> {
  return new Promise((resolve) => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error('Google Client ID not configured');
      resolve(false);
      return;
    }

    // Construct the Google OAuth URL for incremental authorization
    const authUrl = new URL('https://accounts.google.com/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/contacts');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('include_granted_scopes', 'true');
    authUrl.searchParams.set('redirect_uri', `${window.location.origin}/connect`);
    authUrl.searchParams.set('state', 'incremental_auth');

    // Open popup for OAuth flow
    const popup = window.open(
      authUrl.toString(),
      'google-contacts-auth',
      'width=500,height=600,scrollbars=yes,resizable=yes'
    );

    if (!popup) {
      console.error('Popup blocked');
      resolve(false);
      return;
    }

    // Monitor popup for completion
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        // For now, assume success if popup was closed
        // In a real implementation, you'd have a postMessage communication
        resolve(true);
      }
    }, 1000);

    // Timeout after 5 minutes
    setTimeout(() => {
      clearInterval(checkClosed);
      if (!popup.closed) {
        popup.close();
      }
      resolve(false);
    }, 5 * 60 * 1000);
  });
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
 * Main contact save flow with all platform logic
 */
export async function saveContactFlow(
  profile: UserProfile, 
  token: string
): Promise<ContactSaveFlowResult> {
  const platform = detectPlatform();
  console.log(`💾 Starting contact save flow for ${platform}:`, profile.name);

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
        // Google Contacts failed - request permission
        console.log('🔓 Requesting Google Contacts permission on Android...');
        
        const permissionGranted = await requestGoogleContactsPermission();
        
        if (permissionGranted) {
          // Try saving to Google Contacts again
          console.log('✅ Permission granted, retrying Google Contacts save...');
          saveResult = await saveContactToAPI(token, false);
          
          return {
            success: true,
            firebase: saveResult.firebase,
            google: saveResult.google,
            showSuccessModal: true,
            platform
          };
        } else {
          // Permission denied - show upsell modal
          console.log('❌ Google Contacts permission denied on Android');
          return {
            success: true,
            firebase: saveResult.firebase,
            google: { success: false, error: 'Permission denied' },
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
      
      // Check if we should show upsell modal (first time only)
      if (isFirstTimeIOSUpsell()) {
        console.log('💡 Showing iOS upsell modal (first time)');
        markIOSUpsellShown();
        result.showUpsellModal = true;
      }
      
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
  console.log('🔄 Retrying Google Contacts permission...');
  
  try {
    const permissionGranted = await requestGoogleContactsPermission();
    
    if (permissionGranted) {
      // Try saving to Google Contacts again
      const saveResult = await saveContactToAPI(token, false);
      
      return {
        success: saveResult.google.success,
        showSuccessModal: true
      };
    } else {
      return { success: false };
    }
  } catch (error) {
    console.error('❌ Retry Google Contacts permission failed:', error);
    return { success: false };
  }
}
