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
import { User as FirebaseUser } from "firebase/auth";
import {
  restoreSession,
  signInWithToken,
  signOut as firebaseSignOut,
} from "../../lib/client/auth/firebase";
import {
  useGoogleAuth,
  exchangeGoogleTokenForFirebase,
  exchangeGoogleAccessTokenForFirebase,
  MobileTokenResponse,
} from "../../lib/client/auth/google";

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
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [isSigningIn, setIsSigningIn] = useState(false);

  const { signIn: googleSignIn, isReady: googleReady } = useGoogleAuth();

  // Convert Firebase user + server response to Session object
  const createSession = useCallback(
    (
      firebaseUser: FirebaseUser,
      serverData?: MobileTokenResponse
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
        const { restored, user, needsRefresh } = await restoreSession();

        if (restored && user) {
          setSession(createSession(user));
          setStatus("authenticated");
        } else if (needsRefresh) {
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

  // Sign in with Google
  const signIn = useCallback(async () => {
    if (!googleReady || isSigningIn) return;

    setIsSigningIn(true);
    try {
      // Step 1: Get Google tokens
      const googleResult = await googleSignIn();

      if (!googleResult.success) {
        throw new Error(googleResult.error || "Failed to get Google token");
      }

      // Step 2: Exchange for Firebase token via our backend
      // Token exchange now happens client-side, so we get tokens directly
      let serverResponse: MobileTokenResponse;
      if (googleResult.idToken) {
        console.log("[SessionProvider] Using ID token flow");
        serverResponse = await exchangeGoogleTokenForFirebase(googleResult.idToken);
      } else if (googleResult.accessToken) {
        console.log("[SessionProvider] Using access token flow");
        serverResponse = await exchangeGoogleAccessTokenForFirebase(googleResult.accessToken);
      } else {
        throw new Error("No tokens received from Google");
      }

      // Step 3: Sign in to Firebase with the custom token
      const user = await signInWithToken(
        serverResponse.firebaseToken,
        serverResponse.userId
      );

      // Step 4: Update session state
      const newSession = createSession(user, serverResponse);
      setSession(newSession);
      setStatus("authenticated");

      console.log("[SessionProvider] Sign in successful");
    } catch (error) {
      console.error("[SessionProvider] Sign in failed:", error);
      throw error;
    } finally {
      setIsSigningIn(false);
    }
  }, [googleReady, googleSignIn, createSession, isSigningIn]);

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
    throw new Error("useSession must be used within a SessionProvider");
  }

  return context;
}
