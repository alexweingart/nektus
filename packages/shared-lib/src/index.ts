/**
 * Shared library for Nektus - platform-agnostic utilities and services
 *
 * This package contains utilities and services that work across web and mobile platforms.
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
export * from './client/profile';

// Platform detection utilities
export * from './client/platform-detection';

// ============================================================================
// CONSTANTS
// ============================================================================

// Constants (business logic defaults)
export * from './constants';

// ============================================================================
// VERSION
// ============================================================================

export const SHARED_LIB_VERSION = '0.1.0';
