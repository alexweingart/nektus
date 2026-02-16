import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import type { DefaultSession, User } from "next-auth";
import { createCustomTokenWithCorrectSub } from "@/server/config/firebase";


// Set NEXTAUTH_URL if not set
if (!process.env.NEXTAUTH_URL) {
  // Default to localhost:3000 for development
  process.env.NEXTAUTH_URL = "http://localhost:3000";
}

// Extend the default session and user types
declare module "next-auth" {
  interface Session extends DefaultSession {
    accessToken?: string;
    firebaseToken?: string;
    profile?: {
      contactChannels: {
        entries: Array<{
          platform: string;
          section: string;
          userConfirmed: boolean;
          internationalPhone?: string;
          nationalPhone?: string;
          email?: string;
        }>;
      };
    };
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      phone?: string | null;
      profileImage?: string | null;
      backgroundImage?: string | null;
    };
    isNewUser?: boolean;
    redirectTo?: string;
  }

  interface User {
    phone?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    user?: User;
    profile?: {
      contactChannels: {
        entries: Array<{
          platform: string;
          section: string;
          userConfirmed: boolean;
          internationalPhone?: string;
          nationalPhone?: string;
          email?: string;
        }>;
      };
    };
    isNewUser?: boolean;
    profileImage?: string | null;
    backgroundImage?: string | null;
    firebaseToken?: string;
    firebaseTokenCreatedAt?: number;
    redirectTo?: string;
  }
}

import { type NextAuthOptions } from "next-auth";

// Check if we have the required environment variables
const hasGoogleCredentials = 
  process.env.GOOGLE_CLIENT_ID && 
  process.env.GOOGLE_CLIENT_SECRET;

if (!hasGoogleCredentials) {
  console.warn('Google OAuth credentials are missing. Google Sign-In will be disabled.');
}

// Configure authentication providers
const providers = [];

// Only add Google provider if credentials are available
if (hasGoogleCredentials) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code",
          scope: "openid email profile https://www.googleapis.com/auth/userinfo.profile",
          // Force account selection to ensure user can pick different account
          // This helps ensure fresh authorization after account deletion
          include_granted_scopes: "true"
        }
      }
    })
  );
}

// Add Apple credentials provider for iOS Safari Sign in with Apple
providers.push(
  CredentialsProvider({
    id: "apple",
    name: "Apple",
    credentials: {
      firebaseToken: { label: "Firebase Token", type: "text" },
      userId: { label: "User ID", type: "text" },
      name: { label: "Name", type: "text" },
      email: { label: "Email", type: "text" },
    },
    async authorize(credentials) {
      if (!credentials?.firebaseToken || !credentials?.userId) {
        return null;
      }

      // Return user object that will be encoded into the JWT
      return {
        id: credentials.userId,
        name: credentials.name || null,
        email: credentials.email || null,
        image: null,
        firebaseToken: credentials.firebaseToken,
      };
    },
  })
);

export const authOptions: NextAuthOptions = {
  // Configure authentication providers
  providers,
  
  // Session configuration
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // CACHE_TTL.MONTHLY
  },
  
  // Custom pages
  pages: {
    signIn: '/', // Redirect to homepage for sign-in
    error: '/', // Redirect to homepage for errors (including cancellation)
  },
  
  // Callbacks
  callbacks: {
    async signIn({ user, account: _account }) {
      console.log('[SignIn Callback] Always allowing sign-in for user:', user?.id);
      // Always allow sign-in - redirect callback will handle routing
      return true;
    },
    
    async jwt({ token, account, user, trigger, session }) {
      // Initial sign in - handle both Google OAuth and Apple credentials
      const isGoogleSignIn = account?.id_token;
      const isAppleCredentialsSignIn = account?.provider === 'apple' && user;

      if (isGoogleSignIn || isAppleCredentialsSignIn) {
        // Ensure we have the user ID in the token FIRST
        if (user?.id) {
          token.sub = user.id;
        }

        const userId = user?.id || token.sub;

        // For Apple credentials sign-in, use the Firebase token passed from the client
        if (isAppleCredentialsSignIn && (user as { firebaseToken?: string }).firebaseToken) {
          token.firebaseToken = (user as { firebaseToken?: string }).firebaseToken;
          token.firebaseTokenCreatedAt = Date.now();
        } else if (isGoogleSignIn && userId) {
          // For Google sign-in, generate Firebase custom token
          try {
            const firebaseToken = await createCustomTokenWithCorrectSub(userId);
            token.firebaseToken = firebaseToken;
            token.firebaseTokenCreatedAt = Date.now();
          } catch (error) {
            console.error('Failed to create Firebase custom token:', error);
          }
        }
      }
      
      // Check if Firebase token needs refresh (every 50 minutes to be safe)
      const userId = token.sub;
      if (userId && token.firebaseTokenCreatedAt) {
        const tokenAge = Date.now() - token.firebaseTokenCreatedAt;
        const fiftyMinutes = 50 * 60 * 1000; // 50 minutes in milliseconds
        
        if (tokenAge > fiftyMinutes) {
          try {
            const newFirebaseToken = await createCustomTokenWithCorrectSub(userId);
            token.firebaseToken = newFirebaseToken;
            token.firebaseTokenCreatedAt = Date.now();
          } catch (error) {
            console.error('Failed to refresh Firebase custom token:', error);
          }
        }
      }
        
      // Server-side profile management - create/check profile and determine redirects
      // This happens once during authentication - result cached in JWT
      if (isGoogleSignIn || isAppleCredentialsSignIn) {
        const userId = user?.id || token.sub;
        if (userId) {
          try {
            const { ServerProfileService } = await import('@/server/profile/create');
            const { profile, needsSetup } = await ServerProfileService.getOrCreateProfile(userId, {
              name: user?.name,
              email: user?.email,
              image: user?.image
            });

            // Set redirect destination based on setup needs
            token.redirectTo = needsSetup ? '/setup' : '/';

            // Keep existing profile data structure for compatibility
            const phoneEntry = profile.contactEntries?.find(e => e.fieldType === 'phone');
            if (phoneEntry?.value) {
              token.profile = {
                contactChannels: {
                  entries: [
                    {
                      platform: 'phone',
                      section: 'universal',
                      userConfirmed: true,
                      internationalPhone: phoneEntry.value,
                      nationalPhone: phoneEntry.value
                    }
                  ]
                }
              };
            }

            token.isNewUser = needsSetup; // Keep for compatibility
            token.profileImage = profile.profileImage || null;
            token.backgroundImage = profile.backgroundImage || null;
          } catch (error) {
            console.error('JWT: Error managing profile during authentication:', error);
            // Default to setup redirect if we can't check (safe fallback)
            token.redirectTo = '/setup';
            token.isNewUser = true;
          }
        } else {
          token.redirectTo = '/setup';
          token.isNewUser = true;
        }
        // --- Persist Google access_token for revocation ---
        if (account?.provider === 'google' && account?.access_token) {
          token.accessToken = account.access_token;
        }
      }
      // Define empty profile structure
      const emptyProfile = {
        contactChannels: {
          entries: [] as Array<{
            platform: string;
            section: string;
            userConfirmed: boolean;
            internationalPhone?: string;
            nationalPhone?: string;
            email?: string;
          }>
        }
      };
      // Initialize token profile if it doesn't exist
      if (!token.profile) {
        token.profile = { ...emptyProfile };
      }
      // Ensure contactChannels exists
      if (!token.profile.contactChannels) {
        token.profile.contactChannels = { ...emptyProfile.contactChannels };
      }
      // Ensure entries array exists
      if (!token.profile.contactChannels.entries) {
        token.profile.contactChannels.entries = [];
      }
      // Update with user's phone if available
      if (user?.phone) {
        const phoneIndex = token.profile.contactChannels.entries.findIndex(e => e.platform === 'phone');
        const phoneEntry = {
          platform: 'phone',
          section: 'universal',
          userConfirmed: true,
          internationalPhone: user.phone,
          nationalPhone: user.phone
        };
        if (phoneIndex >= 0) {
          token.profile.contactChannels.entries[phoneIndex] = phoneEntry;
        } else {
          token.profile.contactChannels.entries.push(phoneEntry);
        }
      }
      // Update with session data if available
      if (trigger === 'update' && session?.profile) {
        // Clear new user flag since profile now exists
        token.isNewUser = false;
        // Use session data directly instead of merging with potentially stale token data
        token.profile = {
          ...emptyProfile,
          ...session.profile,
          contactChannels: {
            ...emptyProfile.contactChannels,
            ...(session.profile.contactChannels || {}),
            entries: session.profile.contactChannels?.entries || []
          }
        };
      } else if (trigger === 'update' && !session?.profile) {
        // If session update but no profile data, reset to empty profile
        token.profile = { ...emptyProfile };
      }
      // Handle backgroundImage or profileImage updates sent via `update()`
      if (trigger === 'update') {
        if (session?.backgroundImage) {
          token.backgroundImage = session.backgroundImage as string;
        }
        if (session?.profileImage) {
          token.profileImage = session.profileImage as string;
        }
        // Update redirect status when session is updated
        if (session?.redirectTo !== undefined) {
          token.redirectTo = session.redirectTo;
        }
        if (session?.isNewUser !== undefined) {
          token.isNewUser = session.isNewUser;
        }
      }
      return token;
    },
    
    async session({ session, token }) {
      // Ensure user ID is included in the session
      if (token.sub) {
        session.user = session.user || {};
        session.user.id = token.sub;
        session.user.profileImage = token.profileImage;
        session.user.backgroundImage = token.backgroundImage;
      }
      // --- Persist Google accessToken in session for revoke ---
      if (token.accessToken) {
        session.accessToken = token.accessToken;
      }
      // -------------------------------------------------------
      // Add the Firebase token and profile to the session
      if (token.firebaseToken) {
        session.firebaseToken = token.firebaseToken as string;
        // Add profile to session from token
        if (token.profile) {
          session.profile = {
            contactChannels: {
              entries: token.profile.contactChannels?.entries || []
            }
          };
        }
        // Add isNewUser flag and redirect destination to session
        if (token.isNewUser !== undefined) {
          session.isNewUser = token.isNewUser;
        }
        if (token.redirectTo) {
          session.redirectTo = token.redirectTo;
        }
      }
      return session;
    },
    
    async redirect({ url, baseUrl }) {
      
      // Handle cancellation and errors by redirecting to homepage
      if (url.includes('error=Callback') || url.includes('error=')) {
        return baseUrl;
      }
      
      // If it's a relative URL, make it absolute
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }
      
      // Only allow redirects to same origin for security
      if (url.startsWith(baseUrl)) {
        return url;
      }
      
      // For OAuth callback, always redirect to homepage
      // Client-side will check session.isNewUser flag to handle routing
      return baseUrl;
    },
  },
  
  // Events
  events: {
    async signIn(_message) {
      // console.log('=== SIGN IN EVENT ===');
      // console.log('Sign in event details:', {
      //   user: message.user?.id,
      //   account: message.account?.provider,
      //   profile: message.profile?.email,
      //   isNewUser: message.isNewUser
      // });
      // console.log('=== END SIGN IN EVENT ===');
    },
    async signOut() {
      // console.log('=== SIGN OUT EVENT ===');
      // console.log('User signed out');
      // console.log('=== END SIGN OUT EVENT ===');
    },
    // @ts-expect-error - Error event is not in the type definition but is supported
    async error(error: unknown) {
      console.error('Auth error:', error);
    }
  },
  
  // Logger for debugging
  logger: {
    error(code: string, metadata: unknown) {
      console.error('Auth error:', code, metadata);
    },
    warn(code: string) {
      console.warn('Auth warning:', code);
    },
    debug(code: string, metadata: unknown) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('Auth debug:', code, metadata);
      }
    }
  }
};
