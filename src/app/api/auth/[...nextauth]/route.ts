import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { NextAuthOptions } from "next-auth";

// IMPORTANT: Use hardcoded values to fix BOTH redirect and callback issues

// Fixed values for production and development
const PRODUCTION_URL = "https://nekt.us";
const DEVELOPMENT_URL = "http://localhost:3000";

// MUST exactly match what's in Google Cloud Console
const CALLBACK_URI_PRODUCTION = "https://nekt.us/api/auth/callback/google";
const CALLBACK_URI_DEVELOPMENT = "http://localhost:3000/api/auth/callback/google";

// Use production values only - development will be handled via Google Console config
const BASE_URL = PRODUCTION_URL;
const CALLBACK_URI = CALLBACK_URI_PRODUCTION;

// Log critical values for debugging
console.log("NextAuth Configuration:");
console.log(`- BASE_URL: ${BASE_URL}`);
console.log(`- CALLBACK_URI: ${CALLBACK_URI}`);
console.log(`- Environment: ${process.env.NODE_ENV}`);

const AUTH_OPTIONS: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          // CRITICAL: Force exact redirect URI matching with Google Console
          redirect_uri: CALLBACK_URI,
          // Only select_account is needed - minimal parameters for stability
          prompt: "select_account",
        }
      }
    }),
  ],
  // Use a fixed secret for consistent behavior
  secret: "nektus-app-contact-exchange-secret-key",
  
  // Session configuration for JWT handling
  session: { 
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  
  // Custom pages
  pages: {
    signIn: '/setup',
    error: '/setup',
  },
  
  // Debug for detailed logs
  debug: true,
  
  // Handle both parts of the OAuth flow
  callbacks: {
    // JWT callback for processing tokens from Google
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token as string;
      }
      return token;
    },
    
    // Session callback to pass data to client
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        (session as any).accessToken = token.accessToken as string;
      }
      return session;
    },
    
    // CRITICAL: Force redirect to setup page
    async redirect() {
      // Always go to setup page
      return "/setup";
    }
  }
};

// Create handler
const handler = NextAuth(AUTH_OPTIONS);

// Export handlers
export { handler as GET, handler as POST };
