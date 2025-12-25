/**
 * Shared services for Nektus - platform-agnostic business logic
 *
 * This package contains services that work across web and mobile platforms.
 * Firebase services will be added as we migrate more functionality.
 */

// Re-export types for convenience
export * from '@nektus/shared-types';

// Firebase configuration (shared across platforms)
export {
  firebaseConfig,
  isFirebaseConfigValid,
  getApiBaseUrl,
} from './config/firebase';

export const SHARED_SERVICES_VERSION = '0.1.0';
