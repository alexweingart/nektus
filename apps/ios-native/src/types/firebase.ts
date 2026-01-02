/**
 * Firebase type definitions for iOS
 * Re-exports types from @react-native-firebase/auth
 */

import type { FirebaseAuthTypes } from '@react-native-firebase/auth';

// Re-export User type from Firebase
export type User = FirebaseAuthTypes.User;

// Auth state callback type
export type AuthStateCallback = (user: User | null) => void;
