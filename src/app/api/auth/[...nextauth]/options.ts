import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions, User, Account, Profile } from "next-auth";
import { db } from "../../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

// CRITICAL: Set the correct NEXTAUTH_URL for all environments
if (!process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = "https://nekt.us";
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!, // Ensure GOOGLE_CLIENT_ID is set
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!, // Ensure GOOGLE_CLIENT_SECRET is set
      authorization: {
        params: {
          // Always force account selection and show consent screen to re-authorize the app
          prompt: "consent select_account", // 'consent' forces the consent screen to be shown
          access_type: "offline",    // Request offline access for refresh tokens
          response_type: "code",     // Standard OAuth 2.0 flow
          scope: "openid email profile", // Request standard OpenID Connect scopes
          // Include current time to ensure no caching occurs
          state: Date.now().toString(),
        },
      },
    }),
    // No additional providers - this is a Google-only application
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

        // Check if the user already has a profile with phone number
        try {
          if (user.email) {
            const userEmail = user.email;
            const userDocRef = doc(db, 'profiles', userEmail);
            const userDocSnap = await getDoc(userDocRef);
            
            if (userDocSnap.exists()) {
              const userData = userDocSnap.data();
              // Only mark profile as existing if it has a phone number
              if (userData.phone && userData.phone.trim() !== '') {
                token.profileWithPhoneExists = true;
                console.log('User has existing profile with phone, will redirect to homepage');
              } else {
                token.profileWithPhoneExists = false;
                console.log('User has profile but no phone, will redirect to setup');
              }
            } else {
              token.profileWithPhoneExists = false;
              console.log('No profile found for user, will redirect to setup');
            }
          }
        } catch (error) {
          console.error('Error checking user profile:', error);
          token.profileWithPhoneExists = false;
        }
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
    async redirect({ url, baseUrl }) {
      // If the URL includes a specific callback destination, honor it
      if (url.startsWith(baseUrl)) {
        return url;
      }

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
  // Log important authentication events
  events: {
    async signIn({ user, account }) {
      console.log("SIGN_IN_EVENT", { user, account });
      
      // No need to check profile here as events don't affect redirection
    },
    async signOut() {
      console.log(`SIGN_OUT_EVENT: User signed out`);
    },
  },
  debug: process.env.NODE_ENV === "development", // Enable debug logs only in development
};
