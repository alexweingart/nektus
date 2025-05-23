import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";

// Force specific URLS for OAuth that match Google Console exactly
const NEXTAUTH_URL = "https://nekt.us";
const CALLBACK_URL = "https://nekt.us/api/auth/callback/google";

// Store the provider settings in a separate object for clarity
const googleProviderOptions = {
  clientId: process.env.GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  authorization: {
    params: {
      // The critical parameters for Google OAuth:
      prompt: "select_account", // Force account selection each time
      access_type: "online", // We only need online access
      response_type: "code",
    },
  },
};

// Ensure we have valid provider settings
if (!googleProviderOptions.clientId || !googleProviderOptions.clientSecret) {
  console.error("CRITICAL ERROR: Missing Google OAuth credentials.");
  // In production, we'd want to handle this more gracefully
}

// Complete NextAuth configuration
export const authOptions: NextAuthOptions = {
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
    
    // Ensure we always redirect to the correct page
    async redirect({ url, baseUrl }) {
      console.log("Redirect callback", { url, baseUrl });
      // If URL is relative, make it absolute
      if (url.startsWith("/")) {
        return `${NEXTAUTH_URL}${url}`;
      }
      // If URL is already absolute but safe, use it
      if (url.startsWith(NEXTAUTH_URL)) {
        return url;
      }
      // Default to setup page
      return `${NEXTAUTH_URL}/setup`;
    },
  },
};

// Create and export the handler
const handler = NextAuth(authOptions);

// Export the API route handlers
export { handler as GET, handler as POST };
