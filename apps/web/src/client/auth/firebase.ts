import { signInWithCustomToken, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/client/config/firebase';

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
    // Don't auto-initialize listener - let components control when they need it
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
    // Return the Firebase auth current user directly instead of cached value
    return this.auth?.currentUser || null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    // Check Firebase auth directly instead of cached value
    return this.auth?.currentUser !== null;
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
      if (userCredential.user) {
      } else {
        console.error('[FirebaseAuth] ❌ signInWithCustomToken returned null user!');
      }
      return this.currentUser;
    } catch (error) {
      console.error('[FirebaseAuth] Failed to sign in with custom token:', error);
      // Note: Token refresh is handled automatically in the NextAuth JWT callback
      // which refreshes Firebase tokens every 50 minutes
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