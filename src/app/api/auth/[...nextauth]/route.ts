import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { NextAuthOptions } from "next-auth";

// Based on network logs, we need to focus on callback handling
const AUTH_OPTIONS: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      // Keep authorization parameters minimal
      authorization: {
        params: {
          prompt: "select_account",
        }
      }
    }),
  ],
  // Use environment variable with fallback
  secret: process.env.NEXTAUTH_SECRET || "nektus-app-contact-exchange-secret-key",
  
  // Configure cookie options for better mobile compatibility
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "none", // Critical for cross-site authentication
        path: "/",
        secure: true,
      },
    },
  },
  
  // Session configuration
  session: { 
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  
  // Custom pages
  pages: {
    signIn: '/setup',
    error: '/setup',
  },
  
  // Debug to see detailed logs in Vercel
  debug: true,
  
  // We need proper callbacks to handle the Google OAuth flow
  callbacks: {
    // JWT callback is critical for processing Google's response
    async jwt({ token, account }) {
      // Initial sign-in: account contains OAuth tokens
      if (account) {
        // Fix TypeScript error with proper type assertion
        token.accessToken = account.access_token as string;
      }
      return token;
    },
    
    // Session callback to make token data available to client
    async session({ session, token }) {
      // Add token info to session
      if (session.user) {
        // Fix TypeScript error with proper type assertion
        session.user.id = token.sub as string;
        // Type assertion needed for custom properties
        (session as any).accessToken = token.accessToken as string;
      }
      return session;
    },
    
    // Simple redirect callback
    async redirect() {
      return "/setup";
    }
  }
};

// Create handler with the options
const handler = NextAuth(AUTH_OPTIONS);

// Export the API route handlers
export { handler as GET, handler as POST };
