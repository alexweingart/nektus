import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// Get the origin for redirect URLs - use EXACTLY what's in Google Console
const origin = process.env.NODE_ENV === "production" ? "https://nekt.us" : "http://localhost:3000";

// Force the exact redirect URI that matches Google Console settings
const redirectUri = `${origin}/api/auth/callback/google`;

// Detailed logging for debugging
console.log('NextAuth Configuration:');
console.log('Environment:', process.env.NODE_ENV);
console.log('Origin:', origin);
console.log('Redirect URI:', redirectUri);

// Configure NextAuth handler
const handler = NextAuth({
  debug: true, // Enable debug logs for both development and production
  secret: process.env.NEXTAUTH_SECRET, // Ensure the secret is used for JWT encryption
  
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          // Force the exact redirect URI
          redirect_uri: redirectUri
        }
      }
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
      }
      return session;
    },
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    // Improved redirect handler with error logging
    async redirect({ url, baseUrl }) {
      console.log('Redirect called:');
      console.log('- URL:', url);
      console.log('- Base URL:', baseUrl);
      
      // Check for error parameters in the URL
      if (url.includes('error=')) {
        console.error('Auth error detected in redirect URL:', url);
        // Still redirect to setup page but with error parameter preserved
        return url;
      }
      
      // Always redirect to setup page after successful auth
      return `${origin}/setup`;
    }
  },
  pages: {
    signIn: '/setup', // Custom sign-in page
    error: '/setup', // Show errors on the setup page
  },
  
  // Enhanced error handling
  logger: {
    error(code, metadata) {
      console.error('NextAuth Error:', code, metadata);
    },
    warn(code) {
      console.warn('NextAuth Warning:', code);
    },
    debug(code, metadata) {
      console.log('NextAuth Debug:', code, metadata);
    }
  }
});

// Export the API route handlers
export { handler as GET, handler as POST };
