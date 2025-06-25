import GoogleProvider from "next-auth/providers/google";
import type { DefaultSession, User } from "next-auth";
import { getFirebaseAdmin } from "@/lib/firebase/adminConfig";

// Helper to get environment variables with better error handling
const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value && process.env.NODE_ENV !== 'test') {
    // Log warning only in development mode
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Missing environment variable: ${key}`);
    }
  }
  return value || '';
};

// Set NEXTAUTH_URL if not set
if (!process.env.NEXTAUTH_URL) {
  // Default to localhost:3000 for development
  process.env.NEXTAUTH_URL = "http://localhost:3000";
}

// Extend the default session and user types
declare module "next-auth" {
  interface Session extends DefaultSession {
    accessToken?: string;
    profile?: {
      contactChannels: {
        phoneInfo: {
          internationalPhone: string;
          nationalPhone: string;
          userConfirmed: boolean;
        };
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
        phoneInfo: {
          internationalPhone: string;
          nationalPhone: string;
          userConfirmed: boolean;
        };
      };
    };
    isNewUser?: boolean;
    profileImage?: string | null;
    backgroundImage?: string | null;
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
          prompt: "consent",
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

export const authOptions: NextAuthOptions = {
  // Configure authentication providers
  providers,
  
  // Session configuration
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  
  // Custom pages
  pages: {
    signIn: '/', // Redirect to homepage for sign-in
    error: '/', // Redirect to homepage for errors (including cancellation)
  },
  
  // Callbacks
  callbacks: {
    async jwt({ token, account, user, trigger, session }): Promise<any> {
      // Initial sign in
      if (account?.id_token) {
        // Server-side Firebase check to determine if user is truly new or existing
        // This happens once during authentication - result cached in JWT
        if (token.sub) {
          try {
            const { db } = await getFirebaseAdmin();
            const profileDoc = await db.collection('profiles').doc(token.sub).get();
            if (profileDoc.exists) {
              const profileData = profileDoc.data();
              // Store phone info in token if it exists in Firebase
              if (profileData?.contactChannels?.phoneInfo?.internationalPhone) {
                token.profile = {
                  contactChannels: {
                    phoneInfo: {
                      internationalPhone: profileData.contactChannels.phoneInfo.internationalPhone,
                      nationalPhone: profileData.contactChannels.phoneInfo.nationalPhone || '',
                      userConfirmed: profileData.contactChannels.phoneInfo.userConfirmed || false
                    }
                  }
                };
              }
              token.isNewUser = !(profileData?.contactChannels?.phoneInfo?.internationalPhone);
              token.profileImage = profileData?.profileImage || null;
              token.backgroundImage = profileData?.backgroundImage || null;
            } else {
              token.isNewUser = true;
            }
          } catch (error) {
            console.error('JWT: Error checking Firebase profile during authentication:', error);
            // Default to new user if we can't check (safe fallback)
            token.isNewUser = true;
          }
        } else {
          token.isNewUser = true;
        }
        // --- Persist Google access_token for revocation ---
        if (account?.provider === 'google' && account?.access_token) {
          token.accessToken = account.access_token;
        }
        // Ensure we have the user ID in the token
        if (user?.id) {
          token.sub = user.id;
        }
      }
      // Define empty profile structure
      const emptyProfile = {
        contactChannels: {
          phoneInfo: {
            internationalPhone: '',
            nationalPhone: '',
            userConfirmed: false
          }
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
      // Ensure phoneInfo exists
      if (!token.profile.contactChannels.phoneInfo) {
        token.profile.contactChannels.phoneInfo = { ...emptyProfile.contactChannels.phoneInfo };
      }
      // Update with user's phone if available
      if (user?.phone) {
        token.profile.contactChannels.phoneInfo = {
          internationalPhone: user.phone,
          nationalPhone: user.phone,
          userConfirmed: true
        };
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
            phoneInfo: {
              ...emptyProfile.contactChannels.phoneInfo,
              ...(session.profile.contactChannels?.phoneInfo || {})
            }
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
      if (token.idToken) {
        session.idToken = token.idToken as string;
        // Add profile to session from token
        if (token.profile) {
          session.profile = {
            contactChannels: {
              phoneInfo: {
                internationalPhone: token.profile.contactChannels?.phoneInfo?.internationalPhone || '',
                nationalPhone: token.profile.contactChannels?.phoneInfo?.nationalPhone || '',
                userConfirmed: token.profile.contactChannels?.phoneInfo?.userConfirmed || false
              }
            }
          };
        }
        // Add isNewUser flag to session
        if (token.isNewUser !== undefined) {
          session.isNewUser = token.isNewUser;
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
      
      // Default to homepage
      return baseUrl;
    },
  },
  
  // Events
  events: {
    async signIn(message) {
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
