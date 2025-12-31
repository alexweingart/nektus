/**
 * Shared client library for Nektus - platform-agnostic client utilities
 *
 * This package contains client utilities that work across web and mobile platforms.
 */

// Re-export types for convenience
export * from '@nektus/shared-types';

// ============================================================================
// CONFIG
// ============================================================================

// Firebase configuration (shared across platforms)
export {
  firebaseConfig,
  isFirebaseConfigValid,
  getApiBaseUrl,
} from './config/firebase';

// ============================================================================
// CLIENT UTILITIES
// ============================================================================

// Profile utilities
export * from './profile';

// Platform detection utilities
export * from './platform-detection';

// ============================================================================
// CONSTANTS
// ============================================================================

// Constants (business logic defaults)
export * from './constants';

// ============================================================================
// VERSION
// ============================================================================

export const SHARED_CLIENT_VERSION = '0.1.0';
