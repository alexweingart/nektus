import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions, DefaultSession, User } from "next-auth";
import { JWT } from "next-auth/jwt";

// Helper to get environment variables with better error handling
const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value && process.env.NODE_ENV !== 'test') {
    console.warn(`Warning: Missing environment variable: ${key}`);
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
    async signIn({ user, account, profile, email, credentials }) {
      console.log('Sign in callback:', { user, account, profile });
      return true;
    },
    async jwt({ token, user, account }) {
      // Initial sign in
      if (account && user) {
        console.log('JWT callback:', { token, user, account });
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image
          }
        };
      }
      return token;
    },
    
    async session({ session, token }) {
      if (token.user) {
        session.user = token.user;
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
      } catch (e) {
        console.error('Error parsing token in redirect callback:', e);
      }
      
      // Default to setup page if no profile exists or we couldn't determine
      return `${baseUrl}/setup`;
    },
  },
  
  // Events
  events: {
    async signIn({ user, account }) {
      console.log("SIGN_IN_EVENT", { user, account });
      // No need to check profile here as events don't affect redirection
    },
    async signOut() {
      console.log(`SIGN_OUT_EVENT: User signed out`);
    },
  },
  
  // Debug mode
  debug: process.env.NODE_ENV === "development",
  
  // Add logger for debugging
  logger: {
    error(code, metadata) {
      console.error('Auth error:', code, metadata);
    },
    warn(code) {
      console.warn('Auth warning:', code);
    },
    debug(code, metadata) {
      console.log('Auth debug:', code, metadata);
    }
  },
  
  // Error handling is already defined above in the events object
};
