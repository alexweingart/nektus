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
  getApiBaseUrl,
} from './config/firebase';

// ============================================================================
// CLIENT UTILITIES
// ============================================================================

// Profile utilities
export * from './profile';

// Platform detection utilities
export * from './platform-detection';

// Contact utilities (vCard, etc.)
export * from './contacts';

// ============================================================================
// SCHEDULING
// ============================================================================

// Scheduling logic (event templates, slot evaluation, processCommonSlots)
export * from './scheduling';

// ============================================================================
// CONSTANTS
// ============================================================================

// Constants (business logic defaults)
export * from './constants';

