/**
 * Lightweight Firebase type definitions
 * Replaces the heavy firebase package imports with minimal type-only definitions
 */

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  isAnonymous: boolean;
  metadata: Record<string, unknown>;
  providerData: unknown[];
  refreshToken: string;
  tenantId: string | null;
  providerId: string;
  delete: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
  getIdTokenResult: (forceRefresh?: boolean) => Promise<{ token: string }>;
  reload: () => Promise<void>;
  toJSON: () => Record<string, unknown>;
}

export interface Auth {
  currentUser: User | null;
  app: FirebaseApp;
  name: string;
  config: Record<string, unknown>;
}

export interface FirebaseApp {
  name: string;
  options: Record<string, unknown>;
  automaticDataCollectionEnabled: boolean;
}

export type AuthStateCallback = (user: User | null) => void;
export type Unsubscribe = () => void;
