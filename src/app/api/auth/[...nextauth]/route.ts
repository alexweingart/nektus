import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// Determine the correct base URL based on environment
const BASE_URL = process.env.NODE_ENV === "production" 
  ? "https://nekt.us" 
  : "http://localhost:3000";

// Log the environment and base URL for debugging
console.log("Environment:", process.env.NODE_ENV);
console.log("BASE_URL:", BASE_URL);

// Configure NextAuth to match the exact redirect URIs in Google Cloud Console
const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          // Force the exact redirect URI to match Google Cloud Console
          redirect_uri: `${BASE_URL}/api/auth/callback/google`
        }
      }
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET || "nektus-app-contact-exchange-secret-key",
  pages: {
    signIn: '/setup',
    error: '/setup',
  },
  // Add proper callbacks to handle complete sign-in flow
  callbacks: {
    // JWT callback to store user information from Google
    async jwt({ token, account, profile }) {
      // Store the access token and user profile info when signin completes
      if (account && profile) {
        token.accessToken = account.access_token;
        token.id = profile.sub;
      }
      return token;
    },
    
    // Session callback to make user data available to the client
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub;
        // Add access token to session if needed by client
        session.accessToken = token.accessToken;
      }
      return session;
    },
    
    // Simple redirect callback that always goes to setup page
    async redirect() {
      return "/setup";
    }
  },
});

// Export the API route handlers
export { handler as GET, handler as POST };
