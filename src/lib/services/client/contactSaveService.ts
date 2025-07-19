/**
 * Contact save service focused on saving logic
 * Handles Firebase, Google Contacts, and platform-specific flows
 */

import { UserProfile } from '@/types/profile';
import { ContactSaveResult } from '@/types/contactExchange';
import { displayVCardInlineForIOS } from '@/lib/utils/vCardGeneration';
import { detectPlatform as detectPlatformUtil, isEmbeddedBrowser } from '@/lib/utils/platformDetection';
import {
  isPermissionError,
  hasShownUpsell,
  markUpsellShown,
  isReturningFromIncrementalAuth,
  handleIncrementalAuthReturn,
  startIncrementalAuth
} from './clientIncrementalAuthService';

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
 * Check if user likely has Google Contacts permission
 * Uses localStorage upsell history as a smart indicator
 */
function likelyHasGoogleContactsPermission(platform: string, token: string): boolean {
  // If we've never shown the upsell, they might still have permission
  // If we have shown the upsell, they definitely don't have permission
  return !hasShownUpsell(platform, token);
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
function clearContactSaveState(): void {
  try {
    localStorage.removeItem('contact_save_state');
  } catch (error) {
    console.warn('Failed to clear contact save state:', error);
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
 * Main contact save flow with all platform logic
 */
export async function saveContactFlow(
  profile: UserProfile, 
  token: string
): Promise<ContactSaveFlowResult> {
  console.log('🔍 Starting saveContactFlow for:', profile.name);
  
  // No cleanup needed - iOS Safari never expires, others auto-expire
  
  const platform = detectPlatform();
  const currentState = getContactSaveState(); // This will auto-clear if expired
  const isReturning = isReturningFromIncrementalAuth(currentState);
  
  if (isReturning) {
    const authReturn = handleIncrementalAuthReturn(currentState);
    
    // Handle state clearing based on auth result
    if (authReturn.success || authReturn.denied) {
      // Clear state if we got a definitive result
      clearContactSaveState();
    } else if (currentState && currentState.timestamp) {
      // Clear state if it's too old (older than auth return window)
      const authReturnWindow = 2 * 60 * 1000; // 2 minutes
      const age = Date.now() - currentState.timestamp;
      if (age > authReturnWindow) {
        clearContactSaveState();
      }
    }
    
    if (authReturn.success && authReturn.contactSaveToken && authReturn.profileId === profile.userId) {
      console.log('🔄 Retrying Google Contacts after successful auth');
      
      // Try Google Contacts save only (Firebase was already saved before we went to auth)
      try {
        console.log('🔄 Attempting Google Contacts save with new token...');
        const googleSaveResult = await callSaveContactAPI(authReturn.contactSaveToken, { googleOnly: true });
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
          console.warn('⚠️ Google Contacts save still failed after auth');
          
          // Only show upsell modal if we haven't shown it for this token yet
          if (!hasShownUpsell(platform, token)) {
            markUpsellShown(platform, token);
            return {
              success: true,
              firebase: { success: true }, // Firebase was saved before auth
              google: googleSaveResult.google,
              showUpsellModal: true,
              platform
            };
          } else {
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
        if (!hasShownUpsell(platform, token)) {
          console.log('🆕 Auth error: First time showing upsell for this exchange, showing modal');
          markUpsellShown(platform, token);
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
      
      // Only show upsell modal if we haven't shown it for this token yet
      if (!hasShownUpsell(platform, token)) {
        console.log('🆕 Auth denied: First time showing upsell for this exchange, showing modal');
        markUpsellShown(platform, token);
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
      
      
      // Only show upsell modal if we haven't shown it for this token yet
      if (!hasShownUpsell(platform, token)) {
        console.log('🆕 Auth incomplete: First time showing upsell for this exchange, showing modal');
        markUpsellShown(platform, token);
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
    // Smart permission check to avoid unnecessary API calls
    const likelyHasPermission = likelyHasGoogleContactsPermission(platform, token);
    console.log('🔍 Permission check: User likely has Google Contacts permission:', likelyHasPermission);
    
    // If we know they don't have permission and can do incremental auth, skip Google attempt
    if (!likelyHasPermission && (platform === 'android' || platform === 'ios')) {
      console.log('🚀 Fast path: Skipping Google attempt, going straight to incremental auth');
      
      // Start Firebase save and incremental auth in parallel
      const [firebaseResult] = await Promise.all([
        callSaveContactAPI(token, { skipGoogleContacts: true }),
        (async () => {
          // Store state for auth flow continuity
          storeContactSaveState(token, profile.userId || '');
          // Start incremental auth (non-blocking)
          return startIncrementalAuth(token, profile.userId || '');
        })()
      ]);
      
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
      // Auth flow is already started, user will be redirected
      return {
        success: true,
        firebase: firebaseResult.firebase,
        google: { success: false, error: 'Redirecting to Google auth' },
        platform
      };
    }
    
    // Traditional flow: try both Firebase and Google
    console.log('🔄 Traditional flow: Trying Firebase and Google in parallel...');
    const [firebaseResult, googleSaveResult] = await Promise.all([
      callSaveContactAPI(token, { skipGoogleContacts: true }),
      callSaveContactAPI(token, { googleOnly: true }).catch(error => {
        console.warn('⚠️ Google Contacts save failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Google Contacts save failed';
        return {
          google: { 
            success: false, 
            error: errorMessage 
          }
        };
      })
    ]);
    
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
    const googleResult = googleSaveResult.google;

    // Step 2: Platform-specific logic for Google Contacts
    
    // iOS Safari/Chrome Flow (traditional vCard) - the only truly different platform
    if (platform === 'ios' && !isEmbeddedBrowser()) {
      
      // Try to show vCard inline for Safari
      try {
        // Generate contact URL for the profile
        const contactUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/contact/${profile.userId}`;
        
        await displayVCardInlineForIOS(profile, { 
          contactUrl 
        });
      } catch (error) {
        console.warn('Failed to display vCard inline for iOS Safari:', error);
      }
      
      // Determine modal to show based on global first-time status (iOS Safari = once EVER)
      let shouldShowUpsellModal = false;
      
      if (!hasShownUpsell('ios_safari', token)) {
        markUpsellShown('ios_safari', token);
        shouldShowUpsellModal = true;
      } else {
        shouldShowUpsellModal = false;
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
    if (googleResult.success) {
      // Both Firebase and Google Contacts saved successfully
      return {
        success: true,
        firebase: firebaseResult.firebase,
        google: googleResult,
        showSuccessModal: true,
        platform
      };
    } else {
      // Check if this is a permission error
      const isPermError = isPermissionError(googleResult.error);
      
      if (isPermError && (platform === 'android' || platform === 'ios')) {
        // Only Android and iOS embedded can do incremental auth
        console.log(`⚠️ ${platform}: Permission error detected, redirecting to auth`);
        
        // Store state for when we return
        storeContactSaveState(token, profile.userId || '');
        
        // Redirect to Google auth for contacts permission
        const authResult = await startIncrementalAuth(token, profile.userId || '');
        
        console.log(`🔍 ${platform}: Auth result:`, authResult);
        
        if (authResult.showUpsellModal) {
          console.log(`🚫 ${platform}: User closed popup or auth failed`);
          
          // Only show upsell modal if we haven't shown it for this token yet
          if (!hasShownUpsell(platform, token)) {
            console.log(`🆕 ${platform}: First time showing upsell for this exchange, showing modal`);
            markUpsellShown(platform, token);
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
        if (!hasShownUpsell(platform, token)) {
          console.log(`🆕 ${platform}: First time showing upsell for this exchange, showing modal`);
          markUpsellShown(platform, token);
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