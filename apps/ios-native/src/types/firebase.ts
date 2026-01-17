/**
 * Firebase type definitions for iOS
 * Re-exports types from firebase/auth JS SDK
 */

import type { User as FirebaseUser } from 'firebase/auth';

// Re-export User type from Firebase
export type User = FirebaseUser;

// Auth state callback type
export type AuthStateCallback = (user: User | null) => void;
