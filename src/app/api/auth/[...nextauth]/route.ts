import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// CRITICAL: Use EXACTLY the origins/redirects from Google Console
// No dynamic calculation - we have direct evidence of what works
const GOOGLE_REDIRECT_URI = "https://nekt.us/api/auth/callback/google";
process.env.NEXTAUTH_URL = "https://nekt.us";

// Ensure the secret is properly set and non-empty
if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET.length < 10) {
  console.error('WARNING: NEXTAUTH_SECRET is missing or too short!');
  // Set a fallback secret for development to prevent errors
  if (process.env.NODE_ENV !== 'production') {
    process.env.NEXTAUTH_SECRET = 'dev_secret_do_not_use_in_production_nektus_app_key';
  }
}

// Print exact config for debugging
console.log('NextAuth Config:');
console.log('- NEXTAUTH_URL:', process.env.NEXTAUTH_URL);
console.log('- GOOGLE_REDIRECT_URI:', GOOGLE_REDIRECT_URI);
console.log('- NEXTAUTH_SECRET set:', !!process.env.NEXTAUTH_SECRET);
console.log('- NODE_ENV:', process.env.NODE_ENV);

// Configure NextAuth handler
const handler = NextAuth({
  debug: true, // Enable debug logs for both development and production
  secret: process.env.NEXTAUTH_SECRET, // Ensure the secret is used for JWT encryption
  session: {
    strategy: 'jwt', // Use JWT for session management
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          redirect_uri: GOOGLE_REDIRECT_URI,
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      },
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        }
      }
    }),
  ],
  callbacks: {
    async session({ session, token, user }) {
      // Add token data to session
      if (session.user) {
        session.user.id = token.sub as string;
        session.accessToken = token.accessToken as string;
      }
      return session;
    },
    async jwt({ token, account, profile, user }) {
      // Initial sign in
      if (account && profile) {
        token.accessToken = account.access_token;
        token.id = profile.sub; // Google profile uses 'sub' for ID
        token.name = profile.name;
        token.email = profile.email;
        // Handle profile picture (Google provides it as 'picture')
        token.picture = (profile as any).picture || user?.image;
      }
      return token;
    },
    // Simplified redirect handler - always go to setup page
    async redirect({ url, baseUrl }) {
      console.log('Redirect called:');
      console.log('- URL:', url);
      console.log('- Base URL:', baseUrl);
      
      // Always use exact URL
      return 'https://nekt.us/setup';
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
