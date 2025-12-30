/**
 * iOS Firebase Services
 * Exports Firebase Firestore and Storage services for iOS
 */

// Initialization
export { initializeFirebaseServices } from './init';

// Firestore services
export { ClientProfileService } from './firebase-save';

// Storage services
export {
  uploadImageToStorage,
  uploadBackgroundImage,
  uploadProfileImage,
  cleanupUserStorage,
  rehostGoogleProfileImage,
} from './firebase-storage';
