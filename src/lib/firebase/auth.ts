import { getAuth, signInWithCustomToken, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './clientConfig';

/**
 * Firebase Auth service for handling custom token authentication
 */
export class FirebaseAuthService {
  private static instance: FirebaseAuthService;
  private auth;
  private currentUser: User | null = null;
  private unsubscribeAuth: (() => void) | null = null;

  constructor() {
    this.auth = auth;
    this.setupAuthListener();
  }

  private setupAuthListener() {
    if (!this.auth) {
      console.error('[FirebaseAuth] Auth not initialized');
      return;
    }

    this.unsubscribeAuth = onAuthStateChanged(this.auth, (user) => {
      this.currentUser = user;
      if (user) {
        // User signed in
      } else {
        // User signed out
      }
    });
  }

  public static getInstance(): FirebaseAuthService {
    if (!FirebaseAuthService.instance) {
      FirebaseAuthService.instance = new FirebaseAuthService();
    }
    return FirebaseAuthService.instance;
  }

  /**
   * Get the current user
   */
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  /**
   * Sign in with a custom Firebase token
   */
  async signInWithCustomToken(token: string): Promise<User | null> {
    if (!this.auth) {
      console.error('[FirebaseAuth] Auth not initialized');
      return null;
    }
    
    try {
      const userCredential = await signInWithCustomToken(this.auth, token);
      this.currentUser = userCredential.user;
      return this.currentUser;
    } catch (error: any) {
      // Check if it's an invalid/expired token error
      if (error?.code === 'auth/invalid-custom-token' || 
          error?.code === 'auth/custom-token-mismatch' ||
          error?.message?.includes('invalid') ||
          error?.message?.includes('expired')) {
        
        try {
          // Try to refresh the token
          const refreshResponse = await fetch('/api/auth/refresh-firebase-token', {
            method: 'POST',
            credentials: 'include',
          });
          
          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json();
            if (refreshData.success && refreshData.firebaseToken) {
              // Retry with the new token
              const retryCredential = await signInWithCustomToken(this.auth, refreshData.firebaseToken);
              this.currentUser = retryCredential.user;
              return this.currentUser;
            }
          }
        } catch (refreshError) {
          console.error('[FirebaseAuth] Token refresh failed:', refreshError);
        }
      }
      
      console.error('[FirebaseAuth] Failed to sign in with custom token:', error);
      return null;
    }
  }

  /**
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    if (!this.auth) {
      console.error('[FirebaseAuth] Auth not initialized');
      return;
    }

    try {
      await signOut(this.auth);
      this.currentUser = null;
    } catch (error) {
      console.error('[FirebaseAuth] Failed to sign out:', error);
      throw error;
    }
  }

  /**
   * Get the current user's ID token
   */
  async getIdToken(forceRefresh: boolean = false): Promise<string | null> {
    if (!this.currentUser) {
      return null;
    }

    try {
      return await this.currentUser.getIdToken(forceRefresh);
    } catch (error) {
      console.error('[FirebaseAuth] Failed to get ID token:', error);
      return null;
    }
  }

  /**
   * Clean up the auth listener
   */
  cleanup(): void {
    if (this.unsubscribeAuth) {
      this.unsubscribeAuth();
      this.unsubscribeAuth = null;
    }
    this.currentUser = null;
  }
}

// Export singleton instance
export const firebaseAuth = FirebaseAuthService.getInstance(); 