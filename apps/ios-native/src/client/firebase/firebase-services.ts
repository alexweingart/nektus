/**
 * Firebase Service Initialization for iOS
 * Sets up the shared-lib ProfileSaveService with iOS ClientProfileService implementation
 */

import { setClientProfileService } from '@nektus/shared-client';
import { ClientProfileService } from './firebase-save';

/**
 * Initialize Firebase services
 * Must be called before using ProfileSaveService from shared-lib
 */
export function initializeFirebaseServices(): void {
  // Set up the shared-lib ProfileSaveService with iOS implementation
  setClientProfileService(ClientProfileService);

  console.log('[Firebase Init] Firebase services initialized for iOS');
}
