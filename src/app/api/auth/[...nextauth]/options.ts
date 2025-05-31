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
  process.env.NEXTAUTH_URL = "http://localhost:3000";
}

// Get required environment variables with fallbacks
const NEXTAUTH_SECRET = getEnv('NEXTAUTH_SECRET');
const GOOGLE_CLIENT_ID = getEnv('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = getEnv('GOOGLE_CLIENT_SECRET');

// Extend the default session type
declare module "next-auth" {
  interface Session extends DefaultSession {
    accessToken?: string;
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    user?: User;
  }
}

import { AuthOptions } from 'next-auth';

// Only include Google provider if credentials are available
const providers = [];
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope: 'openid email profile',
        },
      },
      httpOptions: {
        timeout: 10000, // 10 second timeout
      },
    })
  );
}

export const authOptions: AuthOptions = {
  // Configure authentication providers
  providers,
  
  // Session configuration
  secret: NEXTAUTH_SECRET || 'your-secret-key-here-change-in-production',
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  
  // Cookie settings
  useSecureCookies: process.env.NODE_ENV === "production",
  cookies: {
    sessionToken: {
      name: `${process.env.NODE_ENV === 'production' ? '__Secure-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === "production",
        domain: process.env.NODE_ENV === 'production' ? '.nekt.us' : undefined,
      },
    },
  },
  
  // Pages configuration
  pages: {
    signIn: "/setup",
    error: "/setup"
  },
  
  // Callbacks
  callbacks: {
    async signIn(params) {
      // Process sign in callback
      if (process.env.NODE_ENV === 'development') {
        console.log('Sign in:', params.user?.email);
      }
      return true;
    },
    async jwt({ token, user, account, profile }) {
      // Initial sign in
      if (account && user) {
        // Process JWT callback
        
        // Use the profile picture from Google if available
        const googleImage = (profile as GoogleProfile)?.picture || (profile as GoogleProfile)?.image;
        const userImage = googleImage || user.image;
        
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            image: userImage
          }
        };
      }
      return token;
    },
    
    async session({ session, token }) {
      if (token.user) {
        session.user = {
          ...session.user,
          id: token.user.id,
          name: token.user.name,
          email: token.user.email,
          image: token.user.image // Ensure the image is passed through
        };
        session.accessToken = token.accessToken;
      }
      return session;
    },
    
    async redirect({ url, baseUrl }) {
      // If the token has profileExists flag, redirect to homepage
      try {
        // This is a bit of a hack, but we can extract the token from the URL
        const token = JSON.parse(decodeURIComponent(url.split('token=')[1]?.split('&')[0] || '{}'));
        if (token.profileWithPhoneExists) {
          return `${baseUrl}/`; // Redirect to homepage
        }
      } catch {
        // Error parsing token in redirect callback - intentionally ignored
      }
      
      // Default to setup page if no profile exists or we couldn't determine
      return `${baseUrl}/setup`;
    },
  },
  
  // Events
  events: {
    async signIn() {
      // Handle sign in event
      // No need to check profile here as events don't affect redirection
    },
    async signOut() {
      // Handle sign out event
    },
  },
  
  // Debug mode
  debug: process.env.NODE_ENV === "development",
  
  // Add logger for debugging
  logger: {
    async error(code: string, metadata: unknown) {
      console.error('Auth error:', code, metadata);
    },
    async warn(code: string) {
      console.warn('Auth warning:', code);
    },
    async debug(code: string, metadata: unknown) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('Auth debug:', code, metadata);
      }
    }
  },
  
  // Error handling is already defined above in the events object
};
