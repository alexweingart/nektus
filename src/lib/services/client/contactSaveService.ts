/**
 * Contact save service focused on saving logic
 * Handles Firebase, Google Contacts, and platform-specific flows
 */

import { UserProfile } from '@/types/profile';
import { ContactSaveResult } from '@/types/contactExchange';
import { displayVCardInlineForIOS } from '@/lib/utils/vCardGeneration';
import { detectPlatform as detectPlatformUtil, isEmbeddedBrowser } from '@/lib/utils/platformDetection';
import { isPermissionError, startIncrementalAuth } from './clientIncrementalAuthService';
import {
  getExchangeState,
  setExchangeState,
  clearExchangeState,
  markUpsellShown,
  shouldShowUpsell,
  shouldShowSuccess,
  isReturningFromAuth
} from './exchangeStateService';

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
 * Uses exchange state history as a smart indicator
 */
function likelyHasGoogleContactsPermission(platform: string, token: string): boolean {
  // If we've never shown the upsell, they might still have permission
  // If we have shown the upsell, they definitely don't have permission
  const iosNonEmbedded = platform === 'ios' && !isEmbeddedBrowser();
  return !shouldShowUpsell(token, platform, iosNonEmbedded);
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
  
  const platform = detectPlatform();
  const isReturning = isReturningFromAuth(token);
  
  if (isReturning) {
    console.log('🔍 Flow: Returning from incremental auth, processing auth result...');
    
    // Check URL params for auth result
    const urlParams = new URLSearchParams(window.location.search);
    const authResult = urlParams.get('incremental_auth');
    
    console.log('🔍 Auth return - URL params:', Object.fromEntries(urlParams.entries()));
    console.log('🔍 Auth return - authResult:', authResult);
    
    if (authResult === 'success') {
      console.log('✅ Auth successful, attempting Google Contacts save');
      const contactSaveToken = urlParams.get('contact_save_token') || token;
      
      // Clean up URL parameters
      const url = new URL(window.location.href);
      url.searchParams.delete('incremental_auth');
      url.searchParams.delete('contact_save_token');
      url.searchParams.delete('profile_id');
      window.history.replaceState({}, document.title, url.toString());
      
      try {
        const googleSaveResult = await callSaveContactAPI(contactSaveToken, { googleOnly: true });
        console.log('🔍 Auth return - Google save result:', JSON.stringify(googleSaveResult, null, 2));
        
        if (googleSaveResult.google.success) {
          // Both Firebase and Google successful
          setExchangeState(token, {
            state: 'completed_success',
            platform,
            profileId: profile.userId || '',
            timestamp: Date.now()
          });
          
          return {
            success: true,
            firebase: { success: true },
            google: googleSaveResult.google,
            showSuccessModal: true,
            platform
          };
        } else {
          // Firebase saved, Google failed
          setExchangeState(token, {
            state: 'completed_firebase_only',
            platform,
            profileId: profile.userId || '',
            timestamp: Date.now()
          });
          
          const iosNonEmbedded = platform === 'ios' && !isEmbeddedBrowser();
          if (shouldShowUpsell(token, platform, iosNonEmbedded)) {
            markUpsellShown(token);
            return {
              success: true,
              firebase: { success: true },
              google: googleSaveResult.google,
              showUpsellModal: true,
              platform
            };
          } else {
            return {
              success: true,
              firebase: { success: true },
              google: googleSaveResult.google,
              showSuccessModal: true,
              platform
            };
          }
        }
      } catch (error) {
        console.error('❌ Google Contacts save failed after auth:', error);
        
        setExchangeState(token, {
          state: 'completed_firebase_only',
          platform,
          profileId: profile.userId || '',
          timestamp: Date.now()
        });
        
        const iosNonEmbedded = platform === 'ios' && !isEmbeddedBrowser();
        if (shouldShowUpsell(token, platform, iosNonEmbedded)) {
          markUpsellShown(token);
          return {
            success: true,
            firebase: { success: true },
            google: { success: false, error: error instanceof Error ? error.message : 'Google save failed after auth' },
            showUpsellModal: true,
            platform
          };
        } else {
          return {
            success: true,
            firebase: { success: true },
            google: { success: false, error: error instanceof Error ? error.message : 'Google save failed after auth' },
            showSuccessModal: true,
            platform
          };
        }
      }
    } else if (authResult === 'denied') {
      console.log('🚫 User denied Google Contacts permission');
      
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete('incremental_auth');
      window.history.replaceState({}, document.title, url.toString());
      
      setExchangeState(token, {
        state: 'completed_firebase_only',
        platform,
        profileId: profile.userId || '',
        timestamp: Date.now()
      });
      
      const iosNonEmbedded = platform === 'ios' && !isEmbeddedBrowser();
      if (shouldShowUpsell(token, platform, iosNonEmbedded)) {
        markUpsellShown(token);
        return {
          success: true,
          firebase: { success: true },
          google: { success: false, error: 'User denied permission' },
          showUpsellModal: true,
          platform
        };
      } else {
        return {
          success: true,
          firebase: { success: true },
          google: { success: false, error: 'User denied permission' },
          showSuccessModal: true,
          platform
        };
      }
    } else {
      // User likely tapped back without completing auth
      console.log('🔙 User returned from auth without completing (likely tapped back)');
      
      setExchangeState(token, {
        state: 'completed_firebase_only',
        platform,
        profileId: profile.userId || '',
        timestamp: Date.now()
      });
      
      const iosNonEmbedded = platform === 'ios' && !isEmbeddedBrowser();
      if (shouldShowUpsell(token, platform, iosNonEmbedded)) {
        markUpsellShown(token);
        return {
          success: true,
          firebase: { success: true },
          google: { success: false, error: 'User cancelled Google auth' },
          showUpsellModal: true,
          platform
        };
      } else {
        return {
          success: true,
          firebase: { success: true },
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
      
      // Set state to auth_in_progress
      setExchangeState(token, {
        state: 'auth_in_progress',
        platform,
        profileId: profile.userId || '',
        timestamp: Date.now()
      });
      
      // Start Firebase save and incremental auth in parallel
      const [firebaseResult] = await Promise.all([
        callSaveContactAPI(token, { skipGoogleContacts: true }),
        startIncrementalAuth(token, profile.userId || '')
      ]);
      
      if (!firebaseResult.firebase.success) {
        console.error('❌ Firebase save failed');
        clearExchangeState(token);
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
    
    // iOS non-embedded browsers (Safari/Chrome/Edge) - the only truly different platform
    const iosNonEmbedded = platform === 'ios' && !isEmbeddedBrowser();
    if (iosNonEmbedded) {
      
      // Try to show vCard inline for Safari and wait for dismissal
      try {
        // Generate contact URL for the profile
        const contactUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/contact/${profile.userId}`;
        
        console.log('📱 Displaying vCard for iOS Safari and waiting for dismissal...');
        await displayVCardInlineForIOS(profile, { 
          contactUrl 
        });
        console.log('📱 vCard dismissed, now showing appropriate modal');
      } catch (error) {
        console.warn('Failed to display vCard inline for iOS Safari:', error);
      }
      
      if (googleResult.success) {
        // Both Firebase and Google successful
        setExchangeState(token, {
          state: 'completed_success',
          platform,
          profileId: profile.userId || '',
          timestamp: Date.now()
        });
        
        return {
          success: true,
          firebase: firebaseResult.firebase,
          google: googleResult,
          showSuccessModal: true,
          platform
        };
      } else {
        // Firebase saved, Google failed - iOS non-embedded shows upsell once ever
        setExchangeState(token, {
          state: 'completed_firebase_only',
          platform,
          profileId: profile.userId || '',
          timestamp: Date.now()
        });
        
        if (shouldShowUpsell(token, platform, iosNonEmbedded)) {
          markUpsellShown(token);
          return {
            success: true,
            firebase: firebaseResult.firebase,
            google: googleResult,
            showUpsellModal: true,
            platform
          };
        } else {
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

    // All other platforms (Android, iOS Embedded, Web/Desktop) - unified logic
    if (googleResult.success) {
      // Both Firebase and Google Contacts saved successfully
      setExchangeState(token, {
        state: 'completed_success',
        platform,
        profileId: profile.userId || '',
        timestamp: Date.now()
      });
      
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
        
        // Set state to auth_in_progress
        setExchangeState(token, {
          state: 'auth_in_progress',
          platform,
          profileId: profile.userId || '',
          timestamp: Date.now()
        });
        
        // Redirect to Google auth for contacts permission
        const authResult = await startIncrementalAuth(token, profile.userId || '');
        
        console.log(`🔍 ${platform}: Auth result:`, authResult);
        
        if (authResult.showUpsellModal) {
          console.log(`🚫 ${platform}: User closed popup or auth failed`);
          
          setExchangeState(token, {
            state: 'completed_firebase_only',
            platform,
            profileId: profile.userId || '',
            timestamp: Date.now()
          });
          
          const iosNonEmbedded = platform === 'ios' && !isEmbeddedBrowser();
          if (shouldShowUpsell(token, platform, iosNonEmbedded)) {
            markUpsellShown(token);
            return {
              success: true,
              firebase: firebaseResult.firebase,
              google: { success: false, error: 'User closed auth popup' },
              showUpsellModal: true,
              platform
            };
          } else {
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
        
        setExchangeState(token, {
          state: 'completed_firebase_only',
          platform,
          profileId: profile.userId || '',
          timestamp: Date.now()
        });
        
        const iosNonEmbedded = platform === 'ios' && !isEmbeddedBrowser();
        if (shouldShowUpsell(token, platform, iosNonEmbedded)) {
          markUpsellShown(token);
          return {
            success: true,
            firebase: firebaseResult.firebase,
            google: googleResult,
            showUpsellModal: true,
            platform
          };
        } else {
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