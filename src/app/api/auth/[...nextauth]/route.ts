import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions, User, Account, Profile } from "next-auth";

const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!, // Ensure GOOGLE_CLIENT_ID is set
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!, // Ensure GOOGLE_CLIENT_SECRET is set
      authorization: {
        params: {
          prompt: "select_account", // Consistently prompt for account selection
          access_type: "offline",    // Request offline access for refresh tokens if needed
          response_type: "code",     // Standard OAuth 2.0 flow
          scope: "openid email profile", // Request standard OpenID Connect scopes
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET, // Ensure NEXTAUTH_SECRET is set in your environment
  session: {
    strategy: "jwt", // Use JSON Web Tokens for session management
    maxAge: 30 * 24 * 60 * 60, // Sessions expire after 30 days
  },
  // Use default cookie names and secure options. `sameSite: "lax"` is default.
  // Explicitly setting for clarity, especially for production (secure: true)
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' ? `__Secure-next-auth.session-token` : `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax", // "lax" is generally recommended for security and compatibility
        path: "/",
        secure: process.env.NODE_ENV === 'production', // Cookies should be secure in production
      },
    },
    // Add other necessary cookies if customized, otherwise defaults are fine
  },
  pages: {
    signIn: "/setup", // Use relative paths for sign-in page
    error: "/setup",  // Redirect to /setup for errors; error messages can be handled there
  },
  callbacks: {
    async jwt({ token, user, account, profile }: { token: any; user?: User; account?: Account | null; profile?: Profile }) {
      // This callback is called when a JWT is created (i.e. on sign in)
      // or when a session is accessed (i.e. on /api/auth/session).
      if (account && user) { // `account` and `user` are only passed on sign-in
        // Add proper type casting for all properties
        token.accessToken = account.access_token as string;
        token.id_token = account.id_token as string; 
        token.userId = user.id as string; 
        token.email = user.email as string;
        token.name = user.name as string;
        token.picture = user.image as string;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      // This callback is called whenever a session is checked.
      // Send properties to the client, like an access_token and user ID from the token.
      // Add proper type casting for all custom properties
      session.accessToken = token.accessToken as string;
      session.id_token = token.id_token as string;
      
      // Ensure user object exists
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.picture = token.picture as string;
      }
      return session;
    },
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url;
      // Default redirect to setup page for safety if the URL is external or invalid
      return `${baseUrl}/setup`;
    },
  },
  // Log important authentication events
  events: {
    async signIn({ user }) {
      console.log(`SIGN_IN_EVENT: User ${user.id} signed in`);
    },
    async signOut() {
      console.log(`SIGN_OUT_EVENT: User signed out`);
    },
  },
  debug: process.env.NODE_ENV === "development", // Enable debug logs only in development
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
