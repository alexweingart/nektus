import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";

// Set default environment values if not provided
if (!process.env.NEXTAUTH_URL) {
  // Use correct URL based on environment
  if (process.env.NODE_ENV === 'production') {
    process.env.NEXTAUTH_URL = 'https://nekt.us';
  } else {
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
  }
}

// Ensure we have a secret
if (!process.env.NEXTAUTH_SECRET) {
  console.warn('WARNING: NEXTAUTH_SECRET not set, using fallback for development');
  process.env.NEXTAUTH_SECRET = 'nektus-fallback-secret-key-for-development-only';
}

// Simple Google provider configuration
const googleProviderOptions = {
  clientId: process.env.GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  // Keep OAuth options minimal for maximum compatibility
  authorization: {
    params: {
      prompt: "select_account", // Force account selection
      access_type: "online",
    },
  },
};

// Log important configuration values for debugging
console.log('NextAuth Config:');
console.log('- NEXTAUTH_URL:', process.env.NEXTAUTH_URL);
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- Has GOOGLE_CLIENT_ID:', !!process.env.GOOGLE_CLIENT_ID);
console.log('- Has GOOGLE_CLIENT_SECRET:', !!process.env.GOOGLE_CLIENT_SECRET);

// Complete NextAuth configuration
// Do NOT export this - Next.js route files can only export route handlers
const authOptions: NextAuthOptions = {
  providers: [GoogleProvider(googleProviderOptions)],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  debug: true, // Enable debugging in all environments for now
  pages: {
    signIn: '/setup',
    error: '/setup',
  },
  callbacks: {
    // Handle the JWT token - store essential user info
    async jwt({ token, account, profile }) {
      if (account && profile) {
        console.log("JWT callback with account and profile");
        token.userId = profile.sub;
      }
      return token;
    },
    
    // Session callback to pass data to the client
    async session({ session, token }) {
      console.log("Session callback");
      if (session.user) {
        session.user.id = token.sub as string;
      }
      return session;
    },
    
    // Simple redirect callback that always goes to setup page
    async redirect({ url, baseUrl }) {
      console.log("Redirect callback", { url, baseUrl });
      
      // Get the base URL from environment or fallback to baseUrl parameter
      const base = process.env.NEXTAUTH_URL || baseUrl;
      
      // Always redirect to setup page
      return `${base}/setup`;
    },
  },
};

// Create and export the handler
const handler = NextAuth(authOptions);

// Export the API route handlers
export { handler as GET, handler as POST };
