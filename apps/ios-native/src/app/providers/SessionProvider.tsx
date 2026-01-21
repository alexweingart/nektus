/**
 * Session Provider for iOS
 *
 * This provider wraps Firebase authentication and exposes an API
 * similar to NextAuth's useSession() hook for consistency with the web app.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { Alert } from "react-native";
import type { User as FirebaseUser } from "../../types/firebase";
import {
  restoreSession,
  signInWithToken,
  signOut as firebaseSignOut,
} from "../../client/auth/firebase";
import {
  signInWithApple,
  exchangeAppleTokenForFirebase,
  isAppleAuthAvailable,
  AppleMobileTokenResponse,
} from "../../client/auth/apple";
import { storeAppleRefreshToken } from "../../client/auth/cleanup";
import {
  retrieveHandoffSession,
  clearHandoffSession,
  isFullApp,
} from "../../client/auth/session-handoff";

// Session user type matching web app's session.user structure
export interface SessionUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  backgroundImage?: string | null;
}

// Session type matching NextAuth's session structure
export interface Session {
  user: SessionUser;
  firebaseToken?: string;
  expires?: string;
}

// Auth status matching NextAuth's status
export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

// Context value type
interface SessionContextValue {
  data: Session | null;
  status: AuthStatus;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  update: () => Promise<Session | null>;
  isSigningIn: boolean;
  /** True if user just came from App Clip and needs to complete onboarding step 3 */
  fromHandoff: boolean;
  /** Call this after completing post-handoff onboarding */
  clearHandoffFlag: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [fromHandoff, setFromHandoff] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(true);

  // Check Apple auth availability on mount
  useEffect(() => {
    isAppleAuthAvailable().then(setAppleAuthAvailable);
  }, []);

  // Clear handoff flag after completing post-handoff onboarding
  const clearHandoffFlag = useCallback(() => {
    setFromHandoff(false);
  }, []);

  // Convert Firebase user + server response to Session object
  const createSession = useCallback(
    (
      firebaseUser: FirebaseUser,
      serverData?: AppleMobileTokenResponse
    ): Session => {
      return {
        user: {
          id: firebaseUser.uid,
          name:
            serverData?.user?.name ||
            firebaseUser.displayName ||
            null,
          email:
            serverData?.user?.email ||
            firebaseUser.email ||
            null,
          image:
            serverData?.user?.image ||
            firebaseUser.photoURL ||
            null,
          backgroundImage: null, // Will be loaded from profile
        },
        firebaseToken: serverData?.firebaseToken,
      };
    },
    []
  );

  // Restore session on mount
  useEffect(() => {
    const initSession = async () => {
      try {
        // First, try to restore existing Firebase session
        const { restored, user, needsRefresh } = await restoreSession();

        if (restored && user) {
          setSession(createSession(user));
          setStatus("authenticated");
          return;
        }

        // If in full app, check for handoff session from App Clip
        if (isFullApp()) {
          console.log("[SessionProvider] Checking for handoff session...");
          const handoff = await retrieveHandoffSession();

          if (handoff) {
            console.log("[SessionProvider] Found handoff session, signing in...");

            try {
              // Sign in with the handoff token
              const user = await signInWithToken(
                handoff.firebaseToken,
                handoff.userId
              );

              // Create session from handoff data
              const newSession: Session = {
                user: {
                  id: handoff.userId,
                  name: handoff.userName,
                  email: handoff.userEmail,
                  image: null,
                  backgroundImage: null,
                },
                firebaseToken: handoff.firebaseToken,
              };

              setSession(newSession);
              setStatus("authenticated");

              // Mark that we came from handoff (need to complete step 3)
              setFromHandoff(true);

              // Clear handoff after successful migration
              await clearHandoffSession();

              console.log("[SessionProvider] Handoff sign-in successful");
              return;
            } catch (handoffError) {
              console.error("[SessionProvider] Handoff sign-in failed:", handoffError);
              // Fall through to unauthenticated state
            }
          }
        }

        if (needsRefresh) {
          // Token expired, need to re-authenticate
          setStatus("unauthenticated");
        } else {
          setStatus("unauthenticated");
        }
      } catch (error) {
        console.error("[SessionProvider] Failed to restore session:", error);
        setStatus("unauthenticated");
      }
    };

    initSession();
  }, [createSession]);

  // Note: We don't use Firebase SDK auth state listener because we use REST API
  // for authentication (to properly support iOS API key restrictions).
  // Session state is managed directly via setSession/setStatus.

  // Sign in with Apple
  const signIn = useCallback(async () => {
    if (!appleAuthAvailable || isSigningIn) return;

    setIsSigningIn(true);
    try {
      console.log("[SessionProvider] Starting Apple sign in...");

      // Step 1: Trigger Sign in with Apple modal
      const appleResult = await signInWithApple();
      console.log("[SessionProvider] Apple sign in result:", appleResult.success);

      if (!appleResult.success) {
        // User cancelled - silently return without showing error
        if (appleResult.cancelled) {
          return;
        }
        const errorMsg = appleResult.error || "Apple sign-in failed";
        console.error("[SessionProvider] Apple sign in failed:", errorMsg);
        Alert.alert("Sign In Failed", errorMsg);
        return;
      }

      if (!appleResult.identityToken) {
        const errorMsg = "No identity token received from Apple";
        console.error("[SessionProvider]", errorMsg);
        Alert.alert("Sign In Failed", errorMsg);
        return;
      }

      // Step 2: Exchange Apple token for Firebase token via our backend
      // Also send authorization code to get refresh token for account deletion
      console.log("[SessionProvider] Exchanging Apple token with backend...");
      const serverResponse = await exchangeAppleTokenForFirebase(
        appleResult.identityToken,
        appleResult.fullName,
        appleResult.email,
        appleResult.authorizationCode // For refresh token (account deletion)
      );

      // Step 2.5: Store Apple refresh token if received (for account deletion)
      if (serverResponse.appleRefreshToken && serverResponse.userId) {
        await storeAppleRefreshToken(serverResponse.userId, serverResponse.appleRefreshToken);
        console.log("[SessionProvider] Stored Apple refresh token for account deletion");
      }

      console.log("[SessionProvider] Backend response received, signing into Firebase...");

      // Step 3: Sign in to Firebase with the custom token
      const user = await signInWithToken(
        serverResponse.firebaseToken,
        serverResponse.userId
      );

      // Step 4: Update session state
      const newSession = createSession(user, serverResponse);
      setSession(newSession);
      setStatus("authenticated");

      console.log("[SessionProvider] Apple sign in successful!");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[SessionProvider] Sign in failed:", error);
      Alert.alert("Sign In Failed", `Sign in failed: ${errorMsg}`);
    } finally {
      setIsSigningIn(false);
    }
  }, [appleAuthAvailable, createSession, isSigningIn]);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut();
      setSession(null);
      setStatus("unauthenticated");
      console.log("[SessionProvider] Sign out successful");
    } catch (error) {
      console.error("[SessionProvider] Sign out failed:", error);
      throw error;
    }
  }, []);

  // Update session (refresh from server)
  const update = useCallback(async (): Promise<Session | null> => {
    // For now, just return the current session
    // In the future, this could refresh the token from the server
    return session;
  }, [session]);

  const value: SessionContextValue = {
    data: session,
    status,
    signIn,
    signOut,
    update,
    isSigningIn,
    fromHandoff,
    clearHandoffFlag,
  };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

/**
 * Hook to access session data
 *
 * Usage matches NextAuth's useSession:
 * ```tsx
 * const { data: session, status } = useSession();
 *
 * if (status === 'loading') return <Loading />;
 * if (status === 'unauthenticated') return <SignIn />;
 *
 * return <Profile user={session.user} />;
 * ```
 */
export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);

  if (!context) {
    // In App Clip mode, return default values instead of throwing
    // This allows ContactView to be used without SessionProvider
    if (isFullApp()) {
      throw new Error("useSession must be used within a SessionProvider");
    }
    // App Clip fallback - return minimal session interface
    return {
      data: null,
      status: "unauthenticated",
      signIn: async () => {},
      signOut: async () => {},
      update: async () => null,
      isSigningIn: false,
      fromHandoff: false,
      clearHandoffFlag: () => {},
    };
  }

  return context;
}
