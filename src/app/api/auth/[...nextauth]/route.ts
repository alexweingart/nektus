import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { NextAuthOptions } from "next-auth";

// DO NOT use dynamic base URLs - this is a common source of problems
// Instead, we'll use static, hardcoded values that exactly match Google Console
const AUTH_OPTIONS: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        // Google OAuth needs exact URI matching - the key insight from research
        params: {
          // DO NOT build this URL dynamically
          redirect_uri: "https://nekt.us/api/auth/callback/google",
          // These params are recommended in multiple GitHub issues
          prompt: "select_account",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
  ],
  // Use a fixed, hardcoded secret
  secret: "nektus-app-contact-exchange-secret-key",
  
  // Simplified configuration
  session: { 
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  
  // Redirect to setup page
  pages: {
    signIn: '/setup',
    error: '/setup',
  },
  
  // Minimal callbacks - the more we add, the more places things can break
  callbacks: {
    async redirect() {
      // Always go to setup page
      return "/setup";
    }
  }
};

// Create handler with the fixed options
const handler = NextAuth(AUTH_OPTIONS);

// Export the API route handlers
export { handler as GET, handler as POST };
