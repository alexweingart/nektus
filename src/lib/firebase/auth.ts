import { getAuth, signInWithCustomToken, User, onAuthStateChanged } from 'firebase/auth';
import { app } from './clientConfig';

/**
 * Firebase Auth service for handling custom token authentication
 */
export class FirebaseAuthService {
  private static instance: FirebaseAuthService;
  private auth: ReturnType<typeof getAuth> | null = null;
  private currentUser: User | null = null;
  private authStateReady = false;

  private constructor() {
    this.initializeAuth();
  }

  private initializeAuth() {
    if (typeof window !== 'undefined' && app) {
      this.auth = getAuth(app);
      // Monitor auth state changes
      onAuthStateChanged(this.auth, (user) => {
        this.currentUser = user;
        this.authStateReady = true;
        if (user) {
          console.log('[FirebaseAuth] User signed in:', user.uid);
        } else {
          console.log('[FirebaseAuth] User signed out');
        }
      });
    }
  }

  public static getInstance(): FirebaseAuthService {
    if (!FirebaseAuthService.instance) {
      FirebaseAuthService.instance = new FirebaseAuthService();
    }
    return FirebaseAuthService.instance;
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
      console.log('[FirebaseAuth] Signing in with custom token...');
      const userCredential = await signInWithCustomToken(this.auth, token);
      this.currentUser = userCredential.user;
      console.log('[FirebaseAuth] Successfully signed in:', this.currentUser.uid);
      return this.currentUser;
    } catch (error) {
      console.error('[FirebaseAuth] Failed to sign in with custom token:', error);
      return null;
    }
  }

  /**
   * Get the current authenticated user
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
   * Wait for auth state to be ready
   */
  async waitForAuthState(): Promise<void> {
    if (this.authStateReady || !this.auth) return;

    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(this.auth!, () => {
        unsubscribe();
        resolve();
      });
    });
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
      await this.auth.signOut();
      this.currentUser = null;
      console.log('[FirebaseAuth] User signed out');
    } catch (error) {
      console.error('[FirebaseAuth] Failed to sign out:', error);
      // Clear local state even if sign out fails
      this.currentUser = null;
    }
  }

  /**
   * Clear all auth state (useful for debugging)
   */
  clearAuthState(): void {
    this.currentUser = null;
    this.authStateReady = false;
    console.log('[FirebaseAuth] Auth state cleared');
  }
}

// Export singleton instance
export const firebaseAuth = FirebaseAuthService.getInstance(); 