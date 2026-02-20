/**
 * iOS Firebase Services
 * Exports Firebase Firestore and Storage services for iOS
 */

// Initialization
export { initializeFirebaseServices } from './firebase-services';

// Firestore services
export { ClientProfileService, syncTimezone } from './firebase-save';

// Storage services
export {
  uploadImageToStorage,
  uploadBackgroundImage,
  uploadProfileImage,
  cleanupUserStorage,
  rehostGoogleProfileImage,
} from './firebase-storage';
