/**
 * Contact save service focused on saving logic
 * Handles Firebase, Google Contacts, and platform-specific flows
 */

import { UserProfile } from '@/types/profile';
import { ContactSaveResult } from '@/types/contactExchange';
import { displayVCardInlineForIOS } from '@/client/contacts/vcard';
import { detectPlatform as detectPlatformUtil, isEmbeddedBrowser } from '@/client/platform-detection';
import { isPermissionError, startIncrementalAuth } from '@/client/auth/google-incremental';
import { getFieldValue } from '@/client/profile/transforms';
import {
  setExchangeState,
  clearExchangeState,
  shouldShowUpsell,
  isReturningFromAuth,
  hasCompletedFirstSave,
  markFirstSaveCompleted,
  markGoogleContactsPermissionGranted
} from '@/client/contacts/exchange/state';

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
  const platform = detectPlatformUtil().platform;
  return (platform || 'web') as 'android' | 'ios' | 'web';
}

/**
 * Clean up URL parameters after auth flow
 */
function cleanupAuthURLParams(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('incremental_auth');
  url.searchParams.delete('contact_save_token');
  url.searchParams.delete('profile_id');
  window.history.replaceState({}, document.title, url.toString());
}

/**
 * Create result for Firebase-only saves with appropriate modal
 */
function createFirebaseOnlyResult(
  token: string,
  platform: 'android' | 'ios' | 'web',
  profileId: string,
  firebase: { success: boolean; error?: string },
  google: { success: boolean; error?: string; contactId?: string }
): ContactSaveFlowResult {
  setExchangeState(token, {
    state: 'completed_firebase_only',
    platform,
    profileId,
    timestamp: Date.now()
  });

  const iosNonEmbedded = platform === 'ios' && !isEmbeddedBrowser();
  return {
    success: true,
    firebase,
    google,
    ...(shouldShowUpsell(token, platform, iosNonEmbedded) 
      ? { showUpsellModal: true } 
      : { showSuccessModal: true }
    ),
    platform
  };
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
  try {
    const response = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, ...options }),
      keepalive: true // Ensure request completes even if page navigates (iOS vCard display)
    });

    // Check if response is JSON before parsing
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('❌ API returned non-JSON response:', {
        status: response.status,
        contentType,
        bodyPreview: text.substring(0, 200)
      });
      throw new Error(`API returned ${contentType || 'unknown content type'} instead of JSON`);
    }

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
  } catch (error) {
    console.error('❌ API call error:', error);
    throw error;
  }
}

/**
 * Main contact save flow with all platform logic
 */
export async function saveContactFlow(
  profile: UserProfile, 
  token: string
): Promise<ContactSaveFlowResult> {
  console.log('🔍 Starting saveContactFlow for:', getFieldValue(profile.contactEntries, 'name'));
  
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
      cleanupAuthURLParams();
      
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

          // Mark that user has Google Contacts permission globally
          markGoogleContactsPermissionGranted();

          // Mark first save as completed for iOS non-embedded (if not already)
          const iosNonEmbedded = platform === 'ios' && !isEmbeddedBrowser();
          if (iosNonEmbedded && !hasCompletedFirstSave()) {
            markFirstSaveCompleted();
          }

          return {
            success: true,
            firebase: { success: true },
            google: googleSaveResult.google,
            showSuccessModal: true,
            platform
          };
        } else {
          // Firebase saved, Google failed
          const result = createFirebaseOnlyResult(
            token,
            platform,
            profile.userId || '',
            { success: true },
            googleSaveResult.google
          );

          // Mark first save as completed for iOS non-embedded even if Google failed
          const iosNonEmbedded = platform === 'ios' && !isEmbeddedBrowser();
          if (iosNonEmbedded && !hasCompletedFirstSave()) {
            markFirstSaveCompleted();
          }

          return result;
        }
      } catch (error) {
        console.error('❌ Google Contacts save failed after auth:', error);

        const result = createFirebaseOnlyResult(
          token,
          platform,
          profile.userId || '',
          { success: true },
          { success: false, error: error instanceof Error ? error.message : 'Google save failed after auth' }
        );

        // Mark first save as completed for iOS non-embedded even on error
        const iosNonEmbedded = platform === 'ios' && !isEmbeddedBrowser();
        if (iosNonEmbedded && !hasCompletedFirstSave()) {
          markFirstSaveCompleted();
        }

        return result;
      }
    } else if (authResult === 'denied') {
      console.log('🚫 User denied Google Contacts permission');

      // Clean up URL
      cleanupAuthURLParams();

      const result = createFirebaseOnlyResult(
        token,
        platform,
        profile.userId || '',
        { success: true },
        { success: false, error: 'User denied permission' }
      );

      // Mark first save as completed for iOS non-embedded even when denied
      const iosNonEmbedded = platform === 'ios' && !isEmbeddedBrowser();
      if (iosNonEmbedded && !hasCompletedFirstSave()) {
        markFirstSaveCompleted();
      }

      return result;
    } else {
      // User likely tapped back without completing auth
      console.log('🔙 User returned from auth without completing (likely tapped back)');

      const result = createFirebaseOnlyResult(
        token,
        platform,
        profile.userId || '',
        { success: true },
        { success: false, error: 'User cancelled Google auth' }
      );

      // Mark first save as completed for iOS non-embedded even when cancelled
      const iosNonEmbedded = platform === 'ios' && !isEmbeddedBrowser();
      if (iosNonEmbedded && !hasCompletedFirstSave()) {
        markFirstSaveCompleted();
      }

      return result;
    }
  } else {
    console.log('🔍 Flow: Not returning from incremental auth, proceeding with normal flow');
  }

  try {
    // Smart permission check to avoid unnecessary API calls
    const likelyHasPermission = likelyHasGoogleContactsPermission(platform, token);
    console.log('🔍 Permission check: User likely has Google Contacts permission:', likelyHasPermission);

    // Check if this is iOS non-embedded (Safari/Chrome/Edge)
    const iosNonEmbedded = platform === 'ios' && !isEmbeddedBrowser();

    // If we know they don't have permission and can do incremental auth, skip Google attempt
    // Exception: iOS non-embedded NEVER uses fast path (always shows vCard first, even first-time)
    const shouldUseFastPath = !likelyHasPermission &&
                              (platform === 'android' || (platform === 'ios' && !iosNonEmbedded));

    if (shouldUseFastPath) {
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
    
    // ULTRA-OPTIMIZED flow: Start saves FIRST, then show vCard immediately
    console.log('🚀 Ultra-optimized flow: Starting saves, then instant vCard...');

    // START API calls BEFORE showing vCard (so they're not cancelled by navigation)
    const firebaseSavePromise = callSaveContactAPI(token, { skipGoogleContacts: true });
    const googleSavePromise = callSaveContactAPI(token, { googleOnly: true });

    // Handle Firebase save result
    firebaseSavePromise
      .then(result => {
        if (result?.firebase?.success) {
          console.log('✅ Firebase save successful in background');
          // Update exchange state after successful save
          setExchangeState(token, {
            state: 'completed_success',
            platform,
            profileId: profile.userId || '',
            timestamp: Date.now()
          });
        } else {
          console.error('❌ Firebase save failed in background:', result?.firebase?.error || 'Unknown error');
        }
      })
      .catch(error => {
        console.error('❌ Background Firebase save error:', error?.message || error);
      });

    // Handle Google save result
    googleSavePromise
      .then(result => {
        if (result?.google?.success) {
          console.log('✅ Google Contacts saved in background');
        } else {
          console.log('⚠️ Google Contacts save failed in background:', result?.google?.error || 'Unknown error');
        }
      })
      .catch(error => {
        console.error('❌ Background Google save error:', error?.message || error);
      });

    // NOW show vCard (after API calls have started)
    if (iosNonEmbedded) {
      // Show vCard immediately (API calls already started, won't be cancelled)
      try {
        const contactUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/contact/${profile.userId}`;

        console.log('📱 Displaying vCard (saves already in progress)...');
        displayVCardInlineForIOS(profile, {
          contactUrl,
          skipPhotoFetch: false // Include photo for better contact quality
        }).then(() => {
          console.log('📱 vCard dismissed by user');
        }).catch(error => {
          console.warn('Failed to display vCard:', error);
        });
      } catch (error) {
        console.warn('Failed to trigger vCard display:', error);
      }
    }

    // Check permission for UI display
    const userHasPermission = likelyHasGoogleContactsPermission(platform, token);

    // Create results for immediate UI feedback (assume success)
    const firebaseResult = { firebase: { success: true } };
    const googleResult = {
      success: userHasPermission,
      error: userHasPermission ? undefined : 'Saving in background'
    };

    // For iOS, we already showed vCard, now show modal
    if (iosNonEmbedded) {
      // Check if this is a subsequent save (user already completed first save)
      const isSubsequentSave = hasCompletedFirstSave();

      if (googleResult.success) {
        // Both Firebase and Google successful
        setExchangeState(token, {
          state: 'completed_success',
          platform,
          profileId: profile.userId || '',
          timestamp: Date.now()
        });

        // Mark that user has Google Contacts permission globally
        markGoogleContactsPermissionGranted();

        // Mark first save as completed (if not already)
        if (!isSubsequentSave) {
          markFirstSaveCompleted();
        }

        return {
          success: true,
          firebase: firebaseResult.firebase,
          google: googleResult,
          showSuccessModal: true,
          platform
        };
      } else {
        // Firebase saved, Google failed
        if (isSubsequentSave) {
          // Subsequent saves: Always show success modal (never upsell, never redirect to auth)
          setExchangeState(token, {
            state: 'completed_firebase_only',
            platform,
            profileId: profile.userId || '',
            timestamp: Date.now()
          });

          return {
            success: true,
            firebase: firebaseResult.firebase,
            google: googleResult,
            showSuccessModal: true, // Always success modal for subsequent saves
            platform
          };
        } else {
          // First-time save: Show upsell once ever
          const result = createFirebaseOnlyResult(
            token,
            platform,
            profile.userId || '',
            firebaseResult.firebase,
            googleResult
          );

          // Mark first save as completed even if Google failed
          markFirstSaveCompleted();

          return result;
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

      // Mark that user has Google Contacts permission globally
      markGoogleContactsPermissionGranted();

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
          
          return createFirebaseOnlyResult(
            token,
            platform,
            profile.userId || '',
            firebaseResult.firebase,
            { success: false, error: 'User closed auth popup' }
          );
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
        
        return createFirebaseOnlyResult(
          token,
          platform,
          profile.userId || '',
          firebaseResult.firebase,
          googleResult
        );
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