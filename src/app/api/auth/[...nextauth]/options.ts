import GoogleProvider from "next-auth/providers/google";
import type { DefaultSession, User, Profile } from "next-auth";

interface GoogleProfile extends Profile {
  picture?: string;
  image?: string;
}

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
  // Let Next.js handle the URL dynamically based on current port
  // process.env.NEXTAUTH_URL = "http://localhost:3000";
}

// Get required environment variables with fallbacks
const NEXTAUTH_SECRET = getEnv('NEXTAUTH_SECRET');
const GOOGLE_CLIENT_ID = getEnv('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = getEnv('GOOGLE_CLIENT_SECRET');

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
    };
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
  }
}

import { getServerSession, type NextAuthOptions } from "next-auth";

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
          response_type: "code"
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
  
  // Callbacks
  callbacks: {
    async jwt({ token, account, user, trigger, session }): Promise<any> {
      console.log('JWT callback triggered:', { 
        trigger, 
        hasSessionProfile: !!session?.profile,
        hasAccount: !!account,
        hasUser: !!user
      });
      
      // Initial sign in
      if (account?.id_token) {
        token.idToken = account.id_token;
        console.log('JWT: Added idToken to token');
        
        // --- Persist Google access_token for revocation ---
        if (account?.provider === 'google' && account?.access_token) {
          token.accessToken = account.access_token;
          console.log('JWT: Persisted Google access_token for revoke');
        }
        
        // Ensure we have the user ID in the token
        if (user?.id) {
          token.sub = user.id;
          console.log('JWT: Set sub from user.id:', user.id);
        } else if (token.sub) {
          console.log('JWT: Using existing sub from token:', token.sub);
        } else {
          console.warn('JWT: No user ID available in token');
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
        console.log('JWT: Updating with new profile data:', session.profile);
        
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
        console.log('JWT: Session update with no profile data, resetting to empty profile');
        token.profile = { ...emptyProfile };
      }
      
      // Log final token state for debugging
      const logToken = { ...token };
      if (logToken.profile) {
        console.log('JWT: Final token profile:', JSON.stringify({
          internationalPhone: logToken.profile.contactChannels?.phoneInfo?.internationalPhone,
          nationalPhone: logToken.profile.contactChannels?.phoneInfo?.nationalPhone,
          userConfirmed: logToken.profile.contactChannels?.phoneInfo?.userConfirmed
        }, null, 2));
      }
      
      return token;
    },
    
    async session({ session, token }) {
      // Ensure user ID is included in the session
      if (token.sub) {
        session.user = session.user || {};
        session.user.id = token.sub;
      }
      // --- Persist Google accessToken in session for revoke ---
      if (token.accessToken) {
        session.accessToken = token.accessToken;
        console.log('Session: Persisted Google accessToken:', token.accessToken);
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
        
        // TODO: Move Firebase Auth logic to client-side hook/context
        // Firebase Auth integration should happen client-side only
      }
      
      return session;
    },
    
    async redirect({ url, baseUrl }) {
      // Always redirect to the base URL to avoid redirect loops
      return baseUrl;
    },
  },
  
  // Events
  events: {
    async signIn(message) {
      console.log('Sign in event:', message);
    },
    async signOut() {
      console.log('User signed out');
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
